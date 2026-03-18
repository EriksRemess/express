/*!
 * express
 * MIT Licensed
 */

/**
 * Parse a flat query string while preserving repeated keys as arrays.
 *
 * @param {string} str
 * @returns {object}
 */
export function parseSimpleQueryString(str) {
  const query = Object.create(null);

  if (typeof str !== "string" || str === "") {
    return query;
  }

  if (str.indexOf("+") === -1 && str.indexOf("%") === -1) {
    parseSimpleQueryStringWithoutDecoding(str, query);
    return query;
  }

  for (const [key, value] of new URLSearchParams(str)) {
    appendSimpleQueryValue(query, key, value);
  }

  return query;
}

/**
 * Parse nested query string keys using bracket notation.
 *
 * @param {string} str
 * @param {object} [options]
 * @param {number} [options.depth]
 * @param {boolean} [options.throwOnDepthLimit]
 * @returns {object}
 */
export function parseExtendedQueryString(str, options = {}) {
  const query = Object.create(null);

  for (const [key, value] of new URLSearchParams(str)) {
    const path = parseQueryPath(key, options);
    if (hasUnsafeQueryPathSegment(path)) {
      continue;
    }

    assignQueryValue(query, path, value);
  }

  return query;
}

function parseQueryPath(key, options) {
  const path = [];
  const maxDepth = options.depth ?? Infinity;
  let index = key.indexOf("[");

  if (index === -1) {
    path.push(key);
    return path;
  }

  path.push(key.slice(0, index));

  while (index < key.length) {
    if (key.charCodeAt(index) !== 0x5b) {
      break;
    }

    if (path.length > maxDepth) {
      if (options.throwOnDepthLimit) {
        throw new RangeError("The input exceeded the depth");
      }

      break;
    }

    const end = key.indexOf("]", index + 1);
    if (end === -1) {
      path.push(key.slice(index + 1));
      break;
    }

    path.push(key.slice(index + 1, end));
    index = end + 1;
  }

  return path;
}

function assignQueryValue(root, path, value) {
  let current = root;
  let parent;
  let parentSegment;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const isLast = i === path.length - 1;

    if (isLast) {
      setFinalValue(current, segment, value);
      return;
    }

    const next = path[i + 1];
    const container = shouldUseArray(next) ? [] : Object.create(null);

    if (segment === "") {
      if (!Array.isArray(current)) {
        return;
      }

      current.push(container);
      parent = current;
      parentSegment = current.length - 1;
      current = container;
      continue;
    }

    if (Array.isArray(current) && !isArrayIndex(segment)) {
      current = promoteArrayToObject(current);
      parent[parentSegment] = current;
    }

    if (Array.isArray(current) && isArrayIndex(segment)) {
      const index = Number(segment);
      current[index] = normalizeQueryContainer(current[index], next);
      parent = current;
      parentSegment = index;
      current = current[index];
      continue;
    }

    current[segment] = normalizeQueryContainer(current[segment], next);
    parent = current;
    parentSegment = segment;
    current = current[segment];
  }
}

function setFinalValue(target, segment, value) {
  if (segment === "") {
    if (Array.isArray(target)) {
      target.push(value);
    }
    return;
  }

  if (Array.isArray(target) && isArrayIndex(segment)) {
    const index = Number(segment);
    if (target[index] === undefined) {
      target[index] = value;
      return;
    }

    if (Array.isArray(target[index])) {
      target[index].push(value);
      return;
    }

    target[index] = [target[index], value];
    return;
  }

  if (target[segment] === undefined) {
    target[segment] = value;
    return;
  }

  if (Array.isArray(target[segment])) {
    target[segment].push(value);
    return;
  }

  target[segment] = [target[segment], value];
}

function shouldUseArray(segment) {
  return segment === "" || isArrayIndex(segment);
}

function normalizeQueryContainer(current, nextSegment) {
  if (current === undefined) {
    return shouldUseArray(nextSegment)
      ? []
      : Object.create(null);
  }

  if (Array.isArray(current)) {
    return shouldUseArray(nextSegment)
      ? current
      : promoteArrayToObject(current);
  }

  if (isObjectLike(current)) {
    return current;
  }

  if (shouldUseArray(nextSegment)) {
    return [current];
  }

  const promoted = Object.create(null);
  promoted[0] = current;
  return promoted;
}

function promoteArrayToObject(array) {
  const promoted = Object.create(null);

  for (let i = 0; i < array.length; i++) {
    if (array[i] !== undefined) {
      promoted[i] = array[i];
    }
  }

  for (const key of Object.keys(array)) {
    if (!isArrayIndex(key) && array[key] !== undefined) {
      promoted[key] = array[key];
    }
  }

  return promoted;
}

function isArrayIndex(segment) {
  return /^[0-9]+$/.test(segment);
}

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function hasUnsafeQueryPathSegment(path) {
  for (let i = 0; i < path.length; i++) {
    if (isUnsafeQueryPathSegment(path[i])) {
      return true;
    }
  }

  return false;
}

function isUnsafeQueryPathSegment(segment) {
  return segment === "__proto__"
    || segment === "constructor"
    || segment === "prototype";
}

function appendSimpleQueryValue(query, key, value) {
  const current = query[key];

  if (current === undefined) {
    query[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  query[key] = [current, value];
}

function parseSimpleQueryStringWithoutDecoding(str, query) {
  let start = 0;

  while (start <= str.length) {
    let separator = str.indexOf("&", start);
    if (separator === -1) {
      separator = str.length;
    }

    const pair = str.slice(start, separator);
    if (pair === "") {
      if (separator === str.length) {
        return;
      }

      start = separator + 1;
      continue;
    }

    const equals = pair.indexOf("=");

    if (equals === -1) {
      appendSimpleQueryValue(query, pair, "");
    } else {
      appendSimpleQueryValue(
        query,
        pair.slice(0, equals),
        pair.slice(equals + 1),
      );
    }

    if (separator === str.length) {
      return;
    }

    start = separator + 1;
  }
}
