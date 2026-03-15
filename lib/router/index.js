/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import Layer from '#lib/router/layer';
import Route from '#lib/router/route';
import { isPromiseLike, normalizeRejectedPromise } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { httpMethods } from '#lib/utils/methods';
import parseUrl from '#lib/utils/parseurl';

const debug = createDebug('router');

/**
 * Create a callable router instance.
 *
 * @param {object} [options]
 * @returns {Router}
 */
export default function Router(options) {
  if (!(this instanceof Router)) {
    return new Router(options);
  }

  const opts = options || {};

  function router(req, res, next) {
    router.handle(req, res, next);
  }

  Object.setPrototypeOf(router, this);

  router.caseSensitive = opts.caseSensitive;
  router.mergeParams = opts.mergeParams;
  router.params = {};
  router.strict = opts.strict;
  router.stack = [];

  return router;
}

Router.Route = Route;

/* istanbul ignore next */
Router.prototype = function RouterPrototype() {};

/**
 * @param {string} name
 * @param {Function} fn
 * @returns {Router}
 */
Router.prototype.param = function param(name, fn) {
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
};

/**
 * @param {object} req
 * @param {object} res
 * @param {Function} callback
 */
Router.prototype.handle = function handle(req, res, callback) {
  if (!callback) {
    throw new TypeError('argument callback is required');
  }

  debug('dispatching %s %s', req.method, req.url);

  let index = 0;
  let methods;
  const protohost = getProtohost(req.url) || '';
  let removed = '';
  let slashAdded = false;
  let sync = 0;
  const paramcalled = {};
  const { stack } = this;
  const parentParams = req.params;
  const parentUrl = req.baseUrl || '';
  const self = this;
  let done = restoreRequestState(callback, req);

  req.next = next;

  if (req.method === 'OPTIONS') {
    methods = [];
    done = wrap(done, generateOptionsResponder(res, methods));
  }

  req.baseUrl = parentUrl;
  req.originalUrl = req.originalUrl || req.url;

  next();

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

    const path = getPathname(req);

    if (path == null) {
      done(layerError);
      return;
    }

    let layer;
    let match;
    let route;

    while (match !== true && index < stack.length) {
      layer = stack[index++];
      match = matchLayer(layer, path);
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
};

/**
 * @param {...(Function|Function[]|string)} args
 * @returns {Router}
 */
Router.prototype.use = function use(...args) {
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

  const callbacks = args.slice(offset).flat(Infinity);

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
  }

  return this;
};

/**
 * @param {string|RegExp|string[]} path
 * @returns {Route}
 */
Router.prototype.route = function route(path) {
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

  return route;
};

for (const method of [...httpMethods, 'all']) {
  Router.prototype[method] = function routeForMethod(path, ...handlers) {
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

function getPathname(req) {
  return parseUrl(req)?.pathname;
}

function getProtohost(url) {
  if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
    return undefined;
  }

  const searchIndex = url.indexOf('?');
  const pathLength = searchIndex !== -1
    ? searchIndex
    : url.length;
  const fqdnIndex = url.substring(0, pathLength).indexOf('://');

  return fqdnIndex !== -1
    ? url.substring(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined;
}

function matchLayer(layer, path) {
  try {
    return layer.match(path);
  } catch (error) {
    return error;
  }
}

function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params;
  }

  const obj = Object.assign({}, parent);

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
  res.setHeader('Content-Length', Buffer.byteLength(allow));
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
