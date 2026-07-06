/*!
 * express
 * MIT Licensed
 */

import { getOwnOption } from "#lib/utils/options";

// Package-derived from content-disposition 2.x. Keep security fixes compared
// with upstream before intentionally diverging from this local copy.
const ENCODE_URL_ATTR_CHAR_REGEXP = /[\x00-\x20"'()*,/:;<=>?@[\\\]{}\x7f]/g;
const HEX_ESCAPE_REGEXP = /%[0-9A-Fa-f]{2}/;
const NON_ASCII_REGEXP = /[^\x20-\x7e]/g;
const QUOTE_REGEXP = /([\\"])/g;
const TEXT_REGEXP = /^[\x20-\x7e\x80-\xff]*$/;
const ASCII_TEXT_REGEXP = /^[\x20-\x7e]*$/;
const TOKEN_REGEXP = /^[!#$%&'*+.0-9A-Z^_`a-z|~-]+$/;

/**
 * Create a Content-Disposition header value.
 *
 * @param {string} [filename]
 * @param {{ fallback?: boolean|string, type?: string }} [options]
 * @returns {string}
 */
export default function contentDisposition(filename, options) {
  const opts = options || {};
  const type = String(getOwnOption(opts, 'type') || 'attachment').toLowerCase();

  if (!TOKEN_REGEXP.test(type)) {
    throw new TypeError('invalid type');
  }

  const params = createParams(filename, getOwnOption(opts, 'fallback'));
  if (!params) {
    return type;
  }

  const keys = Object.keys(params).sort();
  let value = type;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const param = key.endsWith('*')
      ? `UTF-8''${encodeRFC5987(params[key])}`
      : formatParamValue(String(params[key]));

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

  if (typeof fallback === 'string' && NON_ASCII_REGEXP.test(fallback)) {
    throw new TypeError('fallback must be US-ASCII string');
  }

  const name = baseName(filename);

  if (typeof fallback === 'string') {
    const fallbackName = baseName(fallback);
    if (fallbackName === name && !HEX_ESCAPE_REGEXP.test(name)) {
      return { filename: name };
    }

    return {
      filename: fallbackName,
      'filename*': name
    };
  }

  if (ASCII_TEXT_REGEXP.test(name) && !HEX_ESCAPE_REGEXP.test(name)) {
    return { filename: name };
  }

  if (fallback === false) {
    return { 'filename*': name };
  }

  return {
    filename: toAscii(name),
    'filename*': name
  };
}

function formatParamValue(value) {
  if (TOKEN_REGEXP.test(value)) {
    return value;
  }

  if (TEXT_REGEXP.test(value)) {
    return quote(value);
  }

  throw new TypeError('invalid parameter value');
}

function toAscii(value) {
  return String(value).replace(NON_ASCII_REGEXP, '?');
}

function baseName(value) {
  return String(value).split(/[/\\]/).pop();
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
