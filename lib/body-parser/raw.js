/*!
 * express
 * MIT Licensed
 */

import readBody from "#lib/body-parser/read";
import { normalizeBodyParserOptions, passthrough } from "#lib/body-parser/utils";
import createDebug from "#lib/utils/debug";

const debug = createDebug("express:body-parser:raw");

/**
 * Create a middleware to parse raw request bodies.
 *
 * @param {object} [options]
 * @returns {Function}
 */
export default function raw(options) {
  const normalizedOptions = normalizeBodyParserOptions(options, "application/octet-stream");
  const readOptions = {
    ...normalizedOptions,
    skipCharset: true,
  };

  return function rawParser(req, res, next) {
    readBody(req, res, next, passthrough, debug, readOptions);
  };
}
