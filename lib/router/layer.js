/*!
 * express
 * MIT Licensed
 */

import { isPromiseLike, normalizeRejectedPromise } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { match as matchPath } from 'path-to-regexp';

const debug = createDebug('router:layer');

const EMPTY_KEYS = [];
const STATIC_PATH_UNSAFE_REGEXP = /[:*{}()[\]?+!]/;
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
  const isErrorHandler = fn.length === 4;

  this.handle = fn;
  this.handleError = isErrorHandler
    ? createErrorInvoker(fn)
    : passThroughError;
  this.handleRequest = isErrorHandler
    ? skipRequestHandler
    : createRequestInvoker(fn);
  this.isErrorHandler = isErrorHandler;
  this.keys = [];
  this.name = fn.name || '<anonymous>';
  this.params = undefined;
  this.path = undefined;
  this.slash = path === '/' && opts.end === false;
  this.staticMatcher = !Array.isArray(path) && typeof path === 'string'
    ? createStaticMatcher(path, opts)
    : undefined;

  this.matchers = this.staticMatcher
    ? undefined
    : Array.isArray(path)
      ? path.map(currentPath => createMatcher(currentPath, opts))
      : [createMatcher(path, opts)];
}

/**
 * Match this layer against a pathname.
 *
 * @param {string} path
 * @returns {boolean}
 */
Layer.prototype.match = function match(path, pathState) {
  let result;

  if (path != null) {
    if (this.slash) {
      this.params = Object.create(null);
      this.path = '';
      return true;
    }

    if (this.staticMatcher) {
      result = this.staticMatcher(path, pathState);
    } else {
      let index = 0;
      while (!result && index < this.matchers.length) {
        result = this.matchers[index](path);
        index += 1;
      }
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

      const params = Object.create(null);
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

function canUseStaticMatcher(path) {
  return !STATIC_PATH_UNSAFE_REGEXP.test(path);
}

function createStaticMatcher(path, options) {
  if (!canUseStaticMatcher(path)) {
    return undefined;
  }

  return options.end
    ? createStaticRouteMatcher(path, options)
    : createStaticPrefixMatcher(path, options);
}

function createStaticRouteMatcher(path, options) {
  const normalizedPath = normalizeStaticPath(path, options.strict);
  const expectedPath = options.sensitive
    ? normalizedPath
    : normalizedPath.toLowerCase();

  return function staticRouteMatcher(value, pathState) {
    const candidate = getStaticCandidate(value, pathState, options.strict, options.sensitive);

    if (candidate === undefined) {
      return false;
    }

    if (candidate !== expectedPath) {
      return false;
    }

    return {
      params: Object.create(null),
      path: value,
    };
  };
}

function createStaticPrefixMatcher(path, options) {
  const normalizedPath = normalizeStaticPath(path, options.strict);
  const expectedPath = options.sensitive
    ? normalizedPath
    : normalizedPath.toLowerCase();
  const expectedLength = expectedPath.length;

  return function staticPrefixMatcher(value, pathState) {
    const candidate = getStaticCandidate(value, pathState, options.strict, options.sensitive);

    if (candidate === undefined) {
      return false;
    }

    if (!candidate.startsWith(expectedPath)) {
      return false;
    }

    const boundary = candidate.charCodeAt(expectedLength);
    if (
      candidate.length !== expectedLength &&
      boundary !== 47
    ) {
      return false;
    }

    return {
      params: Object.create(null),
      path: normalizedPath,
    };
  };
}

function getStaticCandidate(value, pathState, strict, sensitive) {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (pathState && pathState.path === value) {
    if (strict) {
      return sensitive
        ? pathState.path
        : pathState.lowerPath;
    }

    return sensitive
      ? pathState.loosePath
      : pathState.lowerLoosePath;
  }

  const normalizedValue = normalizeStaticPath(value, strict);
  return sensitive
    ? normalizedValue
    : normalizedValue.toLowerCase();
}

function normalizeStaticPath(path, strict) {
  return strict || path.length <= 1
    ? path
    : path.replace(TRAILING_SLASH_REGEXP, '');
}

function createErrorInvoker(fn) {
  return function invokeError(error, req, res, next) {
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
}

function createRequestInvoker(fn) {
  return function invokeRequest(req, res, next) {
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
}

function passThroughError(error, req, res, next) {
  next(error);
}

function skipRequestHandler(req, res, next) {
  next();
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
