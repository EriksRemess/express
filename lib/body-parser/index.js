/*!
 * express
 * MIT Licensed
 */

import json from "#lib/body-parser/json";
import raw from "#lib/body-parser/raw";
import text from "#lib/body-parser/text";
import urlencoded from "#lib/body-parser/urlencoded";

const bodyParser = {
  json,
  raw,
  text,
  urlencoded,
};

export { json, raw, text, urlencoded };

export default bodyParser;
