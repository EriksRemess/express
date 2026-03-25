/*!
 * express
 * MIT Licensed
 */

import { URL } from 'node:url';

const DEFAULT_KEY = '_method';
const METHOD_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Z-]+$/;

/**
 * Minimal method-override middleware.
 *
 * Supports:
 * - string getter key (query param name),
 * - function getter(req, res) -> method.
 *
 * Only overrides POST requests.
 *
 * @param {string|function} [getter]
 * @returns {import('express').RequestHandler}
 */
export default function methodOverride(getter = DEFAULT_KEY) {
  if (typeof getter !== 'string' && typeof getter !== 'function') {
    throw new TypeError('methodOverride getter must be a string or function');
  }

  const getOverride = typeof getter === 'function'
    ? getter
    : (req) => getQueryMethod(req, getter);

  return (req, res, next) => {
    if (req.method !== 'POST') {
      return next();
    }

    const method = getOverride(req, res);
    if (typeof method !== 'string' || method.length === 0) {
      return next();
    }

    const upper = method.toUpperCase();
    if (!METHOD_REGEXP.test(upper)) {
      return next();
    }

    req.originalMethod = req.method;
    req.method = upper;
    return next();
  };
}

function getQueryMethod(req, key) {
  const url = req.url;
  if (typeof url !== 'string' || url.length === 0) {
    return undefined;
  }

  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get(key) || undefined;
}
