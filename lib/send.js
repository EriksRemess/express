/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { createReadStream, stat as fsStat } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import path from 'node:path';
import createDebug from '#lib/utils/debug';
import encodeUrl from '#lib/utils/encode-url';
import escapeHtml from '#lib/utils/escape-html';
import createEntityTag from '#lib/utils/etag';
import { isFresh } from '#lib/utils/fresh';
import createHtmlDocument from '#lib/utils/html-document';
import { parseHttpDate, parseTokenList } from '#lib/utils/http-parsing';
import createError from '#lib/utils/http-errors';
import mime from 'mime-types';
import onFinished from '#lib/utils/on-finished';
import parseRange from '#lib/utils/range-parser';
import { collapseLeadingSlashes } from '#lib/utils/url-path';

const debug = createDebug('send');
const { extname, join, normalize, resolve, sep } = path;

const BYTES_RANGE_REGEXP = /^ *bytes=/;
const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000;
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Create a file transfer stream for a request path.
 *
 * @param {object} req
 * @param {string} filePath
 * @param {object} [options]
 * @returns {SendStream}
 */
export default function send(req, filePath, options) {
  return new SendStream(req, filePath, options);
}

/**
 * File transfer helper used by `res.sendFile()` and `express.static()`.
 */
class SendStream extends EventEmitter {
  /**
   * @param {object} req
   * @param {string} filePath
   * @param {object} [options]
   */
  constructor(req, filePath, options) {
    super();

    const opts = options || {};

    this.options = opts;
    this.path = filePath;
    this.req = req;

    this._acceptRanges = opts.acceptRanges !== undefined
      ? Boolean(opts.acceptRanges)
      : true;

    this._cacheControl = opts.cacheControl !== undefined
      ? Boolean(opts.cacheControl)
      : true;

    this._etag = opts.etag !== undefined
      ? Boolean(opts.etag)
      : true;

    this._dotfiles = opts.dotfiles !== undefined
      ? opts.dotfiles
      : 'ignore';

    if (!['ignore', 'allow', 'deny'].includes(this._dotfiles)) {
      throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"');
    }

    this._extensions = opts.extensions !== undefined
      ? normalizeList(opts.extensions, 'extensions option')
      : [];

    this._immutable = opts.immutable !== undefined
      ? Boolean(opts.immutable)
      : false;

    this._index = opts.index !== undefined
      ? normalizeList(opts.index, 'index option')
      : ['index.html'];

    this._lastModified = opts.lastModified !== undefined
      ? Boolean(opts.lastModified)
      : true;

    this._maxage = parseMaxAge(opts.maxAge ?? opts.maxage);
    this._cacheControlHeader = this._immutable
      ? `public, max-age=${Math.floor(this._maxage / 1000)}, immutable`
      : `public, max-age=${Math.floor(this._maxage / 1000)}`;
    this._root = opts.root
      ? resolve(opts.root)
      : null;
  }

  /**
   * Emit an HTTP error or send a bare error response.
   *
   * @param {number} status
   * @param {Error|object} [err]
   * @returns {void}
   */
  error(status, err) {
    if (this.listenerCount('error') > 0) {
      this.emit('error', createHttpError(status, err));
      return;
    }

    const res = this.res;
    const message = STATUS_CODES[status] || String(status);
    const document = createHtmlDocument('Error', escapeHtml(message));

    clearHeaders(res);

    if (err && err.headers) {
      setHeaders(res, err.headers);
    }

    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Content-Length', Buffer.byteLength(document));
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(document);
  }

  /**
   * @returns {boolean}
   */
  hasTrailingSlash() {
    return this.path[this.path.length - 1] === '/';
  }

  /**
   * @returns {boolean}
   */
  isConditionalGET() {
    const headers = this.req.headers;

    return Boolean(
      headers['if-match']
      || headers['if-unmodified-since']
      || headers['if-none-match']
      || headers['if-modified-since'],
    );
  }

