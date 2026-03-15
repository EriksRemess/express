/*!
 * express
 * MIT Licensed
 */

import {
  parseExtendedQueryString,
  parseSimpleQueryString,
} from "#lib/utils/query-string";

/**
 * Compile an application "query parser" setting into a parser function.
 *
 * @param {boolean|string|Function} val
 * @returns {Function|undefined}
 */
export function compileQueryParser(val) {
  let fn;

  if (typeof val === "function") {
    return val;
  }

  switch (val) {
    case true:
    case "simple":
      fn = parseSimpleQueryString;
      break;
    case false:
      break;
    case "extended":
      fn = parseExtendedQueryString;
      break;
    default:
      throw new TypeError(`unknown value for query parser function: ${val}`);
  }

  return fn;
}
