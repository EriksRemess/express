/*!
 * express
 * MIT Licensed
 */

import cookieParser, {
  parse,
  parseCookie,
  parseSetCookie,
  serialize,
  sign,
  stringifyCookie,
  stringifySetCookie,
  unsign,
} from "#lib/utils/cookies";

const cookie = {
  parse,
  parseCookie,
  parseSetCookie,
  parser: cookieParser,
  serialize,
  sign,
  stringifyCookie,
  stringifySetCookie,
  unsign,
};

export {
  parse,
  parseCookie, cookieParser as parser, parseSetCookie, serialize,
  sign,
  stringifyCookie,
  stringifySetCookie,
  unsign
};

export default cookie;
