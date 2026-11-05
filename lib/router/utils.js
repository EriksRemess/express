/*!
 * express
 * MIT Licensed
 */

/**
 * Flatten nested handler arrays only when a nested array is present.
 *
 * @param {Array} args
 * @param {number} [offset]
 * @returns {Array}
 */
export function flattenHandlers(args, offset = 0) {
  for (let index = offset; index < args.length; index += 1) {
    if (Array.isArray(args[index])) {
      return offset === 0
        ? args.flat(Infinity)
        : args.slice(offset).flat(Infinity);
    }
  }

  return offset === 0
    ? args
    : args.slice(offset);
}

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

/** Canonicalize UTF-16 code units like a case-insensitive RegExp without /u. */
export function canonicalizePathCase(path) {
  if (!/[^\x00-\x7f]/.test(path)) {
    return path.toUpperCase();
  }

  let canonical = '';

  for (let i = 0; i < path.length; i++) {
    const character = path[i];
    const upper = character.toUpperCase();

    // RegExp /i preserves expansions and non-ASCII characters that would
    // otherwise become ASCII, such as the long s. Work on code units so
    // astral characters also retain the matcher's non-Unicode semantics.
    canonical += upper.length !== 1
      || (character.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128)
      ? character
      : upper;
  }

  return canonical;
}

/** Remove at most one optional trailing slash from a request pathname. */
export function normalizeRequestPath(path, strict) {
  return !strict && path.length > 1 && path.endsWith('/')
    ? path.slice(0, -1)
    : path;
}
