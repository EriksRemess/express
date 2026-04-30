/*!
 * express
 * MIT Licensed
 */

import typeisRequest from "#lib/utils/type-is";
import { getOwnOption } from "#lib/utils/options";
import { MIMEType } from "node:util";

/**
 * Normalize the common options for all body parsers.
 *
 * @param {object|undefined} options
 * @param {string|string[]} defaultType
 * @returns {object}
 */
export function normalizeBodyParserOptions(options, defaultType) {
  if (!defaultType) {
    throw new TypeError("defaultType must be provided");
  }

  const inflate = getOwnOption(options, "inflate") !== false;
  const limitOption = getOwnOption(options, "limit");
  const limit = typeof limitOption === "number"
    ? limitOption
    : parseByteLimit(limitOption ?? "100kb");
  const type = getOwnOption(options, "type") ?? defaultType;
  const verify = getOwnOption(options, "verify") ?? false;
  const defaultCharset = getOwnOption(options, "defaultCharset") ?? "utf-8";
  const shouldParse = typeof type === "function" ? type : createTypeChecker(type);

  if (verify !== false && typeof verify !== "function") {
    throw new TypeError("option verify must be function");
  }

  return {
    defaultCharset,
    inflate,
    limit,
    shouldParse,
    verify,
  };
}

/**
 * Get the charset from the request content type.
 *
 * @param {object} req
 * @returns {string|undefined}
 */
export function getCharset(req) {
  try {
    const contentType = getOwnOption(req.headers, "content-type");
    if (!contentType) {
      return undefined;
    }

    const mimeType = new MIMEType(contentType);
    return mimeType.params.get("charset")?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Determine whether Node can decode a charset label.
 *
 * @param {string} charset
 * @returns {boolean}
 */
export function isSupportedCharset(charset) {
  try {
    new TextDecoder(charset);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the input unchanged.
 *
 * @param {*} value
 * @returns {*}
 */
export function passthrough(value) {
  return value;
}

function createTypeChecker(type) {
  return function checkType(req) {
    return Boolean(typeisRequest(req, type));
  };
}

function parseByteLimit(value) {
  if (typeof value === "number") {
    return value;
  }

  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|pb)?$/i);
  if (!match) {
    throw new TypeError(`invalid limit value: ${value}`);
  }

  const size = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
    pb: 1024 ** 5,
  };

  return Math.floor(size * multipliers[unit]);
}
