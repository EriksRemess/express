/*!
 * express
 * MIT Licensed
 */

/**
 * Copy only own enumerable options into a null-prototype object.
 *
 * @param {object} [options]
 * @returns {object}
 */
export function copyOptions(options) {
  return Object.assign(Object.create(null), options);
}

/**
 * Get an own option value without consulting Object.prototype.
 *
 * @param {object} [options]
 * @param {string|symbol} name
 * @returns {*}
 */
export function getOwnOption(options, name) {
  return hasOwnOption(options, name) ? options[name] : undefined;
}

/**
 * Check for an own option without consulting Object.prototype.
 *
 * @param {object} [options]
 * @param {string|symbol} name
 * @returns {boolean}
 */
export function hasOwnOption(options, name) {
  return options != null && Object.hasOwn(options, name);
}
