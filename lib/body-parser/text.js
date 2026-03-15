/*!
 * express
 * MIT Licensed
 */

import readBody from "#lib/body-parser/read";
import {
  isSupportedCharset,
  normalizeBodyParserOptions,
  passthrough,
} from "#lib/body-parser/utils";
import createDebug from "#lib/utils/debug";

const debug = createDebug("express:body-parser:text");

/**
 * Create a middleware to parse text request bodies.
 *
 * @param {object} [options]
 * @returns {Function}
 */
export default function text(options) {
  const normalizedOptions = normalizeBodyParserOptions(options, "text/plain");
  const readOptions = {
    ...normalizedOptions,
    isValidCharset: isSupportedCharset,
  };

  return function textParser(req, res, next) {
    readBody(req, res, next, passthrough, debug, readOptions);
  };
}
