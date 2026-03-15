/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import cookie from 'cookie';

/**
 * Sign the given cookie value with the given secret.
 *
 * @param {string} value
 * @param {string|NodeJS.ArrayBufferView|crypto.KeyObject} secret
 * @returns {string}
 */
export function sign(value, secret) {
  if (typeof value !== 'string') {
    throw new TypeError('Cookie value must be provided as a string.');
  }

  if (secret == null) {
    throw new TypeError('Secret key must be provided.');
  }

  return `${value}.${crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/\=+$/, '')}`;
}

/**
 * Unsign the given cookie value using the given secret.
 *
 * @param {string} input
 * @param {string|NodeJS.ArrayBufferView|crypto.KeyObject} secret
 * @returns {string|false}
 */
export function unsign(input, secret) {
  if (typeof input !== 'string') {
    throw new TypeError('Signed cookie string must be provided.');
  }

  if (secret == null) {
    throw new TypeError('Secret key must be provided.');
  }

  const tentativeValue = input.slice(0, input.lastIndexOf('.'));
  const expectedInput = sign(tentativeValue, secret);
  const expectedBuffer = Buffer.from(expectedInput);
  const inputBuffer = Buffer.from(input);

  return expectedBuffer.length === inputBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, inputBuffer)
    ? tentativeValue
    : false;
}

/**
 * Parse JSON cookie string.
 *
 * @param {string} str
 * @returns {*}
 */
export function JSONCookie(str) {
  if (typeof str !== 'string' || str.substring(0, 2) !== 'j:') {
    return undefined;
  }

  try {
    return JSON.parse(str.slice(2));
  } catch {
    return undefined;
  }
}

/**
 * Parse JSON cookies in-place.
 *
 * @param {Record<string, *>} obj
 * @returns {Record<string, *>}
 */
export function JSONCookies(obj) {
  const cookies = Object.keys(obj);
  for (let i = 0; i < cookies.length; i++) {
    const key = cookies[i];
    const val = JSONCookie(obj[key]);
    if (val) {
      obj[key] = val;
    }
  }

  return obj;
}

/**
 * Parse one possibly signed cookie.
 *
 * @param {*} str
 * @param {string|string[]} secret
 * @returns {*}
 */
export function signedCookie(str, secret) {
  if (typeof str !== 'string') {
    return undefined;
  }

  if (str.substring(0, 2) !== 's:') {
    return str;
  }

  const secrets = !secret || Array.isArray(secret)
    ? (secret || [])
    : [secret];

  for (let i = 0; i < secrets.length; i++) {
    const val = unsign(str.slice(2), secrets[i]);
    if (val !== false) {
      return val;
    }
  }

  return false;
}

/**
 * Parse signed cookies, removing signed values from `obj`.
 *
 * @param {Record<string, *>} obj
 * @param {string|string[]} secret
 * @returns {Record<string, *>}
 */
export function signedCookies(obj, secret) {
  const cookies = Object.keys(obj);
  const ret = Object.create(null);

  for (let i = 0; i < cookies.length; i++) {
    const key = cookies[i];
    const val = obj[key];
    const dec = signedCookie(val, secret);

    if (val !== dec) {
      ret[key] = dec;
      delete obj[key];
    }
  }

  return ret;
}

/**
 * Parse Cookie header and populate `req.cookies` and `req.signedCookies`.
 *
 * @param {string|string[]} [secret]
 * @param {object} [options]
 * @returns {import('express').RequestHandler}
 */
export default function cookieParser(secret, options) {
  const secrets = !secret || Array.isArray(secret)
    ? (secret || [])
    : [secret];

  return function cookieParserMiddleware(req, res, next) {
    if (req.cookies) {
      return next();
    }

    const cookieHeader = req.headers.cookie;

    req.secret = secrets[0];
    req.cookies = Object.create(null);
    req.signedCookies = Object.create(null);

    if (!cookieHeader) {
      return next();
    }

    req.cookies = cookie.parse(cookieHeader, options);

    if (secrets.length !== 0) {
      req.signedCookies = signedCookies(req.cookies, secrets);
      req.signedCookies = JSONCookies(req.signedCookies);
    }

    req.cookies = JSONCookies(req.cookies);
    return next();
  };
}
