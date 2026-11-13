/*!
 * express
 * MIT Licensed
 */

import Layer from '#lib/router/layer';
import Route from '#lib/router/route';
import { canonicalizePathCase, flattenHandlers, isPromiseLike, normalizeRejectedPromise, normalizeRequestPath } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { setContentLength } from '#lib/utils/http-framing';
import { httpMethods } from '#lib/utils/methods';
import { getOwnOption } from '#lib/utils/options';
import parseUrl, { getProtohost } from '#lib/utils/parseurl';
import { Buffer } from 'node:buffer';

const debug = createDebug('router');
const FAST_PATH_UNSAFE_REGEXP = /[\\:*{}()[\]?+!]/;
const PATH_INDEX_MIN_LAYERS = 8;

/**
 * Create a callable router instance.
 *
 * @param {object} [options]
 * @returns {Router}
 */
export default function Router(options) {
  function router(req, res, next) {
    router.handle(req, res, next);
  }

  Object.setPrototypeOf(router, this instanceof Router ? this : Router.prototype);
  router.caseSensitive = getOwnOption(options, 'caseSensitive');
  router.mergeParams = getOwnOption(options, 'mergeParams');
  router.params = Object.create(null);
  router.strict = getOwnOption(options, 'strict');
  router.stack = [];
  router._fastPathEnabled = true;
  router._fastPathStackByPath = Object.create(null);
  router._lastPathGroup = undefined;
  router._pathGroups = [];

  return router;
}

Object.setPrototypeOf(Router.prototype, Function.prototype);
Router.Route = Route;

Object.defineProperties(Router.prototype, createRouterMethodDescriptors());

/**
 * @param {string} name
 * @param {Function} fn
 * @returns {Router}
 */
function param(name, fn) {
  if (!name) {
    throw new TypeError('argument name is required');
  }

  if (typeof name !== 'string') {
    throw new TypeError('argument name must be a string');
  }

  if (!fn) {
    throw new TypeError('argument fn is required');
  }

  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function');
  }

  const params = this.params[name] || (this.params[name] = []);
  params.push(fn);

  return this;
}

/**
 * @param {object} req
 * @param {object} res
 * @param {Function} callback
 */
