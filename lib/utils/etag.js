/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Stats } from 'node:fs';
import { getOwnOption } from '#lib/utils/options';

/**
 * Strong ETag generator for response bodies.
 *
 * @type {Function}
 */
export const strongEtag = createEtagGenerator({ weak: false });
/**
 * Weak ETag generator for response bodies.
 *
 * @type {Function}
 */
export const weakEtag = createEtagGenerator({ weak: true });

/**
 * Compile an application "etag" setting into an ETag generator function.
 *
 * @param {boolean|string|Function} val
 * @returns {Function|undefined}
 */
export function compileETag(val) {
  let fn;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'weak':
      fn = weakEtag;
      break;
    case false:
      break;
    case 'strong':
      fn = strongEtag;
      break;
    default:
      throw new TypeError(`unknown value for etag function: ${val}`);
  }

  return fn;
}

/**
 * Create a simple ETag.
 *
 * @param {string|Buffer|Stats} entity
 * @param {object} [options]
 * @param {boolean} [options.weak]
 * @returns {string}
 */
export default function createEntityTag(entity, options) {
  if (entity == null) {
    throw new TypeError('argument entity is required');
  }

  const isStats = isStatsObject(entity);
  const weakOption = getOwnOption(options, 'weak');
  const weak = typeof weakOption === 'boolean'
    ? weakOption
    : isStats;

  if (!isStats && typeof entity !== 'string' && !Buffer.isBuffer(entity)) {
    throw new TypeError('argument entity must be string, Buffer, or fs.Stats');
  }

  const tag = isStats
    ? createStatTagValue(entity)
    : createEntityTagValue(entity);

  return weak
    ? `W/${tag}`
    : tag;
}

/**
 * Create an ETag from an fs.Stats-like object.
 *
 * @param {Stats|object} stat
 * @param {object} [options]
 * @param {boolean} [options.weak]
 * @returns {string}
 */
export function createStatEntityTag(stat, options) {
  const weakOption = getOwnOption(options, 'weak');
  const weak = typeof weakOption === 'boolean'
    ? weakOption
    : true;

  const tag = createStatTagValue(stat);

  return weak
    ? `W/${tag}`
    : tag;
}

function createEntityTagValue(entity) {
  if (entity.length === 0) {
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  }

  const hash = crypto
    .createHash('sha1')
    .update(entity, 'utf8')
    .digest('base64')
    .substring(0, 27);

  const len = typeof entity === 'string'
    ? Buffer.byteLength(entity, 'utf8')
    : entity.length;

  return `"${len.toString(16)}-${hash}"`;
}

function isStatsObject(obj) {
  if (typeof Stats === 'function' && obj instanceof Stats) {
    return true;
  }

  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const ctime = getOwnOption(obj, 'ctime');
  const mtime = getOwnOption(obj, 'mtime');
  const ino = getOwnOption(obj, 'ino');
  const size = getOwnOption(obj, 'size');

  return ctime instanceof Date
    && mtime instanceof Date
    && typeof ino === 'number'
    && typeof size === 'number';
}

function createStatTagValue(stat) {
  const mtime = stat.mtime.getTime().toString(16);
  const size = stat.size.toString(16);

  return `"${size}-${mtime}"`;
}

function createEtagGenerator(options) {
  return function generateETag(body, encoding) {
    const buf = Buffer.isBuffer(body)
      ? body
      : Buffer.from(body, encoding);

    return createEntityTag(buf, options);
  };
}
