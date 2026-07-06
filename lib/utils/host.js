/*!
 * express
 * MIT Licensed
 */

const PORT_REGEXP = /^[0-9]+$/;

/**
 * Parse a Host header value into a hostname.
 *
 * @param {string} host
 * @returns {string}
 */
export function parseHostname(host) {
  const index = getPortSeparatorIndex(host);

  return index !== -1 && PORT_REGEXP.test(host.substring(index + 1))
    ? host.substring(0, index)
    : host;
}

function getPortSeparatorIndex(host) {
  if (host[0] !== '[') {
    return host.indexOf(':');
  }

  const end = host.indexOf(']');
  return end !== -1
    ? host.indexOf(':', end + 1)
    : -1;
}
