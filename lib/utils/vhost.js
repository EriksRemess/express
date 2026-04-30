/*!
 * express
 * MIT Licensed
 */

const asteriskRegExp = /\*/g;
const asteriskReplace = '([^\\.]+)';
const endAnchoredRegExp = /(?:^|[^\\])(?:\\\\)*\$$/;
const escapeRegExp = /([.+?^=!:${}()|\[\]\/\\])/g;
const escapeReplace = '\\$1';
import { parseHostname } from './host.js';
import { getOwnOption } from './options.js';

/**
 * Create a virtual host middleware.
 *
 * @param {string|RegExp} hostname
 * @param {function} handle
 * @returns {function}
 */
export default function vhost(hostname, handle) {
  if (!hostname) {
    throw new TypeError('argument hostname is required');
  }

  if (!handle) {
    throw new TypeError('argument handle is required');
  }

  if (typeof handle !== 'function') {
    throw new TypeError('argument handle must be a function');
  }

  const regexp = hostregexp(hostname);

  return function vhostMiddleware(req, res, next) {
    const vhostdata = vhostof(req, regexp);
    if (!vhostdata) {
      return next();
    }

    req.vhost = vhostdata;
    return handle(req, res, next);
  };
}

/**
 * Get hostname of request.
 *
 * @param {object} req
 * @returns {string|undefined}
 */
function hostnameof(req) {
  const hostname = req.hostname;
  if (typeof hostname === 'string') {
    return hostname;
  }

  const host = getOwnOption(req.headers, 'host');
  if (!host) {
    return;
  }

  return parseHostname(host);
}

/**
 * Determine if value is RegExp.
 *
 * @param {*} val
 * @returns {boolean}
 */
function isregexp(val) {
  return val instanceof RegExp;
}

/**
 * Generate RegExp for given hostname value.
 *
 * @param {string|RegExp} val
 * @returns {RegExp}
 */
function hostregexp(val) {
  let source = !isregexp(val)
    ? String(val).replace(escapeRegExp, escapeReplace).replace(asteriskRegExp, asteriskReplace)
    : val.source;

  if (source[0] !== '^') {
    source = `^${source}`;
  }

  if (!endAnchoredRegExp.test(source)) {
    source += '$';
  }

  return new RegExp(source, 'i');
}

/**
 * Get the vhost data of the request for regexp.
 *
 * @param {object} req
 * @param {RegExp} regexp
 * @returns {object|undefined}
 */
function vhostof(req, regexp) {
  const host = hostof(req);
  const hostname = hostnameof(req);

  if (!hostname) {
    return;
  }

  const match = regexp.exec(hostname);
  if (!match) {
    return;
  }

  const obj = Object.create(null);
  obj.host = host;
  obj.hostname = hostname;
  obj.length = match.length - 1;

  for (let i = 1; i < match.length; i++) {
    obj[i - 1] = match[i];
  }

  return obj;
}

function hostof(req) {
  const host = req.host;
  return typeof host === 'string'
    ? host
    : getOwnOption(req.headers, 'host');
}