  /**
   * @returns {boolean}
   */
  isPreconditionFailure(etag, lastModified) {
    const req = this.req;
    const match = req.headers['if-match'];

    if (match) {
      if (!etag) {
        return true;
      }

      if (match === '*') {
        return false;
      }

      if (match.indexOf(',') === -1) {
        return match !== etag
          && match !== `W/${etag}`
          && `W/${match}` !== etag;
      }

      return parseTokenList(match).every(token => {
        return token !== etag
          && token !== `W/${etag}`
          && `W/${token}` !== etag;
      });
    }

    const unmodifiedSince = parseHttpDate(req.headers['if-unmodified-since']);
    if (!Number.isNaN(unmodifiedSince)) {
      const timestamp = parseHttpDate(lastModified);
      return Number.isNaN(timestamp) || timestamp > unmodifiedSince;
    }

    return false;
  }

  /**
   * Remove entity headers for a 304 response.
   */
  removeContentHeaderFields() {
    const res = this.res;

    res.removeHeader('Content-Encoding');
    res.removeHeader('Content-Language');
    res.removeHeader('Content-Length');
    res.removeHeader('Content-Range');
    res.removeHeader('Content-Type');
  }

  /**
   * Respond with 304.
   */
  notModified() {
    debug('not modified');
    this.removeContentHeaderFields();
    this.res.statusCode = 304;
    this.res.end();
  }

  /**
   * Fail when headers were already sent before file handling.
   */
  headersAlreadySent() {
    debug('headers already sent');
    this.error(500, new Error('Can\'t set headers after they are sent.'));
  }

  /**
   * @returns {boolean}
   */
  isCachable() {
    const { statusCode } = this.res;
    return (statusCode >= 200 && statusCode < 300) || statusCode === 304;
  }

  /**
   * @param {NodeJS.ErrnoException} error
   */
  onStatError(error) {
    switch (error.code) {
      case 'ENAMETOOLONG':
      case 'ENOENT':
      case 'ENOTDIR':
        this.error(404, error);
        break;
      default:
        this.error(500, error);
        break;
    }
  }

  /**
   * @returns {boolean}
   */
  isFresh(etag, lastModified) {
    return isFresh(this.req.headers, etag, lastModified);
  }

  /**
   * @returns {boolean}
   */
  isRangeFresh() {
    const ifRange = this.req.headers['if-range'];

    if (!ifRange) {
      return true;
    }

    if (ifRange.includes('"')) {
      const etag = this.res.getHeader('ETag');
      return Boolean(etag && ifRange.includes(etag));
    }

    const lastModified = this.res.getHeader('Last-Modified');
    return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
  }

  /**
   * @param {string} targetPath
   */
  redirect(targetPath) {
    const res = this.res;

    if (this.listenerCount('directory') > 0) {
      this.emit('directory', res, targetPath);
      return;
    }

    if (this.hasTrailingSlash()) {
      this.error(403);
      return;
    }

    const location = encodeUrl(collapseLeadingSlashes(`${this.path}/`));
    const document = createHtmlDocument(
      'Redirecting',
      `Redirecting to ${escapeHtml(location)}`,
    );

    res.statusCode = 301;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Content-Length', Buffer.byteLength(document));
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Location', location);
    res.end(document);
  }

  /**
   * Pipe the resolved file into the response.
   *
   * @param {NodeJS.WritableStream & import('node:http').ServerResponse} res
   * @returns {typeof res}
   */
  pipe(res) {
    const root = this._root;

    this.res = res;

    let filePath = decode(this.path);
    let relativePath = filePath;
    if (filePath === -1) {
      this.error(400);
      return res;
    }

    if (filePath.includes('\0')) {
      this.error(400);
      return res;
    }

    if (root !== null) {
      if (filePath) {
        filePath = normalize(`.${sep}${filePath}`);
      }

      relativePath = filePath;

      if (UP_PATH_REGEXP.test(filePath)) {
        debug('malicious path "%s"', filePath);
        this.error(403);
        return res;
      }

      filePath = normalize(join(root, filePath));
    } else {
      if (UP_PATH_REGEXP.test(filePath)) {
        debug('malicious path "%s"', filePath);
        this.error(403);
        return res;
      }

      relativePath = normalize(filePath);
      filePath = resolve(filePath);
    }

    if (containsDotFilePath(relativePath)) {
      debug('%s dotfile "%s"', this._dotfiles, filePath);
      switch (this._dotfiles) {
        case 'allow':
          break;
        case 'deny':
          this.error(403);
          return res;
        case 'ignore':
        default:
          this.error(404);
          return res;
      }
    }

    if (this._index.length > 0 && this.hasTrailingSlash()) {
      this.sendIndex(filePath);
      return res;
    }

    this.sendFile(filePath);
    return res;
  }

