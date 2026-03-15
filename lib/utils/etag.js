/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Stats } from 'node:fs';

const toString = Object.prototype.toString;

/**
 * Create a simple ETag.
 *
 * @param {string|Buffer|Stats} entity
 * @param {object} [options]
 * @param {boolean} [options.weak]
 * @returns {string}
 */
export default function etag(entity, options) {
  if (entity == null) {
    throw new TypeError('argument entity is required');
  }

  const isStats = isstats(entity);
  const weak = options && typeof options.weak === 'boolean'
    ? options.weak
    : isStats;

  if (!isStats && typeof entity !== 'string' && !Buffer.isBuffer(entity)) {
    throw new TypeError('argument entity must be string, Buffer, or fs.Stats');
  }

  const tag = isStats
    ? stattag(entity)
    : entitytag(entity);

  return weak
    ? `W/${tag}`
    : tag;
}

function entitytag(entity) {
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

function isstats(obj) {
  if (typeof Stats === 'function' && obj instanceof Stats) {
    return true;
  }

  return obj && typeof obj === 'object'
    && 'ctime' in obj && toString.call(obj.ctime) === '[object Date]'
    && 'mtime' in obj && toString.call(obj.mtime) === '[object Date]'
    && 'ino' in obj && typeof obj.ino === 'number'
    && 'size' in obj && typeof obj.size === 'number';
}

function stattag(stat) {
  const mtime = stat.mtime.getTime().toString(16);
  const size = stat.size.toString(16);

  return `"${size}-${mtime}"`;
}
