/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @api private
 */

import { Buffer } from "node:buffer";
import { METHODS } from "node:http";
import querystring from "node:querystring";
import etagLib from "#lib/utils/etag";
import mime from "mime-types";
import proxyaddr from "#lib/utils/proxy-addr";

/**
 * A list of lowercased HTTP methods that are supported by Node.js.
 * @api private
 */
export const methods = METHODS.map((method) => method.toLowerCase());

/**
 * Return strong ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

export const etag = createETagGenerator({ weak: false });

/**
 * Return weak ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

export const wetag = createETagGenerator({ weak: true });

/**
 * Normalize the given `type`, for example "html" becomes "text/html".
 *
 * @param {String} type
 * @return {Object}
 * @api private
 */

export function normalizeType(type) {
  return ~type.indexOf('/')
    ? acceptParams(type)
    : { value: (mime.lookup(type) || 'application/octet-stream'), params: {} }
}

/**
 * Normalize `types`, for example "html" becomes "text/html".
 *
 * @param {Array} types
 * @return {Array}
 * @api private
 */

export function normalizeTypes(types) {
  return types.map(normalizeType);
}


/**
 * Parse accept params `str` returning an
 * object with `.value`, `.quality` and `.params`.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function acceptParams (str) {
  const length = str.length;
  let colonIndex = str.indexOf(';');
  let index = colonIndex === -1 ? length : colonIndex;
  const ret = { value: str.slice(0, index).trim(), quality: 1, params: {} };

  while (index < length) {
    const splitIndex = str.indexOf('=', index);
    if (splitIndex === -1) break;

    colonIndex = str.indexOf(';', index);
    const endIndex = colonIndex === -1 ? length : colonIndex;

    if (splitIndex > endIndex) {
      index = str.lastIndexOf(';', splitIndex - 1) + 1;
      continue;
    }

    const key = str.slice(index, splitIndex).trim();
    const value = str.slice(splitIndex + 1, endIndex).trim();

    if (key === 'q') {
      ret.quality = parseFloat(value);
    } else {
      ret.params[key] = value;
    }

    index = endIndex + 1;
  }

  return ret;
}

/**
 * Compile "etag" value to function.
 *
 * @param  {Boolean|String|Function} val
 * @return {Function}
 * @api private
 */

export function compileETag(val) {
  let fn;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'weak':
      fn = wetag;
      break;
    case false:
      break;
    case 'strong':
      fn = etag;
      break;
    default:
      throw new TypeError('unknown value for etag function: ' + val);
  }

  return fn;
}

/**
 * Compile "query parser" value to function.
 *
 * @param  {String|Function} val
 * @return {Function}
 * @api private
 */

export function compileQueryParser(val) {
  let fn;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'simple':
      fn = querystring.parse;
      break;
    case false:
      break;
    case 'extended':
      fn = parseExtendedQueryString;
      break;
    default:
      throw new TypeError('unknown value for query parser function: ' + val);
  }

  return fn;
}

/**
 * Compile "proxy trust" value to function.
 *
 * @param  {Boolean|String|Number|Array|Function} val
 * @return {Function}
 * @api private
 */

export function compileTrust(val) {
  if (typeof val === 'function') return val;

  if (val === true) {
    // Support plain true/false
    return () => { return true };
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return (a, i) => { return i < val };
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(',')
      .map(v => { return v.trim() })
  }

  return proxyaddr.compile(val || []);
}

/**
 * Set the charset in a given Content-Type string.
 *
 * @param {String} type
 * @param {String} charset
 * @return {String}
 * @api private
 */

export function setCharset(type, charset) {
  if (!type || !charset) {
    return type;
  }

  const segments = String(type).split(';');
  const mediaType = segments.shift().trim();

  if (mediaType.length === 0) {
    throw new TypeError('invalid media type');
  }

  const params = [];
  for (let i = 0; i < segments.length; i++) {
    const value = segments[i].trim();
    if (!value || /^charset\s*=/i.test(value)) {
      continue;
    }

    params.push(value);
  }

  params.push(`charset=${charset}`);
  return `${mediaType}; ${params.join('; ')}`;
}

/**
 * Create an ETag generator function, generating ETags with
 * the given options.
 *
 * @param {object} options
 * @return {function}
 * @private
 */

function createETagGenerator (options) {
  return function generateETag (body, encoding) {
    const buf = !Buffer.isBuffer(body)
      ? Buffer.from(body, encoding)
      : body;

    return etagLib(buf, options)
  };
}

/**
 * Parse an extended query string with qs.
 *
 * @param {String} str
 * @return {Object}
 * @private
 */

function parseExtendedQueryString(str) {
  const query = Object.create(null);

  for (const [key, value] of new URLSearchParams(str)) {
    assignQueryValue(query, parseQueryPath(key), value);
  }

  return query;
}

function parseQueryPath(key) {
  const path = [];
  let index = key.indexOf('[');

  if (index === -1) {
    path.push(key);
    return path;
  }

  path.push(key.substring(0, index));

  while (index < key.length) {
    if (key.charCodeAt(index) !== 0x5b) { // [
      break;
    }

    const end = key.indexOf(']', index + 1);
    if (end === -1) {
      path.push(key.substring(index + 1));
      break;
    }

    path.push(key.substring(index + 1, end));
    index = end + 1;
  }

  return path;
}

function assignQueryValue(root, path, value) {
  let current = root;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const isLast = i === path.length - 1;

    if (isLast) {
      setFinalValue(current, segment, value);
      return;
    }

    const next = path[i + 1];
    const container = shouldUseArray(next)
      ? []
      : Object.create(null);

    if (segment === '') {
      if (!Array.isArray(current)) {
        return;
      }

      current.push(container);
      current = container;
      continue;
    }

    if (Array.isArray(current) && isArrayIndex(segment)) {
      const index = Number(segment);
      if (!isObjectLike(current[index])) {
        current[index] = container;
      }
      current = current[index];
      continue;
    }

    if (!isObjectLike(current[segment])) {
      current[segment] = container;
    }

    current = current[segment];
  }
}

function setFinalValue(target, segment, value) {
  if (segment === '') {
    if (Array.isArray(target)) {
      target.push(value);
    }
    return;
  }

  if (Array.isArray(target) && isArrayIndex(segment)) {
    const index = Number(segment);
    if (target[index] === undefined) {
      target[index] = value;
      return;
    }

    if (Array.isArray(target[index])) {
      target[index].push(value);
      return;
    }

    target[index] = [target[index], value];
    return;
  }

  if (target[segment] === undefined) {
    target[segment] = value;
    return;
  }

  if (Array.isArray(target[segment])) {
    target[segment].push(value);
    return;
  }

  target[segment] = [target[segment], value];
}

function shouldUseArray(segment) {
  return segment === '' || isArrayIndex(segment);
}

function isArrayIndex(segment) {
  return /^[0-9]+$/.test(segment);
}

function isObjectLike(value) {
  return value !== null && typeof value === 'object';
}

export default {
  methods,
  etag,
  wetag,
  normalizeType,
  normalizeTypes,
  compileETag,
  compileQueryParser,
  compileTrust,
  setCharset
};
