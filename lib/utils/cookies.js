/*!
 * express
 * MIT Licensed
 */

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

const COOKIE_NAME_REGEXP = /^[\u0021-\u003A\u003C\u003E-\u007E]+$/;
const COOKIE_VALUE_REGEXP = /^[\u0021-\u003A\u003C-\u007E]*$/;
const DOMAIN_VALUE_REGEXP = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const PATH_VALUE_REGEXP = /^[\u0020-\u003A\u003D-\u007E]*$/;
const MAX_AGE_REGEXP = /^-?\d+$/;

/**
 * Parse a Cookie header string into an object.
 *
 * @param {string} str
 * @param {{ decode?: Function }} [options]
 * @returns {Record<string, string>}
 */
export function parseCookie(str, options) {
  const obj = Object.create(null);
  const len = str.length;

  if (len < 2) {
    return obj;
  }

  const dec = options?.decode || decode;
  let index = 0;

  do {
    const eqIdx = eqIndex(str, index, len);

    if (eqIdx === -1) {
      break;
    }

    const endIdx = endIndex(str, index, len);
    if (eqIdx > endIdx) {
      index = str.lastIndexOf(';', eqIdx - 1) + 1;
      continue;
    }

    const key = valueSlice(str, index, eqIdx);
    if (obj[key] === undefined) {
      obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
    }

    index = endIdx + 1;
  } while (index < len);

  return obj;
}

export const parse = parseCookie;

/**
 * Serialize a plain object of cookie name/value pairs into a Cookie header.
 *
 * @param {Record<string, unknown>} cookie
 * @param {{ encode?: Function }} [options]
 * @returns {string}
 */
export function stringifyCookie(cookie, options) {
  const enc = options?.encode || encodeURIComponent;
  const cookieStrings = [];

  for (const name of Object.keys(cookie)) {
    const val = cookie[name];

    if (val === undefined) {
      continue;
    }

    if (!COOKIE_NAME_REGEXP.test(name)) {
      throw new TypeError(`cookie name is invalid: ${name}`);
    }

    const value = enc(String(val));
    if (!COOKIE_VALUE_REGEXP.test(value)) {
      throw new TypeError(`cookie val is invalid: ${val}`);
    }

    cookieStrings.push(`${name}=${value}`);
  }

  return cookieStrings.join('; ');
}

/**
 * Serialize a single cookie into a Set-Cookie header value.
 *
 * @param {string|object} nameOrCookie
 * @param {string|object} [valueOrOptions]
 * @param {object} [maybeOptions]
 * @returns {string}
 */
export function stringifySetCookie(nameOrCookie, valueOrOptions, maybeOptions) {
  const cookie = typeof nameOrCookie === 'object'
    ? nameOrCookie
    : { ...maybeOptions, name: nameOrCookie, value: String(valueOrOptions) };
  const options = typeof valueOrOptions === 'object' ? valueOrOptions : maybeOptions;
  const enc = options?.encode || encodeURIComponent;

  if (!COOKIE_NAME_REGEXP.test(cookie.name)) {
    throw new TypeError(`argument name is invalid: ${cookie.name}`);
  }

  const value = cookie.value ? enc(cookie.value) : '';
  if (!COOKIE_VALUE_REGEXP.test(value)) {
    throw new TypeError(`argument val is invalid: ${cookie.value}`);
  }

  let str = `${cookie.name}=${value}`;

  if (cookie.maxAge !== undefined) {
    if (!Number.isInteger(cookie.maxAge)) {
      throw new TypeError(`option maxAge is invalid: ${cookie.maxAge}`);
    }

    str += `; Max-Age=${cookie.maxAge}`;
  }

  if (cookie.domain) {
    if (!DOMAIN_VALUE_REGEXP.test(cookie.domain)) {
      throw new TypeError(`option domain is invalid: ${cookie.domain}`);
    }

    str += `; Domain=${cookie.domain}`;
  }

  if (cookie.path) {
    if (!PATH_VALUE_REGEXP.test(cookie.path)) {
      throw new TypeError(`option path is invalid: ${cookie.path}`);
    }

    str += `; Path=${cookie.path}`;
  }

  if (cookie.expires) {
    if (!isDate(cookie.expires) || !Number.isFinite(cookie.expires.valueOf())) {
      throw new TypeError(`option expires is invalid: ${cookie.expires}`);
    }

    str += `; Expires=${cookie.expires.toUTCString()}`;
  }

  if (cookie.httpOnly) {
    str += '; HttpOnly';
  }

  if (cookie.secure) {
    str += '; Secure';
  }

  if (cookie.partitioned) {
    str += '; Partitioned';
  }

  if (cookie.priority) {
    const priority = typeof cookie.priority === 'string'
      ? cookie.priority.toLowerCase()
      : undefined;

    switch (priority) {
      case 'low':
        str += '; Priority=Low';
        break;
      case 'medium':
        str += '; Priority=Medium';
        break;
      case 'high':
        str += '; Priority=High';
        break;
      default:
        throw new TypeError(`option priority is invalid: ${cookie.priority}`);
    }
  }

  if (cookie.sameSite) {
    const sameSite = typeof cookie.sameSite === 'string'
      ? cookie.sameSite.toLowerCase()
      : cookie.sameSite;

    switch (sameSite) {
      case true:
      case 'strict':
        str += '; SameSite=Strict';
        break;
      case 'lax':
        str += '; SameSite=Lax';
        break;
      case 'none':
        str += '; SameSite=None';
        break;
      default:
        throw new TypeError(`option sameSite is invalid: ${cookie.sameSite}`);
    }
  }

  return str;
}

export const serialize = stringifySetCookie;

/**
 * Parse a Set-Cookie header value into a structured object.
 *
 * @param {string} str
 * @param {{ decode?: Function }} [options]
 * @returns {object}
 */
