/*!
 * express
 * MIT Licensed
 */

import proxyaddr from "#lib/utils/proxy-addr";

/**
 * Compile an application "trust proxy" setting into a trust function.
 *
 * @param {boolean|number|string|string[]|Function} val
 * @returns {Function}
 */
export function compileTrust(val) {
  if (typeof val === "function") {
    return val;
  }

  if (val === true) {
    return () => true;
  }

  if (typeof val === "number") {
    return (address, index) => index < val;
  }

  if (typeof val === "string") {
    val = val.split(",").map((value) => value.trim());
  }

  return proxyaddr.compile(val || []);
}
