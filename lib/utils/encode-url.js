/*!
 * express
 * MIT Licensed
 */

const ENCODE_CHARS_REGEXP = /(?:[^\x21\x23-\x3B\x3D\x3F-\x5F\x61-\x7A\x7C\x7E]|%(?![0-9A-Fa-f]{2}))+/g;

/**
 * Encode a URL while preserving already-valid escape sequences.
 *
 * @param {string} url
 * @returns {string}
 */
export default function encodeUrl(url) {
  return String(url)
    .toWellFormed()
    .replace(ENCODE_CHARS_REGEXP, encodeURI);
}
