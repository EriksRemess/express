/*!
 * express
 * MIT Licensed
 */

import createDebug from '#lib/utils/debug';
import encodeUrl from '#lib/utils/encode-url';
import escapeHtml from '#lib/utils/escape-html';
import { createStatEntityTag } from '#lib/utils/etag';
import { hasMatchingEtag, isFresh } from '#lib/utils/fresh';
import createHtmlDocument from '#lib/utils/html-document';
import createError from '#lib/utils/http-errors';
import { parseHttpDate } from '#lib/utils/http-parsing';
import onFinished from '#lib/utils/on-finished';
import parseRange from '#lib/utils/range-parser';
import { collapseLeadingSlashes } from '#lib/utils/url-path';
import mime from 'mime-types';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { createReadStream, realpath, stat as fsStat } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import path from 'node:path';

const debug = createDebug('send');
const { extname, join, normalize, resolve, sep } = path;

const BYTES_RANGE_REGEXP = /^ *bytes=/;
const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000;
const DEFAULT_INDEX = Object.freeze(['index.html']);
const EMPTY_LIST = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});
const NORMALIZED_OPTIONS = Symbol('normalized send options');
const REAL_ROOT_CACHE_MAX = 256;
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const fsRealpath = realpath.native;
const realRootCache = new Map();

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

