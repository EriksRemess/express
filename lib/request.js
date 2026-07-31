/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

import accepts from '#lib/utils/accepts';

import { isFresh } from '#lib/utils/fresh';
import { parseHostname } from '#lib/utils/host';
import { getOwnOption } from '#lib/utils/options';
import parse from '#lib/utils/parseurl';
import proxyaddr from '#lib/utils/proxy-addr';
import parseRange from '#lib/utils/range-parser';
import typeis from '#lib/utils/type-is';
import http from 'node:http';
import { isIP } from 'node:net';

/**
 * Request prototype.
 * @public
 */

const req = Object.create(http.IncomingMessage.prototype);

/**
 * Module exports.
 * @public
 */

export default req;

/**
 * Return request header.
 *
 * The `Referrer` header field is special-cased,
 * both `Referrer` and `Referer` are interchangeable.
 *
 * Examples:
 *
 *     req.get('Content-Type');
 *     // => "text/plain"
 *
 *     req.get('content-type');
 *     // => "text/plain"
 *
 *     req.get('Something');
 *     // => undefined
 *
 * Aliased as `req.header()`.
 *
 * @param {String} name
 * @return {String}
 * @public
 */

req.get =
req.header = function header(name) {
  if (!name) {
    throw new TypeError('name argument is required to req.get');
  }

  if (typeof name !== 'string') {
    throw new TypeError('name must be a string to req.get');
  }

  const lc = name.toLowerCase();

  switch (lc) {
    case 'referer':
    case 'referrer':
      return getOwnOption(this.headers, 'referrer')
        || getOwnOption(this.headers, 'referer');
    default:
      return getOwnOption(this.headers, lc);
  }
};

/**
 * Check if the given `type(s)` is acceptable, returning
 * the best match when true, otherwise `false`, in which
 * case you should respond with 406 "Not Acceptable".
 *
 * The `type` value may be a single MIME type string
 * such as "application/json", an extension name
 * such as "json", an argument list such as `"json", "html", "text/plain"`,
 * or an array `["json", "html", "text/plain"]`. When a list
 * or array is given, the _best_ match, if any is returned.
 *
 * Examples:
 *
 *     // Accept: text/html
 *     req.accepts('html');
 *     // => "html"
 *
 *     // Accept: text/*, application/json
 *     req.accepts('html');
 *     // => "html"
 *     req.accepts('text/html');
 *     // => "text/html"
 *     req.accepts('json', 'text');
 *     // => "json"
 *     req.accepts('application/json');
 *     // => "application/json"
 *
 *     // Accept: text/*, application/json
 *     req.accepts('image/png');
 *     req.accepts('png');
 *     // => false
 *
 *     // Accept: text/*;q=.5, application/json
 *     req.accepts(['html', 'json']);
 *     req.accepts('html', 'json');
 *     // => "json"
 *
 * @param {String|Array} type(s)
 * @return {String|Array|Boolean}
 * @public
 */

req.accepts = function(...types){
  return accepts(this).types(...types);
};

/**
 * Check if the given `encoding`s are accepted.
 *
 * @param {String} ...encoding
 * @return {String|Array}
 * @public
 */

req.acceptsEncodings = function(...encodings){
  return accepts(this).encodings(...encodings);
};

/**
 * Checks if the specified `charset`s are acceptable based on the request's `Accept-Charset` header.
 * Returns the best matching charset or an array of acceptable charsets.
 *
 * The `charset` argument(s) can be:
 * - A single charset string (e.g., "utf-8")
 * - Multiple charset strings as arguments (e.g., `"utf-8", "iso-8859-1"`)
 * - A comma-delimited list of charsets (e.g., `"utf-8, iso-8859-1"`)
 *
 * Examples:
 *
 *     // Accept-Charset: utf-8, iso-8859-1
 *     req.acceptsCharsets('utf-8');
 *     // => "utf-8"
 *
 *     req.acceptsCharsets('utf-8', 'iso-8859-1');
 *     // => "utf-8"
 *
 *     req.acceptsCharsets('utf-8, utf-16');
 *     // => "utf-8"
 *
 * @param {...String} charsets - The charset(s) to check against the `Accept-Charset` header.
 * @return {String|Array} - The best matching charset, or an array of acceptable charsets.
 * @public
 */