  /**
   * @param {string} filePath
   * @param {import('node:fs').Stats} stat
   */
  send(filePath, stat) {
    const options = this.options;
    const res = this.res;
    const req = this.req;

    if (res.headersSent) {
      this.headersAlreadySent();
      return;
    }

    debug('pipe "%s"', filePath);

    this.setHeader(filePath, stat);

    const etag = res.getHeader('ETag');
    const lastModified = res.getHeader('Last-Modified');

    if (this.isConditionalGET()) {
      if (this.isPreconditionFailure(etag, lastModified)) {
        this.error(412);
        return;
      }

      if (this.isCachable() && this.isFresh(etag, lastModified)) {
        this.notModified();
        return;
      }
    }

    this.type(filePath);

    const rangeHeader = req.headers.range;
    let offset = options.start || 0;
    let len = stat.size;

    len = Math.max(0, len - offset);
    if (options.end !== undefined) {
      const bytes = options.end - offset + 1;
      if (len > bytes) {
        len = bytes;
      }
    }

    if (this._acceptRanges && BYTES_RANGE_REGEXP.test(rangeHeader)) {
      let ranges = parseRange(len, rangeHeader, { combine: true });

      if (!this.isRangeFresh()) {
        debug('range stale');
        ranges = -2;
      }

      if (ranges === -1) {
        debug('range unsatisfiable');
        res.setHeader('Content-Range', contentRange('bytes', len));
        this.error(416, {
          headers: { 'Content-Range': res.getHeader('Content-Range') },
        });
        return;
      }

      if (ranges !== -2 && ranges.length === 1) {
        debug('range %o', ranges);
        res.statusCode = 206;
        res.setHeader('Content-Range', contentRange('bytes', len, ranges[0]));

        offset += ranges[0].start;
        len = ranges[0].end - ranges[0].start + 1;
      }
    }

    const opts = {
      ...options,
      end: Math.max(offset, offset + len - 1),
      start: offset,
    };

    res.setHeader('Content-Length', len);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    this.stream(filePath, opts);
  }

  /**
   * @param {string} filePath
   */
  sendFile(filePath) {
    let index = 0;

    debug('stat "%s"', filePath);
    fsStat(filePath, (error, stat) => {
      const pathEndsWithSep = filePath[filePath.length - 1] === sep;

      if (error && error.code === 'ENOENT' && !extname(filePath) && !pathEndsWithSep) {
        next(error);
        return;
      }

      if (error) {
        this.onStatError(error);
        return;
      }

      if (stat.isDirectory()) {
        this.redirect(filePath);
        return;
      }

      if (pathEndsWithSep) {
        this.error(404);
        return;
      }

      this.emit('file', filePath, stat);
      this.send(filePath, stat);
    });

    const next = (error) => {
      if (this._extensions.length <= index) {
        if (error) {
          this.onStatError(error);
        } else {
          this.error(404);
        }
        return;
      }

      const target = `${filePath}.${this._extensions[index++]}`;

      debug('stat "%s"', target);
      fsStat(target, (statError, stat) => {
        if (statError) {
          next(statError);
          return;
        }

        if (stat.isDirectory()) {
          next();
          return;
        }

        this.emit('file', target, stat);
        this.send(target, stat);
      });
    };
  }