export function normalizeSendOptions(options) {
  if (hasOwnProperty(options, NORMALIZED_OPTIONS)) {
    return options;
  }

  const opts = options || EMPTY_OBJECT;
  const dotfiles = opts.dotfiles !== undefined
    ? opts.dotfiles
    : 'ignore';

  if (dotfiles !== 'ignore' && dotfiles !== 'allow' && dotfiles !== 'deny') {
    throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"');
  }

  const maxage = parseMaxAge(opts.maxAge ?? opts.maxage);
  const immutable = opts.immutable !== undefined
    ? Boolean(opts.immutable)
    : false;

  opts[NORMALIZED_OPTIONS] = {
    acceptRanges: opts.acceptRanges !== undefined
      ? Boolean(opts.acceptRanges)
      : true,
    cacheControl: opts.cacheControl !== undefined
      ? Boolean(opts.cacheControl)
      : true,
    cacheControlHeader: createCacheControlHeader(maxage, immutable),
    dotfiles,
    etag: opts.etag !== undefined
      ? Boolean(opts.etag)
      : true,
    extensions: opts.extensions !== undefined
      ? normalizeList(opts.extensions, 'extensions option')
      : EMPTY_LIST,
    immutable,
    index: opts.index !== undefined
      ? normalizeList(opts.index, 'index option')
      : DEFAULT_INDEX,
    lastModified: opts.lastModified !== undefined
      ? Boolean(opts.lastModified)
      : true,
    maxage,
    root: opts.root
      ? resolve(opts.root)
      : null,
  };

  return opts;
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
    const opts = options || EMPTY_OBJECT;
    const normalized = hasOwnProperty(opts, NORMALIZED_OPTIONS)
      ? opts[NORMALIZED_OPTIONS]
      : null;
    const dotfiles = normalized
      ? normalized.dotfiles
      : (opts.dotfiles !== undefined ? opts.dotfiles : 'ignore');

    if (dotfiles !== 'ignore' && dotfiles !== 'allow' && dotfiles !== 'deny') {
      throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"');
    }

    const immutable = normalized
      ? normalized.immutable
      : (opts.immutable !== undefined ? Boolean(opts.immutable) : false);
    const maxage = normalized
      ? normalized.maxage
      : parseMaxAge(opts.maxAge ?? opts.maxage);

    this.options = opts;
    this.path = filePath;
    this.req = req;
    this._headers = req.headers;
    this._acceptRanges = normalized
      ? normalized.acceptRanges
      : (opts.acceptRanges !== undefined ? Boolean(opts.acceptRanges) : true);
    this._cacheControl = normalized
      ? normalized.cacheControl
      : (opts.cacheControl !== undefined ? Boolean(opts.cacheControl) : true);
    this._cacheControlHeader = normalized
      ? normalized.cacheControlHeader
      : createCacheControlHeader(maxage, immutable);
    this._conditionalGET = hasConditionalHeaders(this._headers);
    this._dotfiles = dotfiles;
    this._etag = normalized
      ? normalized.etag
      : (opts.etag !== undefined ? Boolean(opts.etag) : true);
    this._extensions = normalized
      ? normalized.extensions
      : (opts.extensions !== undefined ? normalizeList(opts.extensions, 'extensions option') : EMPTY_LIST);
    this._hasTrailingSlash = filePath[filePath.length - 1] === '/';
    this._index = normalized
      ? normalized.index
      : (opts.index !== undefined ? normalizeList(opts.index, 'index option') : DEFAULT_INDEX);
    this._lastModified = normalized
      ? normalized.lastModified
      : (opts.lastModified !== undefined ? Boolean(opts.lastModified) : true);
    this._lastModifiedValue = undefined;
    this._etagValue = undefined;
    this._realRoot = undefined;
    this._realRootCallbacks = undefined;
    this._root = normalized
      ? normalized.root
      : (opts.root ? resolve(opts.root) : null);
    this._start = this.options.start || 0;
    this._end = this.options.end;
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
    return this._hasTrailingSlash;
  }

  /**
   * @returns {boolean}
   */
  isConditionalGET() {
    return this._conditionalGET;
  }

  /**
   * @returns {boolean}
   */
  isPreconditionFailure(etag, lastModified) {
    const match = this._headers['if-match'];

    if (match) {
      if (!etag) {
        return true;
      }

      if (isAnyEtagValue(match)) {
        return false;
      }

      return !hasMatchingEtag(match, etag);
    }

    const unmodifiedSince = parseHttpDate(this._headers['if-unmodified-since']);
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
    return isFresh(this._headers, etag, lastModified);
  }

  /**
   * @returns {boolean}
   */
  isRangeFresh(etag, lastModified) {
    const ifRange = this._headers['if-range'];

    if (!ifRange) {
      return true;
    }

    if (ifRange.includes('"')) {
      return Boolean(etag && ifRange.includes(etag));
    }

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
  send(filePath, stat, streamPath = filePath) {
    const res = this.res;
    const req = this.req;

    if (res.headersSent) {
      this.headersAlreadySent();
      return;
    }

    debug('pipe "%s"', filePath);

    this.setHeader(filePath, stat);

    const etag = this._etagValue;
    const lastModified = this._lastModifiedValue;

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

    const rangeHeader = this._headers.range;
    let offset = this._start;
    let len = stat.size;

    len = Math.max(0, len - offset);
    if (this._end !== undefined) {
      const bytes = this._end - offset + 1;
      if (len > bytes) {
        len = bytes;
      }
    }

    if (this._acceptRanges && BYTES_RANGE_REGEXP.test(rangeHeader)) {
      let ranges = parseRange(len, rangeHeader, { combine: true });

      if (!this.isRangeFresh(etag, lastModified)) {
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

    res.setHeader('Content-Length', len);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    this.stream(streamPath, this.createStreamOptions(offset, len));
  }

  /**
   * @param {string} filePath
   */
  sendFile(filePath) {
    let index = 0;
    const pathEndsWithSep = filePath[filePath.length - 1] === sep;

    debug('stat "%s"', filePath);
    fsStat(filePath, (error, stat) => {
      if (error && error.code === 'ENOENT' && !extname(filePath) && !pathEndsWithSep) {
        next(error);
        return;
      }

      if (error) {
        this.onStatError(error);
        return;
      }

      this.withinRoot(filePath, (rootError, contained, realPath) => {
        if (rootError) {
          this.onStatError(rootError);
          return;
        }

        if (!contained) {
          this.error(403);
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
        this.send(filePath, stat, realPath);
      });
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

        this.withinRoot(target, (rootError, contained, realPath) => {
          if (rootError) {
            this.onStatError(rootError);
            return;
          }

          if (!contained) {
            this.error(403);
            return;
          }

          if (stat.isDirectory()) {
            next();
            return;
          }

          this.emit('file', target, stat);
          this.send(target, stat, realPath);
        });
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

        this.withinRoot(target, (rootError, contained, realPath) => {
          if (rootError) {
            this.onStatError(rootError);
            return;
          }

          if (!contained) {
            this.error(403);
            return;
          }

          if (stat.isDirectory()) {
            next();
            return;
          }

          this.emit('file', target, stat);
          this.send(target, stat, realPath);
        });
      });
    };

    next();
  }

  /**
   * @param {string} filePath
   * @param {(error: NodeJS.ErrnoException | null, contained: boolean, realPath?: string) => void} callback
   */
  withinRoot(filePath, callback) {
    if (this._root === null) {
      callback(null, true, filePath);
      return;
    }

    this.getRealRoot((rootError, realRoot) => {
      if (rootError) {
        callback(rootError, false);
        return;
      }

      fsRealpath(filePath, (pathError, realPath) => {
        if (pathError) {
          callback(pathError, false);
          return;
        }

        callback(null, isSubpath(realRoot, realPath), realPath);
      });
    });
  }

  /**
   * @param {(error: NodeJS.ErrnoException | null, realRoot?: string) => void} callback
   */
  getRealRoot(callback) {
    if (this._root === null) {
      callback(null, undefined);
      return;
    }

    if (typeof this._realRoot === 'string') {
      callback(null, this._realRoot);
      return;
    }

    const cachedRoot = getCachedRealRoot(this._root);
    if (cachedRoot) {
      this._realRoot = cachedRoot;
      callback(null, cachedRoot);
      return;
    }

    if (this._realRootCallbacks) {
      this._realRootCallbacks.push(callback);
      return;
    }

    this._realRootCallbacks = [callback];

    resolveRealRoot(this._root, (error, realRoot) => {
      const callbacks = this._realRootCallbacks;
      this._realRootCallbacks = undefined;

      if (!error) {
        this._realRoot = realRoot;
      }

      for (let i = 0; i < callbacks.length; i += 1) {
        callbacks[i](error, realRoot);
      }
    });
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

    let lastModified = res.getHeader('Last-Modified');
    if (this._lastModified && !lastModified) {
      lastModified = stat.mtime.toUTCString();
      const modified = lastModified;
      debug('modified %s', modified);
      res.setHeader('Last-Modified', modified);
    }

    let etag = res.getHeader('ETag');
    if (this._etag && !etag) {
      etag = createStatEntityTag(stat);
      const value = etag;
      debug('etag %s', value);
      res.setHeader('ETag', value);
    }

    this._etagValue = etag;
    this._lastModifiedValue = lastModified;
  }

  createStreamOptions(start, len) {
    const end = Math.max(start, start + len - 1);

    if (this.options === EMPTY_OBJECT) {
      return {
        end,
        start,
      };
    }

    const options = {};

    for (const prop in this.options) {
      options[prop] = this.options[prop];
    }

    options.end = end;
    options.start = start;
    return options;
  }
}

function createCacheControlHeader(maxage, immutable) {
  const seconds = Math.floor(maxage / 1000);
  return immutable
    ? `public, max-age=${seconds}, immutable`
    : `public, max-age=${seconds}`;
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

function hasConditionalHeaders(headers) {
  return Boolean(
    headers['if-match']
    || headers['if-unmodified-since']
    || headers['if-none-match']
    || headers['if-modified-since'],
  );
}

function isAnyEtagValue(value) {
  if (Array.isArray(value)) {
    value = value.join(',');
  }

  if (typeof value !== 'string') {
    return false;
  }

  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) === 0x20) {
    start += 1;
  }

  while (end > start && value.charCodeAt(end - 1) === 0x20) {
    end -= 1;
  }

  return start + 1 === end && value.charCodeAt(start) === 0x2a;
}

function isSubpath(root, loc) {
  const rel = path.relative(root, loc);
  return rel === ''
    || (rel !== '..' && !rel.startsWith(`..${sep}`) && !path.isAbsolute(rel));
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
      : EMPTY_LIST;

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

function getCachedRealRoot(root) {
  const cached = realRootCache.get(root);
  return typeof cached === 'string' ? cached : undefined;
}

function resolveRealRoot(root, callback) {
  const cached = realRootCache.get(root);

  if (typeof cached === 'string') {
    callback(null, cached);
    return;
  }

  if (cached) {
    cached.push(callback);
    return;
  }

  const callbacks = [callback];
  realRootCache.set(root, callbacks);

  fsRealpath(root, (error, realRoot) => {
    if (error || realRoot !== root) {
      realRootCache.delete(root);
    } else {
      realRootCache.set(root, realRoot);
      trimRealRootCache(root);
    }

    for (let i = 0; i < callbacks.length; i += 1) {
      callbacks[i](error, realRoot);
    }
  });
}

function trimRealRootCache(currentRoot) {
  if (realRootCache.size <= REAL_ROOT_CACHE_MAX) {
    return;
  }

  for (const [root, cached] of realRootCache) {
    if (root === currentRoot || typeof cached !== 'string') {
      continue;
    }

    realRootCache.delete(root);
    if (realRootCache.size <= REAL_ROOT_CACHE_MAX) {
      return;
    }
  }
}

function setHeaders(res, headers) {
  for (const name of Object.keys(headers)) {
    res.setHeader(name, headers[name]);
  }
}

function hasOwnProperty(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}