export function parseSetCookie(str, options) {
  const dec = options?.decode || decode;
  const len = str.length;
  const firstEndIdx = endIndex(str, 0, len);
  const firstEqIdx = eqIndex(str, 0, firstEndIdx);
  const setCookie = firstEqIdx === -1
    ? { name: '', value: dec(valueSlice(str, 0, firstEndIdx)) }
    : {
      name: valueSlice(str, 0, firstEqIdx),
      value: dec(valueSlice(str, firstEqIdx + 1, firstEndIdx))
    };
  let index = firstEndIdx + 1;

  while (index < len) {
    const nextEndIdx = endIndex(str, index, len);
    const nextEqIdx = eqIndex(str, index, nextEndIdx);
    const attr = nextEqIdx === -1
      ? valueSlice(str, index, nextEndIdx)
      : valueSlice(str, index, nextEqIdx);
    const val = nextEqIdx === -1
      ? undefined
      : valueSlice(str, nextEqIdx + 1, nextEndIdx);

    switch (attr.toLowerCase()) {
      case 'httponly':
        setCookie.httpOnly = true;
        break;
      case 'secure':
        setCookie.secure = true;
        break;
      case 'partitioned':
        setCookie.partitioned = true;
        break;
      case 'domain':
        setCookie.domain = val;
        break;
      case 'path':
        setCookie.path = val;
        break;
      case 'max-age':
        if (val && MAX_AGE_REGEXP.test(val)) {
          setCookie.maxAge = Number(val);
        }
        break;
      case 'expires':
        if (!val) {
          break;
        }

        {
          const date = new Date(val);
          if (Number.isFinite(date.valueOf())) {
            setCookie.expires = date;
          }
        }
        break;
      case 'priority':
        if (!val) {
          break;
        }

        {
          const priority = val.toLowerCase();
          if (priority === 'low' || priority === 'medium' || priority === 'high') {
            setCookie.priority = priority;
          }
        }
        break;
      case 'samesite':
        if (!val) {
          break;
        }

        {
          const sameSite = val.toLowerCase();
          if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
            setCookie.sameSite = sameSite;
          }
        }
        break;
      default:
        break;
    }

    index = nextEndIdx + 1;
  }

  return setCookie;
}

/**
 * Sign a cookie value using HMAC-SHA256.
 *
 * @param {string} value
 * @param {string|Buffer} secret
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
 * Verify and unsign a previously signed cookie value.
 *
 * @param {string} input
 * @param {string|Buffer} secret
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
 * Parse a JSON cookie value prefixed with "j:".
 *
 * @param {string} str
 * @returns {any}
 */
export function JSONCookie(str) {
  if (typeof str !== 'string' || !str.startsWith('j:')) {
    return undefined;
  }

  try {
    return JSON.parse(str.slice(2));
  } catch {
    return undefined;
  }
}

/**
 * Parse all JSON cookie values present on an object in place.
 *
 * @param {Record<string, string>} obj
 * @returns {Record<string, unknown>}
 */
export function JSONCookies(obj) {
  for (const key of Object.keys(obj)) {
    const val = JSONCookie(obj[key]);
    if (val) {
      obj[key] = val;
    }
  }

  return obj;
}

/**
 * Parse and verify a signed cookie value prefixed with "s:".
 *
 * @param {string} str
 * @param {string|string[]|Buffer|Buffer[]} secret
 * @returns {string|false|undefined}
 */
export function signedCookie(str, secret) {
  if (typeof str !== 'string') {
    return undefined;
  }

  if (!str.startsWith('s:')) {
    return str;
  }

  const secrets = normalizeSecrets(secret);

  for (const currentSecret of secrets) {
    const val = unsign(str.slice(2), currentSecret);
    if (val !== false) {
      return val;
    }
  }

  return false;
}

/**
 * Extract signed cookies from an object and return them in a new object.
 *
 * @param {Record<string, string>} obj
 * @param {string|string[]|Buffer|Buffer[]} secret
 * @returns {Record<string, string|false|undefined>}
 */
export function signedCookies(obj, secret) {
  const ret = Object.create(null);

  for (const key of Object.keys(obj)) {
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
 * Create cookie parsing middleware compatible with Express request objects.
 *
 * @param {string|string[]|Buffer|Buffer[]} [secret]
 * @param {{ decode?: Function }} [options]
 * @returns {Function}
 */
export default function cookieParser(secret, options) {
  const secrets = normalizeSecrets(secret);

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

    req.cookies = parseCookie(cookieHeader, options);

    if (secrets.length !== 0) {
      req.signedCookies = signedCookies(req.cookies, secrets);
      req.signedCookies = JSONCookies(req.signedCookies);
    }

    req.cookies = JSONCookies(req.cookies);
    return next();
  };
}

function endIndex(str, min, len) {
  const index = str.indexOf(';', min);
  return index === -1 ? len : index;
}

function eqIndex(str, min, max) {
  const index = str.indexOf('=', min);
  return index < max ? index : -1;
}

function valueSlice(str, min, max) {
  let start = min;
  let end = max;

  do {
    const code = str.charCodeAt(start);
    if (code !== 0x20 && code !== 0x09) {
      break;
    }
  } while (++start < end);

  while (end > start) {
    const code = str.charCodeAt(end - 1);
    if (code !== 0x20 && code !== 0x09) {
      break;
    }

    end--;
  }

  return str.slice(start, end);
}

function decode(str) {
  if (!str.includes('%')) {
    return str;
  }

  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function isDate(val) {
  return val instanceof Date;
}

function normalizeSecrets(secret) {
  if (secret == null) {
    return [];
  }

  return Array.isArray(secret) ? secret : [secret];
}
