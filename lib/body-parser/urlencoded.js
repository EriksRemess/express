/*!
 * express
 * MIT Licensed
 */

import readBody from "#lib/body-parser/read";
import { normalizeBodyParserOptions } from "#lib/body-parser/utils";
import createDebug from "#lib/utils/debug";
import createError from "#lib/utils/http-errors";
import { getOwnOption } from "#lib/utils/options";
import { parseExtendedQueryString, parseSimpleQueryString } from "#lib/utils/query-string";

const debug = createDebug("express:body-parser:urlencoded");
const MAX_ARRAY_INDEX = 1000;

/**
 * Create a middleware to parse URL-encoded request bodies.
 *
 * @param {object} [options]
 * @returns {Function}
 */
export default function urlencoded(options) {
  const normalizedOptions = normalizeBodyParserOptions(
    options,
    "application/x-www-form-urlencoded",
  );

  if (normalizedOptions.defaultCharset !== "utf-8" && normalizedOptions.defaultCharset !== "iso-8859-1") {
    throw new TypeError("option defaultCharset must be either utf-8 or iso-8859-1");
  }

  const parseQueryString = createUrlencodedParser(options);

  function parse(body, encoding) {
    return body.length === 0 ? {} : parseQueryString(body, encoding);
  }

  const readOptions = {
    ...normalizedOptions,
    isValidCharset: charset => charset === "utf-8" || charset === "iso-8859-1",
  };

  return function urlencodedParser(req, res, next) {
    readBody(req, res, next, parse, debug, readOptions);
  };
}

function createUrlencodedParser(options) {
  const extended = Boolean(getOwnOption(options, "extended"));
  const charsetSentinel = getOwnOption(options, "charsetSentinel") === true;
  const interpretNumericEntities = getOwnOption(options, "interpretNumericEntities") === true;
  let parameterLimit = getOwnOption(options, "parameterLimit") ?? 1000;
  const depth = extended ? (getOwnOption(options, "depth") ?? 32) : 0;
  const normalizedDepth = Number(depth);

  if (Number.isNaN(Number(parameterLimit)) || Number(parameterLimit) < 1) {
    throw new TypeError("option parameterLimit must be a positive number");
  }

  if (!Number.isFinite(normalizedDepth) || normalizedDepth < 0) {
    throw new TypeError("option depth must be a zero or a positive number");
  }

  if (Number.isFinite(Number(parameterLimit))) {
    parameterLimit = Math.floor(Number(parameterLimit));
  } else {
    parameterLimit = Infinity;
  }

  // Keep indexed arrays usable for typical form submissions while still
  // avoiding unbounded sparse arrays when parameterLimit is Infinity.
  const arrayLimit = Math.min(parameterLimit, MAX_ARRAY_INDEX);

  return function parseUrlencodedBody(body, charset) {
    if (countParameters(body, parameterLimit) === undefined) {
      debug("too many parameters");
      throw createError(413, "too many parameters", {
        type: "parameters.too.many",
      });
    }

    try {
      return extended
        ? parseExtendedQueryString(body, {
          charset,
          charsetSentinel,
          interpretNumericEntities,
          arrayLimit,
          depth: normalizedDepth,
          throwOnDepthLimit: true,
        })
        : parseSimpleQueryString(body, { charset, charsetSentinel, interpretNumericEntities });
    } catch (error) {
      if (error instanceof RangeError) {
        throw createError(400, "The input exceeded the depth", {
          type: "querystring.parse.rangeError",
        });
      }

      throw error;
    }
  };
}

function countParameters(body, limit) {
  if (limit === Infinity) {
    return Infinity;
  }

  let count = 0;
  let index = -1;

  do {
    count++;
    if (count > limit) {
      return undefined;
    }
    index = body.indexOf("&", index + 1);
  } while (index !== -1);

  return count;
}