function handle(req, res, callback) {
  if (!callback) {
    throw new TypeError('argument callback is required');
  }

  debug('dispatching %s %s', req.method, req.url);

  let index = 0;
  let methods;
  const protohost = getProtohost(req.url) || '';
  let pathState;
  let pathname;
  let pathnameUrl;
  let removed = '';
  let slashAdded = false;
  let sync = 0;
  const paramcalled = Object.create(null);
  const { stack } = this;
  const pathGroups = this._pathGroups.length === 0
    ? null
    : this._pathGroups;
  const parentParams = req.params;
  const parentUrl = Object.hasOwn(req, 'baseUrl')
    ? (req.baseUrl || '')
    : '';
  const self = this;
  let done = restoreRequestState(callback, req);

  req.next = next;

  if (req.method === 'OPTIONS') {
    methods = [];
    done = wrap(done, generateOptionsResponder(res, methods));
  }

  req.baseUrl = parentUrl;
  if (!Object.hasOwn(req, 'originalUrl') || !req.originalUrl) {
    req.originalUrl = req.url;
  }

  if (this._fastPathEnabled) {
    const path = getCurrentPathname(false);

    if (path == null) {
      done();
      return;
    }

    const fastPathStack = getFastPathStack(this, path);

    if (fastPathStack === undefined) {
      done();
      return;
    }

    handleFastPath(
      self,
      req,
      res,
      done,
      fastPathStack,
      path,
      methods,
      parentParams,
      resumeAfterRewrite,
    );
    return;
  }

  next();

  function resumeAfterRewrite(error, lastLayer) {
    // Continue in registration order after the last dispatched layer.
    index = stack.indexOf(lastLayer) + 1;
    req.next = next;
    next(error);
  }

  function next(error) {
    let layerError = error === 'route'
      ? null
      : error;

    if (slashAdded) {
      req.url = req.url.slice(1);
      slashAdded = false;
    }

    if (removed.length !== 0) {
      req.baseUrl = parentUrl;
      req.url = protohost + removed + req.url.slice(protohost.length);
      removed = '';
    }

    if (layerError === 'router') {
      setImmediate(done, null);
      return;
    }

    if (index >= stack.length) {
      setImmediate(done, layerError);
      return;
    }

    if (++sync > 100) {
      setImmediate(next, error);
      return;
    }

    const path = getCurrentPathname();

    if (path == null) {
      done(layerError);
      return;
    }

    let layer;
    let match;
    let route;

    while (match !== true && index < stack.length) {
      const group = pathGroups && pathGroups[index];
      if (group && group.indexed) {
        index = findPathCandidate(group, pathState, index);
        if (index === group.end) {
          continue;
        }
      }

      layer = stack[index++];
      match = matchLayer(layer, path, pathState);
      route = layer.route;

      if (typeof match !== 'boolean') {
        layerError = layerError || match;
      }

      if (match !== true) {
        continue;
      }

      if (!route) {
        continue;
      }

      if (layerError) {
        match = false;
        continue;
      }

      const hasMethod = route._handlesMethod(req.method);

      if (!hasMethod && req.method === 'OPTIONS' && methods) {
        methods.push(...route._methods());
      }

      if (!hasMethod && req.method !== 'HEAD') {
        match = false;
      }
    }

    if (match !== true) {
      done(layerError);
      return;
    }

    if (route) {
      req.route = route;
    }

    req.params = self.mergeParams
      ? mergeParams(layer.params, parentParams)
      : layer.params;

    const layerPath = layer.path;

    processParams(self.params, layer, paramcalled, req, res, err => {
      if (err) {
        next(layerError || err);
      } else if (route) {
        layer.handleRequest(req, res, next);
      } else {
        trimPrefix(layer, layerError, layerPath, path);
      }

      sync = 0;
    });
  }

  function trimPrefix(layer, layerError, layerPath, path) {
    if (layerPath.length !== 0) {
      if (layerPath !== path.substring(0, layerPath.length)) {
        next(layerError);
        return;
      }

      const separator = path[layerPath.length];
      if (separator && separator !== '/') {
        next(layerError);
        return;
      }

      debug('trim prefix (%s) from url %s', layerPath, req.url);
      removed = layerPath;
      req.url = protohost + req.url.slice(protohost.length + removed.length);

      if (!protohost && req.url[0] !== '/') {
        req.url = `/${req.url}`;
        slashAdded = true;
      }

      req.baseUrl = parentUrl + (
        removed[removed.length - 1] === '/'
          ? removed.substring(0, removed.length - 1)
          : removed
      );
    }

    debug('%s %s : %s', layer.name, layerPath, req.originalUrl);

    if (layerError) {
      layer.handleError(layerError, req, res, next);
    } else {
      layer.handleRequest(req, res, next);
    }
  }

  function getCurrentPathname(createState = true) {
    if (req.url !== pathnameUrl) {
      pathname = parseUrl(req)?.pathname;
      pathnameUrl = req.url;
      pathState = pathname == null
        ? undefined
        : createState
          ? createPathState(pathname)
          : undefined;
    } else if (createState && pathname != null && pathState === undefined) {
      pathState = createPathState(pathname);
    }

    return pathname;
  }
}

/**
 * @param {...(Function|Function[]|string)} args
 * @returns {Router}
 */
function use(...args) {
  let offset = 0;
  let path = '/';
  const [handler] = args;

  if (typeof handler !== 'function') {
    let arg = handler;

    while (Array.isArray(arg) && arg.length !== 0) {
      [arg] = arg;
    }

    if (typeof arg !== 'function') {
      offset = 1;
      path = handler;
    }
  }

  const callbacks = flattenHandlers(args, offset);

  if (callbacks.length === 0) {
    throw new TypeError('argument handler is required');
  }

  for (const fn of callbacks) {
    if (typeof fn !== 'function') {
      throw new TypeError('argument handler must be a function');
    }

    debug('use %o %s', path, fn.name || '<anonymous>');

    const layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: false,
      end: false,
    }, fn);

    layer.route = undefined;
    this.stack.push(layer);
    addPathGroup(this, path, layer);
  }

  disableFastPath(this);

  return this;
}

