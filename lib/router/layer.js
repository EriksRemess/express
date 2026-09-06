/*!
 * express
 * MIT Licensed
 */

import { isPromiseLike, normalizeRejectedPromise, normalizeRequestPath } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { getOwnOption } from '#lib/utils/options';
import { match as matchPath } from 'path-to-regexp';

const debug = createDebug('router:layer');

const EMPTY_KEYS = [];
const STATIC_PATH_UNSAFE_REGEXP = /[\\:*{}()[\]?+!]/;
const TRAILING_SLASH_REGEXP = /\/+$/;

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
  this.slash = path === '/' && getOwnOption(options, 'end') === false;
  this.staticMatcher = !Array.isArray(path) && typeof path === 'string'
    ? createStaticMatcher(path, options)
    : undefined;

  this.matchers = this.staticMatcher
    ? undefined
    : Array.isArray(path)
      ? path.map(currentPath => createMatcher(currentPath, options))
      : [createMatcher(path, options)];
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
    const regexp = new RegExp(path.source, path.flags);
    const keys = getCaptureKeys(regexp);

    return function regexpMatcher(value) {
      regexp.lastIndex = 0;
      const result = regexp.exec(value);
      if (!result) {
        return false;
      }

      const params = Object.create(null);
      for (let i = 1; i < result.length; i += 1) {
        const prop = keys[i - 1];
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

  const strict = getOwnOption(options, 'strict');

  return matchPath(strict ? path : loosen(path), {
    sensitive: getOwnOption(options, 'sensitive'),
    end: getOwnOption(options, 'end'),
    trailing: !strict,
    decode: decodeParam,
  });
}

function getCaptureKeys(regexp) {
  const keys = [];
  const source = regexp.source;
  let name = 0;
  let classDepth = 0;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === '[' && (classDepth === 0 || regexp.unicodeSets)) {
      classDepth += 1;
      continue;
    }
    if (char === ']' && classDepth > 0) {
      classDepth -= 1;
      continue;
    }
    if (classDepth !== 0 || char !== '(') {
      continue;
    }
    if (source[i + 1] !== '?') {
      keys.push(name++);
    } else if (source[i + 2] === '<' && source[i + 3] !== '=' && source[i + 3] !== '!') {
      const end = source.indexOf('>', i + 3);
      keys.push(source.slice(i + 3, end).replace(/\\u(?:\{([\da-f]+)\}|([\da-f]{4}))/gi,
        (_, codePoint, codeUnit) => String.fromCodePoint(parseInt(codePoint || codeUnit, 16))));
      i = end;
    }
  }

  return keys;
}

function canUseStaticMatcher(path) {
  return !STATIC_PATH_UNSAFE_REGEXP.test(path);
}

function createStaticMatcher(path, options) {
  if (!canUseStaticMatcher(path)
    || (!getOwnOption(options, 'strict') && normalizeStaticPath(path, false) === '')) {
    return undefined;
  }

  return getOwnOption(options, 'end')
    ? createStaticRouteMatcher(path, options)
    : createStaticPrefixMatcher(path, options);
}

function createStaticRouteMatcher(path, options) {
  const strict = getOwnOption(options, 'strict');
  const sensitive = getOwnOption(options, 'sensitive');
  const normalizedPath = normalizeStaticPath(path, strict);
  const expectedPath = sensitive
    ? normalizedPath
    : normalizedPath.toLowerCase();

  return function staticRouteMatcher(value, pathState) {
    const candidate = getStaticCandidate(value, pathState, strict, sensitive);

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
  const strict = getOwnOption(options, 'strict');
  const sensitive = getOwnOption(options, 'sensitive');
  const normalizedPath = normalizeStaticPath(path, strict);
  const expectedPath = sensitive
    ? normalizedPath
    : normalizedPath.toLowerCase();
  const expectedLength = expectedPath.length;

  return function staticPrefixMatcher(value, pathState) {
    const candidate = getStaticCandidate(value, pathState, strict, sensitive);

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
      path: value.slice(0, normalizedPath.length),
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

  const normalizedValue = normalizeRequestPath(value, strict);
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
