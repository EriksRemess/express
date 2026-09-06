/*!
 * express
 * MIT Licensed
 */

const ABSOLUTE_URL_PREFIX_REGEXP = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*/;

/** Return the raw scheme and authority prefix of an absolute request target. */
export function getProtohost(url) {
  return typeof url === 'string'
    ? ABSOLUTE_URL_PREFIX_REGEXP.exec(url)?.[0]
    : undefined;
}

/**
 * Parse `req.url` with memoization.
 *
 * @param {import('node:http').IncomingMessage & { _parsedUrl?: object }} req
 * @returns {object|undefined}
 */
export default function parseurl(req) {
  const url = req.url;
  if (url === undefined) {
    return undefined;
  }

  let parsed = Object.hasOwn(req, '_parsedUrl')
    ? req._parsedUrl
    : undefined;
  if (fresh(url, parsed)) {
    return parsed;
  }

  parsed = fastparse(url);
  parsed._raw = url;
  req._parsedUrl = parsed;
  return parsed;
}

/**
 * Parse `req.originalUrl` with fallback and memoization.
 *
 * @param {import('node:http').IncomingMessage & { originalUrl?: string, _parsedOriginalUrl?: object }} req
 * @returns {object|undefined}
 */
export function originalurl(req) {
  const url = Object.hasOwn(req, 'originalUrl')
    ? req.originalUrl
    : undefined;

  if (typeof url !== 'string') {
    return parseurl(req);
  }

  let parsed = Object.hasOwn(req, '_parsedOriginalUrl')
    ? req._parsedOriginalUrl
    : undefined;
  if (fresh(url, parsed)) {
    return parsed;
  }

  parsed = fastparse(url);
  parsed._raw = url;
  req._parsedOriginalUrl = parsed;
  return parsed;
}

function fastparse(str) {
  if (typeof str !== 'string' || str.length === 0 || str.charCodeAt(0) !== 0x2f /* / */) {
    return looseParse(str);
  }

  let pathname = str;
  let query = null;
  let search = null;

  // Equivalent to /^(\/[^?#\s]*)(\?[^#\s]*)?$/
  for (let i = 1; i < str.length; i++) {
    switch (str.charCodeAt(i)) {
      case 0x3f: // ?
        if (search === null) {
          pathname = str.substring(0, i);
          query = str.substring(i + 1);
          search = str.substring(i);
        }
        break;
      case 0x09: // \t
      case 0x0a: // \n
      case 0x0c: // \f
      case 0x0d: // \r
      case 0x20: // space
      case 0x23: // #
      case 0xa0:
      case 0xfeff:
        return looseParse(str);
      default:
        break;
    }
  }

  const url = {};

  url.path = str;
  url.href = str;
  url.pathname = pathname;
  url.query = query;
  url.search = search;

  return url;
}

function fresh(url, parsedUrl) {
  return typeof parsedUrl === 'object'
    && parsedUrl !== null
    && parsedUrl._raw === url;
}

function looseParse(str) {
  if (str === '') {
    return {
      href: '',
      path: null,
      pathname: null,
      query: null,
      search: null
    };
  }

  if (typeof str !== 'string') {
    return {
      href: str,
      path: str,
      pathname: str
    };
  }

  // Mount trimming slices req.url by pathname offsets. Preserve the raw path:
  // WHATWG URL normalization removes dot segments and changes those offsets.
  const protohost = getProtohost(str);
  const start = protohost?.length ?? 0;
  const hashIndex = str.indexOf('#', start);
  const end = hashIndex === -1 ? str.length : hashIndex;
  const queryIndex = str.indexOf('?', start);
  const hasQuery = queryIndex !== -1 && queryIndex < end;
  const pathname = str.slice(start, hasQuery ? queryIndex : end) || (protohost ? '/' : '');
  const search = hasQuery ? str.slice(queryIndex, end) : null;

  return {
    href: str,
    pathname,
    path: pathname + (search || ''),
    search,
    query: hasQuery ? str.slice(queryIndex + 1, end) : null,
  };
}