req.acceptsCharsets = function(...charsets) {
  const accept = accepts(this);
  return accept.charsets(...charsets);
};

/**
 * Check if the given `lang`s are acceptable,
 * otherwise you should respond with 406 "Not Acceptable".
 *
 * @param {String} ...lang
 * @return {String|Array}
 * @public
 */

req.acceptsLanguages = function(...languages) {
  return accepts(this).languages(...languages);
};

/**
 * Parse Range header field, capping to the given `size`.
 *
 * Unspecified ranges such as "0-" require knowledge of your resource length. In
 * the case of a byte range this is of course the total number of bytes. If the
 * Range header field is not given `undefined` is returned, `-1` when unsatisfiable,
 * and `-2` when syntactically invalid.
 *
 * When ranges are returned, the array has a "type" property which is the type of
 * range that is required (most commonly, "bytes"). Each array element is an object
 * with a "start" and "end" property for the portion of the range.
 *
 * The "combine" option can be set to `true` and overlapping & adjacent ranges
 * will be combined into a single range.
 *
 * NOTE: remember that ranges are inclusive, so for example "Range: users=0-3"
 * should respond with 4 users when available, not 3.
 *
 * @param {number} size
 * @param {object} [options]
 * @param {boolean} [options.combine=false]
 * @return {number|array}
 * @public
 */

req.range = function range(size, options) {
  const range = this.get('Range');
  if (!range) return;
  return parseRange(size, range, options);
};

/**
 * Parse the query string of `req.url`.
 *
 * This uses the "query parser" setting to parse the raw
 * string into an object.
 *
 * @return {String}
 * @api public
 */

defineGetter(req, 'query', function query(){
  const queryparse = this.app.get('query parser fn');

  if (!queryparse) {
    // parsing is disabled
    return Object.create(null);
  }

  const querystring = parse(this).query;

  return queryparse(querystring);
});

/**
 * Check if the incoming request contains the "Content-Type"
 * header field, and it contains the given mime `type`.
 *
 * Examples:
 *
 *      // With Content-Type: text/html; charset=utf-8
 *      req.is('html');
 *      req.is('text/html');
 *      req.is('text/*');
 *      // => true
 *
 *      // When Content-Type is application/json
 *      req.is('json');
 *      req.is('application/json');
 *      req.is('application/*');
 *      // => true
 *
 *      req.is('html');
 *      // => false
 *
 * @param {String|Array} types...
 * @return {String|false|null}
 * @public
 */

req.is = function is(...types) {
  const expected = types.length === 1 && Array.isArray(types[0])
    ? types[0]
    : types;

  return typeis(this, expected);
};

/**
 * Return the protocol string "http" or "https"
 * when requested with TLS. When the "trust proxy"
 * setting trusts the socket address, the
 * "X-Forwarded-Proto" header field will be trusted
 * and used if present.
 *
 * If you're running behind a reverse proxy that
 * supplies https for you this may be enabled.
 *
 * @return {String}
 * @public
 */

defineGetter(req, 'protocol', function protocol(){
  const proto = this.socket.encrypted
    ? 'https'
    : 'http';
  const trust = this.app.get('trust proxy fn');

  if (!trust(this.socket.remoteAddress, 0)) {
    return proto;
  }

  // Note: X-Forwarded-Proto is normally only ever a
  //       single value, but this is to be safe.
  const header = this.get('X-Forwarded-Proto') || proto;
  const index = header.indexOf(',');
  const forwardedProto = index !== -1
    ? header.substring(0, index).trim()
    : header.trim()

  switch (forwardedProto.toLowerCase()) {
    case 'http':
      return 'http';
    case 'https':
      return 'https';
    default:
      return proto;
  }
});

/**
 * Short-hand for:
 *
 *    req.protocol === 'https'
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'secure', function secure(){
  return this.protocol === 'https';
});

/**
 * Return the remote address from the trusted proxy.
 *
 * The is the remote address on the socket unless
 * "trust proxy" is set.
 *
 * @return {String}
 * @public
 */

