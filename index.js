/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

import express from "#lib/express";

export const application = express.application;
export const cookie = express.cookie;
export const request = express.request;
export const response = express.response;
export const Route = express.Route;
export const Router = express.Router;
export const json = express.json;
export const raw = express.raw;
export const text = express.text;
export const urlencoded = express.urlencoded;
const staticMiddleware = express.static;
export { staticMiddleware as static };

export default express;
