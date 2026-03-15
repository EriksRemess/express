/*!
 * express
 * MIT Licensed
 */

/**
 * Copy own property descriptors from one object to another.
 *
 * @param {object} destination
 * @param {object} source
 * @param {boolean} [overwrite=true]
 * @returns {object}
 */
export default function mergeDescriptors(destination, source, overwrite = true) {
  if (!destination) {
    throw new TypeError('The `destination` argument is required.');
  }

  if (!source) {
    throw new TypeError('The `source` argument is required.');
  }

  for (const name of Object.getOwnPropertyNames(source)) {
    if (!overwrite && Object.hasOwn(destination, name)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(source, name);
    Object.defineProperty(destination, name, descriptor);
  }

  return destination;
}
