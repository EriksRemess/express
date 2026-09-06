/*!
 * express
 * MIT Licensed
 */

import Layer from '#lib/router/layer';
import { flattenHandlers } from '#lib/router/utils';
import createDebug from '#lib/utils/debug';
import { httpMethods } from '#lib/utils/methods';

const debug = createDebug('router:route');
const ALL_METHODS_PLAN = Symbol('route all methods plan');
const EMPTY_INDEX = -1;
const ROUTE_METHOD_DESCRIPTORS = createRouteMethodDescriptors();

/**
 * Route object containing handlers for a single path.
 */
export default class Route {
  /**
   * @param {string|RegExp|string[]} path
   */
  constructor(path) {
    debug('new %o', path);
    this.path = path;
    this.stack = [];
    this._dispatchPlans = Object.create(null);
    this.methods = Object.create(null);
    defineRouteMethods(this);
  }

  /**
   * @param {string} method
   * @returns {boolean}
   */
  _handlesMethod(method) {
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
  }

  /**
   * @returns {string[]}
   */
  _methods() {
    const methods = Object.keys(this.methods);

    if (this.methods.get && !this.methods.head) {
      methods.push('head');
    }

    for (let i = 0; i < methods.length; i += 1) {
      methods[i] = methods[i].toUpperCase();
    }

    return methods;
  }

  /**
   * @param {object} req
   * @param {object} res
   * @param {Function} done
   */
  dispatch(req, res, done) {
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
  }

  /**
   * @param {...Function|Function[]} handlers
   * @returns {Route}
   */
  all(...handlers) {
    const callbacks = flattenHandlers(handlers);

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
  }
}

function defineRouteMethods(route) {
  Object.defineProperties(route, ROUTE_METHOD_DESCRIPTORS);
}

function createRouteMethodDescriptors() {
  const descriptors = Object.create(null);

  for (const method of httpMethods) {
    descriptors[method] = {
      configurable: true,
      value: createRouteMethod(method),
      writable: true,
    };
  }

  return descriptors;
}

function createRouteMethod(method) {
  return function registerMethod(...handlers) {
    return registerRouteMethod(this, method, handlers);
  };
}

function registerRouteMethod(route, method, handlers) {
  const callbacks = flattenHandlers(handlers);

  if (callbacks.length === 0) {
    throw new TypeError('argument handler is required');
  }

  for (const fn of callbacks) {
    if (typeof fn !== 'function') {
      throw new TypeError('argument handler must be a function');
    }

    debug('%s %s', method, route.path);

    const layer = Layer('/', {}, fn);
    layer.method = method;

    route.methods[method] = true;
    route.stack.push(layer);
    invalidateDispatchPlans(route);
  }

  return route;
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
  // Unregistered methods all run the same method-independent handlers.
  const key = method !== '_all' && Object.hasOwn(route.methods, method)
    ? method
    : ALL_METHODS_PLAN;
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