/**
 * @param {string|RegExp|string[]} path
 * @returns {Route}
 */
function route(path) {
  const route = new Route(path);
  const layer = new Layer(path, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true,
  }, handle);

  function handle(req, res, next) {
    route.dispatch(req, res, next);
  }

  layer.route = route;
  this.stack.push(layer);
  addPathGroup(this, path, layer);
  addFastPathRoute(this, path, layer);

  return route;
}

function createRouterMethodDescriptors() {
  const descriptors = {
    handle: {
      configurable: true,
      value: handle,
      writable: true,
    },
    param: {
      configurable: true,
      value: param,
      writable: true,
    },
    route: {
      configurable: true,
      value: route,
      writable: true,
    },
    use: {
      configurable: true,
      value: use,
      writable: true,
    },
  };

  for (const method of httpMethods) {
    descriptors[method] = {
      configurable: true,
      value: createRouterMethod(method),
      writable: true,
    };
  }

  descriptors.all = {
    configurable: true,
    value: createRouterMethod('all'),
    writable: true,
  };

  return descriptors;
}

function createRouterMethod(method) {
  return function routeForMethod(path, ...handlers) {
    const route = this.route(path);
    route[method](...handlers);
    return this;
  };
}

function generateOptionsResponder(res, methods) {
  return function onDone(fn, err) {
    if (err || methods.length === 0) {
      fn(err);
      return;
    }

    trySendOptionsResponse(res, methods, fn);
  };
}

function getFastPathKey(path, strict, caseSensitive) {
  if (typeof path !== 'string') {
    return path;
  }

  const normalized = strict || path.length <= 1
    ? path
    : path.replace(/\/+$/, '');

  return caseSensitive
    ? normalized
    : canonicalizePathCase(normalized);
}

function getFastPathStack(router, path) {
  return router._fastPathStackByPath[
    getFastPathKey(normalizeRequestPath(path, router.strict), true, router.caseSensitive)
  ];
}

function matchLayer(layer, path, pathState) {
  try {
    return layer.match(path, pathState);
  } catch (error) {
    return error;
  }
}

function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params;
  }

  const obj = Object.assign(Object.create(null), parent);

  if (!(0 in params) || !(0 in parent)) {
    return Object.assign(obj, params);
  }

  let i = 0;
  let offset = 0;

  while (i in params) {
    i += 1;
  }

  while (offset in parent) {
    offset += 1;
  }

  for (i -= 1; i >= 0; i -= 1) {
    params[i + offset] = params[i];

    if (i < offset) {
      delete params[i];
    }
  }

  return Object.assign(obj, params);
}

function disableFastPath(router) {
  router._fastPathEnabled = false;
}

function addFastPathRoute(router, path, layer) {
  if (!router._fastPathEnabled) {
    return;
  }

  const keys = getFastPathKeys(path, router.strict, router.caseSensitive);

  if (!keys) {
    disableFastPath(router);
    return;
  }

  for (const key of keys) {
    const stack = router._fastPathStackByPath[key];

    if (stack) {
      stack.push(layer);
    } else {
      router._fastPathStackByPath[key] = [layer];
    }
  }
}