  /**
   * @param {string} directoryPath
   */
  sendIndex(directoryPath) {
    let index = -1;

    const next = (error) => {
      index += 1;

      if (index >= this._index.length) {
        if (error) {
          this.onStatError(error);
        } else {
          this.error(404);
        }
        return;
      }

      const target = join(directoryPath, this._index[index]);

      debug('stat "%s"', target);
      fsStat(target, (statError, stat) => {
        if (statError) {
          next(statError);
          return;
        }

        if (stat.isDirectory()) {
          next();
          return;
        }

        this.emit('file', target, stat);
        this.send(target, stat);
      });
    };

    next();
  }

  /**
   * @param {string} filePath
   * @param {object} options
   */
  stream(filePath, options) {
    const res = this.res;
    const stream = createReadStream(filePath, options);

    this.emit('stream', stream);
    stream.pipe(res);

    const cleanup = () => {
      stream.destroy();
    };

    onFinished(res, cleanup);

    stream.on('error', error => {
      cleanup();
      this.onStatError(error);
    });

    stream.on('end', () => {
      this.emit('end');
    });
  }

  /**
   * @param {string} filePath
   */
  type(filePath) {
    const res = this.res;

    if (res.getHeader('Content-Type')) {
      return;
    }

    const type = mime.contentType(extname(filePath)) || 'application/octet-stream';

    debug('content-type %s', type);
    res.setHeader('Content-Type', type);
  }

  /**
   * @param {string} filePath
   * @param {import('node:fs').Stats} stat
   */
  setHeader(filePath, stat) {
    const res = this.res;

    this.emit('headers', res, filePath, stat);

    if (this._acceptRanges && !res.getHeader('Accept-Ranges')) {
      debug('accept ranges');
      res.setHeader('Accept-Ranges', 'bytes');
    }

    if (this._cacheControl && !res.getHeader('Cache-Control')) {
      debug('cache-control %s', this._cacheControlHeader);
      res.setHeader('Cache-Control', this._cacheControlHeader);
    }

    if (this._lastModified && !res.getHeader('Last-Modified')) {
      const modified = stat.mtime.toUTCString();
      debug('modified %s', modified);
      res.setHeader('Last-Modified', modified);
    }

    if (this._etag && !res.getHeader('ETag')) {
      const value = createEntityTag(stat);
      debug('etag %s', value);
      res.setHeader('ETag', value);
    }
  }
}

function clearHeaders(res) {
  for (const header of res.getHeaderNames()) {
    res.removeHeader(header);
  }
}

function containsDotFilePath(value) {
  let start = 0;

  for (let i = 0; i <= value.length; i += 1) {
    if (i !== value.length && value[i] !== sep) {
      continue;
    }

    if (i - start > 1 && value[start] === '.') {
      return true;
    }

    start = i + 1;
  }

  return false;
}

function contentRange(type, size, range) {
  return `${type} ${range ? `${range.start}-${range.end}` : '*'}/${size}`;
}

function createHttpError(status, err) {
  const error = err instanceof Error
    ? createError(status, err, { expose: false })
    : err
      ? createError(status, err)
      : createError(status);

  error.name = createStatusErrorName(status);
  return error;
}

function createStatusErrorName(status) {
  const message = STATUS_CODES[status] || 'Error';
  const name = message
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');

  return `${name || 'Http'}Error`;
}

function decode(filePath) {
  try {
    return decodeURIComponent(filePath);
  } catch {
    return -1;
  }
}

function normalizeList(value, name) {
  const list = Array.isArray(value)
    ? [...value]
    : value
      ? [value]
      : [];

  for (const item of list) {
    if (typeof item !== 'string') {
      throw new TypeError(`${name} must be array of strings or false`);
    }
  }

  return list;
}

function parseMaxAge(value) {
  if (typeof value === 'string') {
    value = parseDuration(value);
  } else {
    value = Number(value);
  }

  return Number.isNaN(value)
    ? 0
    : Math.min(Math.max(0, value), MAX_MAXAGE);
}

function parseDuration(value) {
  const match = /^(-?\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?$/i.exec(value);
  if (!match) {
    return Number.NaN;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  const multiplier = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365.25 * 24 * 60 * 60 * 1000,
  }[unit];

  return amount * multiplier;
}

function setHeaders(res, headers) {
  for (const name of Object.keys(headers)) {
    res.setHeader(name, headers[name]);
  }
}
