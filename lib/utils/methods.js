/*!
 * express
 * MIT Licensed
 */

import { METHODS } from "node:http";

/**
 * Lower-cased HTTP methods supported by the current Node runtime.
 *
 * @type {string[]}
 */
export const httpMethods = METHODS.map((method) => method.toLowerCase());
