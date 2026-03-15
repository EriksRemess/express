/*!
 * express
 * MIT Licensed
 */

import { isPromiseLike, normalizeRejectedPromise } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { match as matchPath } from 'path-to-regexp';

const debug = createDebug('router:layer');

const EMPTY_KEYS = [];
const TRAILING_SLASH_REGEXP = /\/+$/;
const MATCHING_GROUP_REGEXP = /\((?:\?<(.*?)>)?(?!\?)/g;

/**
 * Layer wrapper around a route or middleware handler.
 *
 * @param {string|string[]|RegExp} path
 * @param {object} [options]
 * @param {Function} fn
 * @returns {Layer}
 */
export default function Layer(path, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(path, options, fn);
  }

  debug('new %o', path);

  const opts = options || {};

  this.handle = fn;
  this.keys = [];
  this.name = fn.name || '<anonymous>';
  this.params = undefined;
  this.path = undefined;
  this.slash = path === '/' && opts.end === false;

  this.matchers = Array.isArray(path)
    ? path.map(currentPath => createMatcher(currentPath, opts))
    : [createMatcher(path, opts)];
}

/**
 * Handle an error through this layer.
 *
 * @param {Error} error
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 */
Layer.prototype.handleError = function handleError(error, req, res, next) {
  const fn = this.handle;

  if (fn.length !== 4) {
    next(error);
    return;
  }

  try {
    const result = fn(error, req, res, next);

    if (isPromiseLike(result)) {
      Promise.resolve(result).then(undefined, rejection => {
        next(normalizeRejectedPromise(rejection));
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Handle a request through this layer.
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 */
Layer.prototype.handleRequest = function handleRequest(req, res, next) {
  const fn = this.handle;

  if (fn.length > 3) {
    next();
    return;
  }

  try {
    const result = fn(req, res, next);

    if (isPromiseLike(result)) {
      Promise.resolve(result).then(undefined, rejection => {
        next(normalizeRejectedPromise(rejection));
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Match this layer against a pathname.
 *
 * @param {string} path
 * @returns {boolean}
 */
Layer.prototype.match = function match(path) {
  let result;

  if (path != null) {
    if (this.slash) {
      this.params = {};
      this.path = '';
      return true;
    }

    let index = 0;
    while (!result && index < this.matchers.length) {
      result = this.matchers[index](path);
      index += 1;
    }
  }

  if (!result) {
    this.params = undefined;
    this.path = undefined;
    return false;
  }

  const params = result.params;
  const keys = Object.keys(params);

  this.params = params;
  this.path = result.path;
  this.keys = keys.length === 0 ? EMPTY_KEYS : keys;

  return true;
};

function createMatcher(path, options) {
  if (path instanceof RegExp) {
    const keys = [];
    let name = 0;
    let match;

    MATCHING_GROUP_REGEXP.lastIndex = 0;

    while ((match = MATCHING_GROUP_REGEXP.exec(path.source)) !== null) {
      keys.push({
        name: match[1] || name++,
        offset: match.index,
      });
    }

    return function regexpMatcher(value) {
      const result = path.exec(value);
      if (!result) {
        return false;
      }

      const params = {};
      for (let i = 1; i < result.length; i += 1) {
        const key = keys[i - 1];
        const prop = key.name;
        const paramValue = decodeParam(result[i]);

        if (paramValue !== undefined) {
          params[prop] = paramValue;
        }
      }

      return {
        params,
        path: result[0],
      };
    };
  }

  return matchPath(options.strict ? path : loosen(path), {
    sensitive: options.sensitive,
    end: options.end,
    trailing: !options.strict,
    decode: decodeParam,
  });
}

function decodeParam(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      error.message = `Failed to decode param '${value}'`;
      error.status = 400;
    }

    throw error;
  }
}

function loosen(path) {
  if (path instanceof RegExp || path === '/') {
    return path;
  }

  return Array.isArray(path)
    ? path.map(loosen)
    : String(path).replace(TRAILING_SLASH_REGEXP, '');
}