defineGetter(req, 'ip', function ip(){
  const trust = this.app.get('trust proxy fn');
  return proxyaddr(this, trust);
});

/**
 * When "trust proxy" is set, trusted proxy addresses + client.
 *
 * For example if the value were "client, proxy1, proxy2"
 * you would receive the array `["client", "proxy1", "proxy2"]`
 * where "proxy2" is the furthest down-stream and "proxy1" and
 * "proxy2" were trusted.
 *
 * @return {Array}
 * @public
 */

defineGetter(req, 'ips', function ips() {
  const trust = this.app.get('trust proxy fn');
  const addrs = proxyaddr.all(this, trust);

  // reverse the order (to farthest -> closest)
  // and remove socket address
  addrs.reverse().pop()

  return addrs
});

/**
 * Return subdomains as an array.
 *
 * Subdomains are the dot-separated parts of the host before the main domain of
 * the app. By default, the domain of the app is assumed to be the last two
 * parts of the host. This can be changed by setting "subdomain offset".
 *
 * For example, if the domain is "tobi.ferrets.example.com":
 * If "subdomain offset" is not set, req.subdomains is `["ferrets", "tobi"]`.
 * If "subdomain offset" is 3, req.subdomains is `["tobi"]`.
 *
 * @return {Array}
 * @public
 */

defineGetter(req, 'subdomains', function subdomains() {
  const hostname = this.hostname;

  if (!hostname) return [];

  const offset = this.app.get('subdomain offset');
  const subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname];

  return subdomains.slice(offset);
});

/**
 * Short-hand for `parseurl(req).pathname`.
 *
 * @return {String}
 * @public
 */

defineGetter(req, 'path', function path() {
  return parse(this).pathname;
});

/**
 * Parse the "Host" header field to a host.
 *
 * When the "trust proxy" setting trusts the socket
 * address, the "X-Forwarded-Host" header field will
 * be trusted.
 *
 * @return {String}
 * @public
 */

defineGetter(req, 'host', function host(){
  const trust = this.app.get('trust proxy fn');
  let val = this.get('X-Forwarded-Host');

  if (!val || !trust(this.socket.remoteAddress, 0)) {
    val = this.get('Host');
  } else if (val.indexOf(',') !== -1) {
    // Note: X-Forwarded-Host is normally only ever a
    //       single value, but this is to be safe.
    val = val.substring(0, val.indexOf(',')).trimEnd()
  }

  return val || undefined;
});

/**
 * Parse the "Host" header field to a hostname.
 *
 * When the "trust proxy" setting trusts the socket
 * address, the "X-Forwarded-Host" header field will
 * be trusted.
 *
 * @return {String}
 * @api public
 */

defineGetter(req, 'hostname', function hostname(){
  const host = this.host;

  if (!host) return;

  return parseHostname(host);
});

/**
 * Check if the request is fresh, aka
 * Last-Modified or the ETag
 * still match.
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'fresh', function(){
  const method = this.method;
  const res = this.res;
  const status = res.statusCode;

  // GET, HEAD, or QUERY for weak freshness validation only
  if ('GET' !== method && 'HEAD' !== method && 'QUERY' !== method) return false;

  // 2xx or 304 as per rfc2616 14.26
  if ((status >= 200 && status < 300) || 304 === status) {
    return isFresh(
      this.headers,
      res.get('ETag'),
      res.get('Last-Modified'),
    );
  }

  return false;
});

/**
 * Check if the request is stale, aka
 * "Last-Modified" and / or the "ETag" for the
 * resource has changed.
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'stale', function stale(){
  return !this.fresh;
});

/**
 * Check if the request was an _XMLHttpRequest_.
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'xhr', function xhr(){
  const val = this.get('X-Requested-With') || '';
  return val.toLowerCase() === 'xmlhttprequest';
});

/**
 * Helper function for creating a getter on an object.
 *
 * @param {Object} obj
 * @param {String} name
 * @param {Function} getter
 * @private
 */
function defineGetter(obj, name, getter) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: getter
  });
}
