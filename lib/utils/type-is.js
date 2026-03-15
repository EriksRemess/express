/*!
 * express
 * MIT Licensed
 */

import mime from 'mime-types';

const TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export default function typeisRequest(req, types_) {
  if (!hasBody(req)) {
    return null;
  }

  const types = arguments.length > 2
    ? Array.prototype.slice.call(arguments, 1)
    : types_;

  return typeis(req.headers['content-type'], types);
}

export function is(value, types_) {
  return typeis(value, types_);
}

export function hasBody(req) {
  return req.headers['transfer-encoding'] !== undefined
    || !Number.isNaN(Number(req.headers['content-length']));
}

export function normalize(type) {
  if (typeof type !== 'string') {
    return false;
  }

  switch (type) {
    case 'urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'multipart':
      return 'multipart/*';
    default:
      break;
  }

  if (type[0] === '+') {
    return `*/*${type}`;
  }

  return type.indexOf('/') === -1
    ? (mime.lookup(type) || false)
    : type;
}

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
    return expectedParts[1].length <= actualParts[1].length + 1
      && expectedParts[1].slice(1) === actualParts[1].slice(1 - expectedParts[1].length);
  }

  if (expectedParts[1] !== '*' && expectedParts[1] !== actualParts[1]) {
    return false;
  }

  return true;
}

function typeis(value, types_) {
  let types = types_;
  const normalizedValue = tryNormalizeType(value);

  if (!normalizedValue) {
    return false;
  }

  if (types && !Array.isArray(types)) {
    types = new Array(arguments.length - 1);
    for (let i = 0; i < types.length; i++) {
      types[i] = arguments[i + 1];
    }
  }

  if (!types || types.length === 0) {
    return normalizedValue;
  }

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    if (match(normalize(type), normalizedValue)) {
      return type[0] === '+' || type.indexOf('*') !== -1
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