// Index literal paths and required literal prefixes; other matchers remain barriers.
function addPathGroup(router, path, layer) {
  if (layer.slash || typeof path !== 'string') {
    return;
  }

  let prefix = !layer.route;
  if (!layer.staticMatcher) {
    const dynamicIndex = path.search(FAST_PATH_UNSAFE_REGEXP);
    const end = dynamicIndex === -1 ? -1 : path.lastIndexOf('/', dynamicIndex);
    if (end <= 0) {
      return;
    }
    path = path.slice(0, end);
    prefix = true;
  }

  const index = router.stack.length - 1;
  const strict = !prefix && Boolean(router.strict);
  const sensitive = Boolean(router.caseSensitive);
  let group = router._lastPathGroup;

  if (!group || group.end !== index || group.prefix !== prefix || group.strict !== strict
    || group.sensitive !== sensitive) {
    router._lastPathGroup = group = {
      start: index,
      end: index,
      prefix,
      strict,
      sensitive,
      maxPathLength: 0,
      maxBucketSize: 0,
      indexed: false,
      byPath: Object.create(null),
    };
  }

  const key = getFastPathKey(path, strict, sensitive);
  group.maxPathLength = Math.max(group.maxPathLength, key.length);
  const indices = group.byPath[key];
  let bucketSize = 1;
  if (indices === undefined) {
    group.byPath[key] = index;
  } else if (typeof indices === 'number') {
    group.byPath[key] = [indices, index];
    bucketSize = 2;
  } else {
    indices.push(index);
    bucketSize = indices.length;
  }

  group.maxBucketSize = Math.max(group.maxBucketSize, bucketSize);
  group.end = index + 1;
  const size = group.end - group.start;
  // Dense buckets cost less to scan than to repeatedly search.
  group.indexed = size >= PATH_INDEX_MIN_LAYERS && group.maxBucketSize * 2 <= size;
  if (router._pathGroups[index - 1] === group) {
    router._pathGroups[index] = group;
  } else if (group.indexed) {
    for (let i = group.start; i <= index; i++) {
      router._pathGroups[i] = group;
    }
  }
}

function findPathCandidate(group, state, index) {
  const path = group.strict
    ? (group.sensitive ? state.path : state.caseInsensitivePath)
    : (group.sensitive ? state.loosePath : state.caseInsensitiveLoosePath);
  let nextIndex = path.length <= group.maxPathLength
    ? findIndexAtOrAfter(group.byPath[path], index, group.end)
    : group.end;

  if (group.prefix) {
    for (let end = path.indexOf('/'); end !== -1 && end <= group.maxPathLength;
      end = path.indexOf('/', end + 1)) {
      const candidate = findIndexAtOrAfter(group.byPath[path.slice(0, end)], index, nextIndex);
      if (candidate < nextIndex) {
        nextIndex = candidate;
      }
    }
  }

  return nextIndex;
}

function findIndexAtOrAfter(indices, index, fallback) {
  if (indices === undefined) {
    return fallback;
  }

  if (typeof indices === 'number') {
    return indices >= index ? indices : fallback;
  }

  let low = 0;
  let high = indices.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (indices[middle] < index) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low < indices.length ? indices[low] : fallback;
}

function getFastPathKeys(path, strict, caseSensitive) {
  if (Array.isArray(path)) {
    const keys = [];
    const seen = new Set();

    for (const currentPath of path) {
      const key = getFastPathKeyForString(currentPath, strict, caseSensitive);

      if (key === undefined || seen.has(key)) {
        if (key === undefined) {
          return undefined;
        }

        continue;
      }

      seen.add(key);
      keys.push(key);
    }

    return keys;
  }

  const key = getFastPathKeyForString(path, strict, caseSensitive);
  return key === undefined ? undefined : [key];
}

function getFastPathKeyForString(path, strict, caseSensitive) {
  if (typeof path !== 'string' || FAST_PATH_UNSAFE_REGEXP.test(path)) {
    return undefined;
  }

  const key = getFastPathKey(path, strict, caseSensitive);
  return !strict && key === '' ? undefined : key;
}

