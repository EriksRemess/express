/*!
 * express
 * MIT Licensed
 */

/** Set a response length only when transfer coding does not define framing. */
export function setContentLength(res, length) {
  if (res.getHeader('Transfer-Encoding') !== undefined) {
    res.removeHeader('Content-Length');
  } else {
    res.setHeader('Content-Length', length);
  }
}
