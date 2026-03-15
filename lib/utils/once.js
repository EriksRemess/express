/*!
 * express
 * MIT Licensed
 */

/**
 * Wrap a function so it can only be called once.
 *
 * @param {Function} fn
 * @returns {Function}
 */
export default function once(fn) {
  const wrapped = function wrappedOnce(...args) {
    if (wrapped.called) {
      return wrapped.value;
    }

    wrapped.called = true;
    wrapped.value = fn.apply(this, args);
    return wrapped.value;
  };

  wrapped.called = false;
  return wrapped;
}