function handleFastPath(router, req, res, done, stack, path, methods, parentParams, resumeAfterRewrite) {
  let index = 0;
  let sync = 0;
  let lastLayer;
  const originalUrl = req.url;
  const paramcalled = Object.create(null);

  req.next = next;

  next();

  function next(error) {
    if (req.url !== originalUrl) {
      resumeAfterRewrite(error, lastLayer);
      return;
    }

    let layerError = error === 'route'
      ? null
      : error;

    if (layerError === 'router') {
      setImmediate(done, null);
      return;
    }

    if (index >= stack.length) {
      setImmediate(done, layerError);
      return;
    }

    if (++sync > 100) {
      setImmediate(next, error);
      return;
    }

    if (layerError) {
      done(layerError);
      return;
    }

    let layer;
    let route;

    while (index < stack.length) {
      const candidate = stack[index++];
      const candidateRoute = candidate.route;
      const hasMethod = candidateRoute._handlesMethod(req.method);

      if (!hasMethod && req.method === 'OPTIONS' && methods) {
        methods.push(...candidateRoute._methods());
      }

      if (!hasMethod && req.method !== 'HEAD') {
        continue;
      }

      layer = candidate;
      lastLayer = candidate;
      route = candidateRoute;
      break;
    }

    if (!layer) {
      done();
      return;
    }

    layer.params = Object.create(null);
    layer.path = path;

    req.route = route;
    req.params = router.mergeParams
      ? mergeParams(layer.params, parentParams)
      : layer.params;

    processParams(router.params, layer, paramcalled, req, res, err => {
      if (err) {
        next(layerError || err);
      } else {
        layer.handleRequest(req, res, next);
      }

      sync = 0;
    });
  }
}

function createPathState(path) {
  const loosePath = normalizeRequestPath(path, false);
  const caseInsensitivePath = canonicalizePathCase(path);

  return {
    caseInsensitiveLoosePath: loosePath === path
      ? caseInsensitivePath
      : caseInsensitivePath.slice(0, -1),
    caseInsensitivePath,
    loosePath,
    path,
  };
}

function processParams(params, layer, called, req, res, done) {
  const keys = layer.keys;

  if (!keys || keys.length === 0) {
    done();
    return;
  }

  let index = 0;
  let paramIndex = 0;
  let key;
  let paramVal;
  let paramCallbacks;
  let paramCalled;

  function param(error) {
    if (error) {
      done(error);
      return;
    }

    if (index >= keys.length) {
      done();
      return;
    }

    paramIndex = 0;
    key = keys[index++];
    paramVal = req.params[key];
    paramCallbacks = params[key];
    paramCalled = called[key];

    if (paramVal === undefined || !paramCallbacks) {
      param();
      return;
    }

    if (paramCalled && (
      paramCalled.match === paramVal
      || (paramCalled.error && paramCalled.error !== 'route')
    )) {
      req.params[key] = paramCalled.value;
      param(paramCalled.error);
      return;
    }

    called[key] = paramCalled = {
      error: null,
      match: paramVal,
      value: paramVal,
    };

    paramCallback();
  }

  function paramCallback(error) {
    const fn = paramCallbacks[paramIndex++];
    paramCalled.value = req.params[key];

    if (error) {
      paramCalled.error = error;
      param(error);
      return;
    }

    if (!fn) {
      param();
      return;
    }

    try {
      const result = fn(req, res, paramCallback, paramVal, key);

      if (isPromiseLike(result)) {
        Promise.resolve(result).then(undefined, rejection => {
          paramCallback(normalizeRejectedPromise(rejection));
        });
      }
    } catch (err) {
      paramCallback(err);
    }
  }

  param();
}

function restoreRequestState(fn, req) {
  const baseUrl = req.baseUrl;
  const next = req.next;
  const params = req.params;

  return function restored(error) {
    req.baseUrl = baseUrl;
    req.next = next;
    req.params = params;

    if (error === undefined) {
      return fn.call(this);
    }

    return fn.call(this, error);
  };
}

function sendOptionsResponse(res, methods) {
  const options = Object.create(null);

  for (const method of methods) {
    options[method] = true;
  }

  const allow = Object.keys(options).sort().join(', ');

  res.setHeader('Allow', allow);
  setContentLength(res, Buffer.byteLength(allow));
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(allow);
}

function trySendOptionsResponse(res, methods, next) {
  try {
    sendOptionsResponse(res, methods);
  } catch (error) {
    next(error);
  }
}

function wrap(previous, fn) {
  return function wrapped(error) {
    fn.call(this, previous, error);
  };
}
