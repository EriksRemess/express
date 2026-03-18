/*!
 * express
 * MIT Licensed
 */

import mime from "mime-types";

/**
 * Normalize a content type or extension into the structure used by
 * content negotiation helpers.
 *
 * @param {string} type
 * @returns {{ value: string, params: object, quality?: number }}
 */
export function normalizeType(type) {
  return type.includes("/")
    ? acceptParams(type)
    : { value: mime.lookup(type) || "application/octet-stream", params: {} };
}

/**
 * Normalize an array of content types or extensions.
 *
 * @param {string[]} types
 * @returns {Array<{ value: string, params: object, quality?: number }>}
 */
export function normalizeTypes(types) {
  return types.map(normalizeType);
}

/**
 * Set or replace the charset parameter on a media type string.
 *
 * @param {string} type
 * @param {string} charset
 * @returns {string|undefined}
 */
export function setCharset(type, charset) {
  if (!type || !charset) {
    return type;
  }

  const segments = String(type).split(";");
  const mediaType = segments.shift().trim();

  if (mediaType.length === 0) {
    throw new TypeError("invalid media type");
  }

  const params = [];
  for (let i = 0; i < segments.length; i++) {
    const value = segments[i].trim();
    if (!value || /^charset\s*=/i.test(value)) {
      continue;
    }

    params.push(value);
  }

  params.push(`charset=${charset}`);
  return `${mediaType}; ${params.join("; ")}`;
}

function acceptParams(str) {
  const length = str.length;
  const segments = splitParameters(str);
  let index = str.indexOf(";");
  index = index === -1 ? length : index;
  const ret = { value: str.slice(0, index).trim(), quality: 1, params: {} };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const splitIndex = segment.indexOf("=");

    if (splitIndex === -1) {
      break;
    }

    const key = segment.slice(0, splitIndex).trim();
    const value = segment.slice(splitIndex + 1).trim();

    if (key === "q") {
      ret.quality = Number.parseFloat(value);
    } else {
      ret.params[key] = value;
    }
  }

  return ret;
}

function splitParameters(value) {
  const parameters = value.split(";");
  let last = 0;

  for (let i = 1, j = 0; i < parameters.length; i++) {
    if (quoteCount(parameters[j]) % 2 === 0) {
      parameters[++j] = parameters[i];
      last = j;
    } else {
      parameters[j] += `;${parameters[i]}`;
      last = j;
    }
  }

  parameters.length = parameters.length === 0
    ? 0
    : last + 1;

  for (let i = 0; i < parameters.length; i++) {
    parameters[i] = parameters[i].trim();
  }

  return parameters;
}

function quoteCount(value) {
  let count = 0;
  let index = 0;

  while ((index = value.indexOf('"', index)) !== -1) {
    count++;
    index++;
  }

  return count;
}
