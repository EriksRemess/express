/*!
 * express
 * MIT Licensed
 */

import { basename } from 'node:path';

const ENCODE_URL_ATTR_CHAR_REGEXP = /[\x00-\x20"'()*,/:;<=>?@[\\\]{}\x7f]/g;
const HEX_ESCAPE_REGEXP = /%[0-9A-Fa-f]{2}/;
const NON_LATIN1_REGEXP = /[^\x20-\x7e\xa0-\xff]/g;
const QUOTE_REGEXP = /([\\"])/g;
const TEXT_REGEXP = /^[\x20-\x7e\x80-\xff]+$/;
const TOKEN_REGEXP = /^[!#$%&'*+.0-9A-Z^_`a-z|~-]+$/;

export default function contentDisposition(filename, options) {
  const opts = options || {};
  const type = String(opts.type || 'attachment').toLowerCase();

  if (!TOKEN_REGEXP.test(type)) {
    throw new TypeError('invalid type');
  }

  const params = createParams(filename, opts.fallback);
  if (!params) {
    return type;
  }

  const keys = Object.keys(params).sort();
  let value = type;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const param = key.endsWith('*')
      ? `UTF-8''${encodeRFC5987(params[key])}`
      : quote(String(params[key]));

    value += `; ${key}=${param}`;
  }

  return value;
}

function createParams(filename, fallback) {
  if (filename === undefined) {
    return undefined;
  }

  if (typeof filename !== 'string') {
    throw new TypeError('filename must be a string');
  }

  if (fallback === undefined) {
    fallback = true;
  }

  if (typeof fallback !== 'string' && typeof fallback !== 'boolean') {
    throw new TypeError('fallback must be a string or boolean');
  }

  if (typeof fallback === 'string' && NON_LATIN1_REGEXP.test(fallback)) {
    throw new TypeError('fallback must be ISO-8859-1 string');
  }

  const name = basename(filename);
  const isQuotedString = TEXT_REGEXP.test(name);
  const fallbackName = typeof fallback === 'string'
    ? basename(fallback)
    : (fallback ? toLatin1(name) : undefined);
  const hasFallback = typeof fallbackName === 'string' && fallbackName !== name;

  const params = Object.create(null);

  if (hasFallback || !isQuotedString || HEX_ESCAPE_REGEXP.test(name)) {
    params['filename*'] = name;
  }

  if (isQuotedString || hasFallback) {
    params.filename = hasFallback ? fallbackName : name;
  }

  return Object.keys(params).length === 0 ? undefined : params;
}

function encodeRFC5987(value) {
  return encodeURIComponent(String(value))
    .replace(ENCODE_URL_ATTR_CHAR_REGEXP, (char) => {
      return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
    });
}

function quote(value) {
  return `"${value.replace(QUOTE_REGEXP, '\\$1')}"`;
}

function toLatin1(value) {
  return String(value).replace(NON_LATIN1_REGEXP, '?');
}
