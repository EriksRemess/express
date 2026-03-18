/*!
 * express
 * MIT Licensed
 */

import mime from 'mime-types';

const TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Check whether a request has a body matching one of the given types.
 *
 * @param {object} req
 * @param {...string|string[]} types_
 * @returns {string|false|null}
 */
export default function typeisRequest(req, ...types_) {
  if (!hasBody(req)) {
    return null;
  }

  const types = types_.length > 1
    ? types_
    : types_[0];

  return typeis(req.headers['content-type'], types);
}

/**
 * Check whether a content type value matches one of the given types.
 *
 * @param {string} value
 * @param {...string|string[]} types_
 * @returns {string|false}
 */
export function is(value, ...types_) {
  return typeis(value, ...types_);
}

/**
 * Determine whether a request has a body based on transfer-encoding or
 * content-length headers.
 *
 * @param {object} req
 * @returns {boolean}
 */
export function hasBody(req) {
  return req.headers['transfer-encoding'] !== undefined
    || !Number.isNaN(Number(req.headers['content-length']));
}

/**
 * Normalize shorthand or extension-like type values into full media types.
 *
 * @param {string} type
 * @returns {string|false}
 */
export function normalize(type) {
  if (typeof type !== 'string') {
    return false;
  }

  const normalized = type.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  switch (normalized) {
    case 'urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'multipart':
      return 'multipart/*';
    default:
      break;
  }

  if (normalized[0] === '+') {
    return `*/*${normalized}`;
  }

  return normalized.indexOf('/') === -1
    ? (mime.lookup(normalized) || false)
    : normalized;
}

/**
 * Compare an expected media range to an actual normalized media type.
 *
 * @param {string|false} expected
 * @param {string} actual
 * @returns {boolean}
 */
export function match(expected, actual) {
  if (expected === false) {
    return false;
  }

  const actualParts = actual.split('/');
  const expectedParts = expected.split('/');

  if (actualParts.length !== 2 || expectedParts.length !== 2) {
    return false;
  }

  if (expectedParts[0] !== '*' && expectedParts[0] !== actualParts[0]) {
    return false;
  }

  if (expectedParts[1].slice(0, 2) === '*+') {
    return actualParts[1].endsWith(expectedParts[1].slice(1));
  }

  if (expectedParts[1] !== '*' && expectedParts[1] !== actualParts[1]) {
    return false;
  }

  return true;
}

function typeis(value, ...types_) {
  let types = types_.length === 1 && Array.isArray(types_[0])
    ? types_[0]
    : types_;
  const normalizedValue = tryNormalizeType(value);

  if (!normalizedValue) {
    return false;
  }

  if (types_.length === 1 && !Array.isArray(types_[0]) && !types_[0]) {
    return normalizedValue;
  }

  if (!types || types.length === 0) {
    return normalizedValue;
  }

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const matcher = typeof type === 'string'
      ? type.trim()
      : '';

    if (match(normalize(type), normalizedValue)) {
      return matcher[0] === '+' || matcher.indexOf('*') !== -1
        ? normalizedValue
        : type;
    }
  }

  return false;
}

function normalizeType(value) {
  const type = String(value).split(';', 1)[0].trim().toLowerCase();
  return TYPE_REGEXP.test(type) ? type : null;
}

function tryNormalizeType(value) {
  try {
    return value ? normalizeType(value) : null;
  } catch {
    return null;
  }
}
