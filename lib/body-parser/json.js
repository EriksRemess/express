/*!
 * express
 * MIT Licensed
 */

import createDebug from "#lib/utils/debug";
import readBody from "#lib/body-parser/read";
import { normalizeBodyParserOptions } from "#lib/body-parser/utils";

const debug = createDebug("express:body-parser:json");
const FIRST_JSON_CHARACTER_REGEXP = /^[\x20\x09\x0a\x0d]*([^\x20\x09\x0a\x0d])/;
const JSON_SYNTAX_PLACEHOLDER = "#";
const JSON_SYNTAX_PLACEHOLDER_REGEXP = /#+/g;

/**
 * Create a middleware to parse JSON request bodies.
 *
 * @param {object} [options]
 * @returns {Function}
 */
export default function json(options) {
  const normalizedOptions = normalizeBodyParserOptions(options, "application/json");
  const reviver = options?.reviver;
  const strict = options?.strict !== false;

  function parse(body) {
    if (body.length === 0) {
      return {};
    }

    if (strict) {
      const first = getFirstJsonCharacter(body);

      if (first !== "{" && first !== "[") {
        debug("strict violation");
        throw createStrictSyntaxError(body, first);
      }
    }

    try {
      debug("parse json");
      return JSON.parse(body, reviver);
    } catch (error) {
      throw normalizeJsonSyntaxError(error, {
        message: error.message,
        stack: error.stack,
      });
    }
  }

  const readOptions = {
    ...normalizedOptions,
    isValidCharset: charset => charset.startsWith("utf-"),
  };

  return function jsonParser(req, res, next) {
    readBody(req, res, next, parse, debug, readOptions);
  };
}

function createStrictSyntaxError(body, first) {
  const index = body.indexOf(first);
  let partial = "";

  if (index !== -1) {
    partial = body.slice(0, index) + JSON_SYNTAX_PLACEHOLDER.repeat(body.length - index);
  }

  try {
    JSON.parse(partial);
    throw new SyntaxError("strict violation");
  } catch (error) {
    return normalizeJsonSyntaxError(error, {
      message: error.message.replace(JSON_SYNTAX_PLACEHOLDER_REGEXP, placeholder => {
        return body.slice(index, index + placeholder.length);
      }),
      stack: error.stack,
    });
  }
}

function getFirstJsonCharacter(body) {
  const match = FIRST_JSON_CHARACTER_REGEXP.exec(body);
  return match?.[1];
}

function normalizeJsonSyntaxError(error, details) {
  for (const key of Object.getOwnPropertyNames(error)) {
    if (key !== "message" && key !== "stack") {
      delete error[key];
    }
  }

  error.stack = details.stack.replace(error.message, details.message);
  error.message = details.message;

  return error;
}
