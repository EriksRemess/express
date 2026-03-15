/*!
 * express
 * MIT Licensed
 */

import Layer from '#lib/router/layer';
import createDebug from '#lib/utils/debug';
import { httpMethods } from '#lib/utils/methods';

const debug = createDebug('router:route');

/**
 * Route object containing handlers for a single path.
 *
 * @param {string|RegExp|string[]} path
 */
export default function Route(path) {
  debug('new %o', path);
  this.path = path;
  this.stack = [];
  this.methods = Object.create(null);
}

/**
 * @param {string} method
 * @returns {boolean}
 */
Route.prototype._handlesMethod = function _handlesMethod(method) {
  if (this.methods._all) {
    return true;
  }

  let name = typeof method === 'string'
    ? method.toLowerCase()
    : method;

  if (name === 'head' && !this.methods.head) {
    name = 'get';
  }

  return Boolean(this.methods[name]);
};

/**
 * @returns {string[]}
 */
Route.prototype._methods = function _methods() {
  const methods = Object.keys(this.methods);

  if (this.methods.get && !this.methods.head) {
    methods.push('head');
  }

  for (let i = 0; i < methods.length; i += 1) {
    methods[i] = methods[i].toUpperCase();
  }

  return methods;
};

/**
 * @param {object} req
 * @param {object} res
 * @param {Function} done
 */
Route.prototype.dispatch = function dispatch(req, res, done) {
  let index = 0;
  const { stack } = this;
  let sync = 0;

  if (stack.length === 0) {
    done();
    return;
  }

  let method = typeof req.method === 'string'
    ? req.method.toLowerCase()
    : req.method;

  if (method === 'head' && !this.methods.head) {
    method = 'get';
  }

  req.route = this;

  next();

  function next(error) {
    if (error === 'route') {
      done();
      return;
    }

    if (error === 'router') {
      done(error);
      return;
    }

    if (index >= stack.length) {
      done(error);
      return;
    }

    if (++sync > 100) {
      setImmediate(next, error);
      return;
    }

    let layer;
    let match;

    while (match !== true && index < stack.length) {
      layer = stack[index++];
      match = !layer.method || layer.method === method;
    }

    if (match !== true) {
      done(error);
      return;
    }

    if (error) {
      layer.handleError(error, req, res, next);
    } else {
      layer.handleRequest(req, res, next);
    }

    sync = 0;
  }
};

/**
 * @param {...Function|Function[]} handlers
 * @returns {Route}
 */
Route.prototype.all = function all(...handlers) {
  const callbacks = handlers.flat(Infinity);

  if (callbacks.length === 0) {
    throw new TypeError('argument handler is required');
  }

  for (const fn of callbacks) {
    if (typeof fn !== 'function') {
      throw new TypeError('argument handler must be a function');
    }

    const layer = Layer('/', {}, fn);
    layer.method = undefined;

    this.methods._all = true;
    this.stack.push(layer);
  }

  return this;
};

for (const method of httpMethods) {
  Route.prototype[method] = function registerMethod(...handlers) {
    const callbacks = handlers.flat(Infinity);

    if (callbacks.length === 0) {
      throw new TypeError('argument handler is required');
    }

    for (const fn of callbacks) {
      if (typeof fn !== 'function') {
        throw new TypeError('argument handler must be a function');
      }

      debug('%s %s', method, this.path);

      const layer = Layer('/', {}, fn);
      layer.method = method;

      this.methods[method] = true;
      this.stack.push(layer);
    }

    return this;
  };
}
