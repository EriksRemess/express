/*!
 * express
 * MIT Licensed
 */

/**
 * Check whether a value is Promise-like.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPromiseLike(value) {
  return value != null && typeof value.then === 'function';
}

/**
 * Convert a rejected promise value into an Error for router flow control.
 *
 * @param {unknown} error
 * @returns {Error}
 */
export function normalizeRejectedPromise(error) {
  return error || new Error('Rejected promise');
}
