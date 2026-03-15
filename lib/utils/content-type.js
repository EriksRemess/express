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
  let colonIndex = str.indexOf(";");
  let index = colonIndex === -1 ? length : colonIndex;
  const ret = { value: str.slice(0, index).trim(), quality: 1, params: {} };

  while (index < length) {
    const splitIndex = str.indexOf("=", index);
    if (splitIndex === -1) {
      break;
    }

    colonIndex = str.indexOf(";", index);
    const endIndex = colonIndex === -1 ? length : colonIndex;

    if (splitIndex > endIndex) {
      index = str.lastIndexOf(";", splitIndex - 1) + 1;
      continue;
    }

    const key = str.slice(index, splitIndex).trim();
    const value = str.slice(splitIndex + 1, endIndex).trim();

    if (key === "q") {
      ret.quality = Number.parseFloat(value);
    } else {
      ret.params[key] = value;
    }

    index = endIndex + 1;
  }

  return ret;
}
