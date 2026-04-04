/*!
 * express
 * MIT Licensed
 */

import Layer from '#lib/router/layer';
import createDebug from '#lib/utils/debug';
import { httpMethods } from '#lib/utils/methods';

const debug = createDebug('router:route');
const NO_METHOD_PLAN = '@@route:no_method_plan';
const EMPTY_INDEX = -1;

/**
 * Route object containing handlers for a single path.
 *
 * @param {string|RegExp|string[]} path
 */
export default function Route(path) {
  debug('new %o', path);
  this.path = path;
  this.stack = [];
  this._dispatchPlans = Object.create(null);
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
  let currentIndex = EMPTY_INDEX;
  let sync = 0;

  const method = getDispatchMethod(this, req.method);
  const plan = getDispatchPlan(this, method);

  req.route = this;

  if (plan.requestStart === EMPTY_INDEX) {
    done();
    return;
  }

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

    const nextIndex = error
      ? getNextErrorIndex(plan, currentIndex)
      : getNextRequestIndex(plan, currentIndex);

    if (nextIndex === EMPTY_INDEX) {
      done(error);
      return;
    }

    if (++sync > 100) {
      setImmediate(invoke, nextIndex, error);
      return;
    }

    invoke(nextIndex, error);
  }

  function invoke(index, error) {
    currentIndex = index;

    if (error) {
      plan.layers[index].handleError(error, req, res, next);
    } else {
      plan.layers[index].handleRequest(req, res, next);
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
    invalidateDispatchPlans(this);
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
      invalidateDispatchPlans(this);
    }

    return this;
  };
}

function getDispatchMethod(route, method) {
  let name = typeof method === 'string'
    ? method.toLowerCase()
    : method;

  if (name === 'head' && !route.methods.head) {
    name = 'get';
  }

  return name;
}

function getDispatchPlan(route, method) {
  const key = method ?? NO_METHOD_PLAN;
  let plan = route._dispatchPlans[key];

  if (plan) {
    return plan;
  }

  const layers = [];

  for (let index = 0; index < route.stack.length; index += 1) {
    const layer = route.stack[index];

    if (!layer.method || layer.method === method) {
      layers.push(layer);
    }
  }

  plan = compileDispatchPlan(layers);
  route._dispatchPlans[key] = plan;
  return plan;
}

function compileDispatchPlan(layers) {
  const nextError = new Int32Array(layers.length);
  const nextRequest = new Int32Array(layers.length);
  let errorStart = EMPTY_INDEX;
  let requestStart = EMPTY_INDEX;

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    nextError[index] = errorStart;
    nextRequest[index] = requestStart;

    if (layers[index].isErrorHandler) {
      errorStart = index;
    } else {
      requestStart = index;
    }
  }

  return {
    errorStart,
    layers,
    nextError,
    nextRequest,
    requestStart,
  };
}

function getNextErrorIndex(plan, currentIndex) {
  return currentIndex === EMPTY_INDEX
    ? plan.errorStart
    : plan.nextError[currentIndex];
}

function getNextRequestIndex(plan, currentIndex) {
  return currentIndex === EMPTY_INDEX
    ? plan.requestStart
    : plan.nextRequest[currentIndex];
}

function invalidateDispatchPlans(route) {
  route._dispatchPlans = Object.create(null);
}
