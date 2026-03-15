/*!
 * express
 * MIT Licensed
 */

import { formatWithOptions } from "node:util";

let cachedPattern = null;
let cachedEnabled = [];
let cachedDisabled = [];
let compiledVersion = 0;

/**
 * Create a DEBUG-aware logger for an internal namespace.
 *
 * Supported patterns match the subset Express uses from the `debug` module:
 * comma/space separated namespaces, `*` wildcards, and `-` exclusions.
 *
 * @param {string} namespace
 * @returns {Function}
 */
export default function createDebug(namespace) {
  function debug(...args) {
    if (!isEnabled(debug)) {
      return;
    }

    const message = formatWithOptions({ colors: false }, ...args);
    process.stderr.write(`${namespace} ${message}\n`);
  }

  debug.namespace = namespace;
  debug._enabled = false;
  debug._enabledVersion = -1;

  Object.defineProperty(debug, "enabled", {
    enumerable: true,
    get() {
      return isEnabled(debug);
    }
  });

  return debug;
}

function ensureCompiledPatterns() {
  const pattern = process.env.DEBUG ?? "";
  if (pattern !== cachedPattern) {
    ({ enabled: cachedEnabled, disabled: cachedDisabled } = compilePatterns(pattern));
    cachedPattern = pattern;
    compiledVersion += 1;
  }
}

function isEnabled(debug) {
  ensureCompiledPatterns();

  if (debug._enabledVersion !== compiledVersion) {
    debug._enabled = matchesNamespace(debug.namespace);
    debug._enabledVersion = compiledVersion;
  }

  return debug._enabled;
}

function matchesNamespace(namespace) {
  for (let i = 0; i < cachedDisabled.length; i += 1) {
    if (cachedDisabled[i].test(namespace)) {
      return false;
    }
  }

  for (let i = 0; i < cachedEnabled.length; i += 1) {
    if (cachedEnabled[i].test(namespace)) {
      return true;
    }
  }

  return false;
}

function compilePatterns(pattern) {
  const enabled = [];
  const disabled = [];
  const parts = pattern.split(/[\s,]+/);

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const target = part[0] === "-" ? disabled : enabled;
    target.push(patternToRegExp(part[0] === "-" ? part.slice(1) : part));
  }

  return { enabled, disabled };
}

function patternToRegExp(pattern) {
  const source = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replaceAll("*", ".*?");

  return new RegExp(`^${source}$`);
}
