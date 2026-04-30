/*!
 * express
 * MIT Licensed
 */

import mime from 'mime-types';
import { getOwnOption } from '#lib/utils/options';

const SIMPLE_MEDIA_TYPE_REGEXP = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/;
const SIMPLE_CHARSET_REGEXP = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
const SIMPLE_ENCODING_REGEXP = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
const SIMPLE_LANGUAGE_REGEXP = /^\s*([^\s\-;]+)(?:-([^\s;]+))?\s*(?:;(.*))?$/;

/**
 * Create an Accepts helper for the given request.
 *
 * @param {object} req
 * @returns {Accepts}
 */
export default function accepts(req) {
  return new Accepts(req);
}

/**
 * Minimal Accept header negotiation helper used by request methods.
 */
class Accepts {
  constructor(req) {
    this.headers = req.headers;
  }

  getHeader(name) {
    return getOwnOption(this.headers, name);
  }

  type(...types) {
    return this.types(...types);
  }

  types(...types) {
    if (types.length === 1 && Array.isArray(types[0])) {
      types = types[0];
    }

    if (!types || types.length === 0) {
      return preferredMediaTypes(this.getHeader('accept'));
    }

    const accept = this.getHeader('accept');
    if (!accept) {
      return types[0];
    }

    const normalized = types.map(normalizeCandidate);
    const mimes = normalized.map(extToMime);
    const accepted = preferredMediaTypes(accept, mimes.filter(validMime));
    const first = accepted[0];

    return first
      ? types[mimes.indexOf(first)]
      : false;
  }

  encoding(...encodings) {
    return this.encodings(...encodings);
  }

  encodings(...encodings) {
    if (encodings.length === 1 && Array.isArray(encodings[0])) {
      encodings = encodings[0];
    }

    if (!encodings || encodings.length === 0) {
      return preferredEncodings(this.getHeader('accept-encoding'));
    }

    const normalized = encodings.map(normalizeCandidate);
    const accepted = preferredEncodings(this.getHeader('accept-encoding'), normalized);
    const first = accepted[0];

    return first
      ? encodings[normalized.indexOf(first)]
      : false;
  }

  charset(...charsets) {
    return this.charsets(...charsets);
  }

  charsets(...charsets) {
    if (charsets.length === 1 && Array.isArray(charsets[0])) {
      charsets = charsets[0];
    }

    if (!charsets || charsets.length === 0) {
      return preferredCharsets(this.getHeader('accept-charset'));
    }

    const normalized = charsets.map(normalizeCandidate);
    const accepted = preferredCharsets(this.getHeader('accept-charset'), normalized);
    const first = accepted[0];

    return first
      ? charsets[normalized.indexOf(first)]
      : false;
  }

  lang(...languages) {
    return this.languages(...languages);
  }

  langs(...languages) {
    return this.languages(...languages);
  }

  language(...languages) {
    return this.languages(...languages);
  }

  languages(...languages) {
    if (languages.length === 1 && Array.isArray(languages[0])) {
      languages = languages[0];
    }

    if (!languages || languages.length === 0) {
      return preferredLanguages(this.getHeader('accept-language'));
    }

    const normalized = languages.map(normalizeCandidate);
    const accepted = preferredLanguages(this.getHeader('accept-language'), normalized);
    const first = accepted[0];

    return first
      ? languages[normalized.indexOf(first)]
      : false;
  }
}

function extToMime(type) {
  return type.indexOf('/') === -1
    ? mime.lookup(type)
    : type;
}

function validMime(type) {
  return typeof type === 'string';
}

function normalizeCandidate(value) {
  return String(value).trim();
}

function compareSpecs(a, b) {
  return (b.q - a.q) || (b.s - a.s) || (a.o - b.o) || (a.i - b.i) || 0;
}

function isQuality(spec) {
  return spec.q > 0;
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

function splitMediaTypes(accept) {
  const accepts = accept.split(',');
  let last = 0;

  for (let i = 1, j = 0; i < accepts.length; i++) {
    if (quoteCount(accepts[j]) % 2 === 0) {
      accepts[++j] = accepts[i];
      last = j;
    } else {
      accepts[j] += ',' + accepts[i];
      last = j;
    }
  }

  accepts.length = accepts.length === 0
    ? 0
    : last + 1;
  return accepts;
}

function splitParameters(value) {
  const parameters = value.split(';');
  let last = 0;

  for (let i = 1, j = 0; i < parameters.length; i++) {
    if (quoteCount(parameters[j]) % 2 === 0) {
      parameters[++j] = parameters[i];
      last = j;
    } else {
      parameters[j] += ';' + parameters[i];
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

function splitKeyValuePair(value) {
  const index = value.indexOf('=');
  if (index === -1) {
    return [value];
  }

  return [value.slice(0, index), value.slice(index + 1)];
}

function parseMediaType(value, index) {
  const match = SIMPLE_MEDIA_TYPE_REGEXP.exec(value);
  if (!match) {
    return null;
  }

  const params = Object.create(null);
  let q = 1;
  const subtype = match[2];
  const type = match[1];

  if (match[3]) {
    const kvps = splitParameters(match[3]).map(splitKeyValuePair);

    for (let i = 0; i < kvps.length; i++) {
      const pair = kvps[i];
      const key = pair[0].toLowerCase();
      const val = pair[1];
      const parsedValue = val && val[0] === '"' && val[val.length - 1] === '"'
        ? val.slice(1, -1)
        : val;

      if (key === 'q') {
        q = parseFloat(parsedValue);
        break;
      }

      params[key] = parsedValue;
    }
  }

  return {
    type,
    subtype,
    params,
    q,
    i: index
  };
}

function parseAccept(value) {
  const accepts = splitMediaTypes(value);

  for (let i = 0, j = 0; i < accepts.length; i++) {
    const mediaType = parseMediaType(accepts[i].trim(), i);
    if (mediaType) {
      accepts[j++] = mediaType;
    }
  }

  accepts.length = accepts.length === 0 ? 0 : accepts.findLastIndex((item) => item && typeof item === 'object') + 1;
  return accepts;
}

function specifyMediaType(type, spec, index) {
  const parsed = parseMediaType(type);
  let s = 0;

  if (!parsed) {
    return null;
  }

  if (spec.type.toLowerCase() === parsed.type.toLowerCase()) {
    s |= 4;
  } else if (spec.type !== '*') {
    return null;
  }

  if (spec.subtype.toLowerCase() === parsed.subtype.toLowerCase()) {
    s |= 2;
  } else if (spec.subtype !== '*') {
    return null;
  }

  const keys = Object.keys(spec.params);
  if (keys.length > 0) {
    if (keys.every((k) => spec.params[k] === '*' || (spec.params[k] || '').toLowerCase() === (parsed.params[k] || '').toLowerCase())) {
      s |= 1;
    } else {
      return null;
    }
  }

  return {
    i: index,
    o: spec.i,
    q: spec.q,
    s
  };
}

function getMediaTypePriority(type, accepted, index) {
  let priority = { o: -1, q: 0, s: 0 };

  for (let i = 0; i < accepted.length; i++) {
    const spec = specifyMediaType(type, accepted[i], index);
    if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
      priority = spec;
    }
  }

  return priority;
}

function preferredMediaTypes(accept, provided) {
  const accepts = parseAccept(accept === undefined ? '*/*' : accept || '');

  if (!provided) {
    return accepts
      .filter(isQuality)
      .sort(compareSpecs)
      .map((spec) => `${spec.type}/${spec.subtype}`);
  }

  const priorities = provided.map((type, index) => getMediaTypePriority(type, accepts, index));

  return priorities
    .filter(isQuality)
    .sort(compareSpecs)
    .map((priority) => provided[priorities.indexOf(priority)]);
}

function parseCharset(value, index) {
  const match = SIMPLE_CHARSET_REGEXP.exec(value);
  if (!match) {
    return null;
  }

  const charset = match[1];
  let q = 1;

  if (match[2]) {
    const params = match[2].split(';');
    for (let i = 0; i < params.length; i++) {
      const p = params[i].trim().split('=');
      if (p[0] === 'q') {
        q = parseFloat(p[1]);
        break;
      }
    }
  }

  return {
    charset,
    q,
    i: index
  };
}

function parseAcceptCharset(accept) {
  const accepts = accept.split(',');

  for (let i = 0, j = 0; i < accepts.length; i++) {
    const charset = parseCharset(accepts[i].trim(), i);
    if (charset) {
      accepts[j++] = charset;
    }
  }

  accepts.length = accepts.length === 0 ? 0 : accepts.findLastIndex((item) => item && typeof item === 'object') + 1;
  return accepts;
}

function specifyCharset(charset, spec, index) {
  let s = 0;

  if (spec.charset.toLowerCase() === charset.toLowerCase()) {
    s |= 1;
  } else if (spec.charset !== '*') {
    return null;
  }

  return {
    i: index,
    o: spec.i,
    q: spec.q,
    s
  };
}

function getCharsetPriority(charset, accepted, index) {
  let priority = { o: -1, q: 0, s: 0 };

  for (let i = 0; i < accepted.length; i++) {
    const spec = specifyCharset(charset, accepted[i], index);
    if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
      priority = spec;
    }
  }

  return priority;
}

function preferredCharsets(accept, provided) {
  const accepts = parseAcceptCharset(accept === undefined ? '*' : accept || '');

  if (!provided) {
    return accepts
      .filter(isQuality)
      .sort(compareSpecs)
      .map((spec) => spec.charset);
  }

  const priorities = provided.map((type, index) => getCharsetPriority(type, accepts, index));

  return priorities
    .filter(isQuality)
    .sort(compareSpecs)
    .map((priority) => provided[priorities.indexOf(priority)]);
}

function parseEncoding(value, index) {
  const match = SIMPLE_ENCODING_REGEXP.exec(value);
  if (!match) {
    return null;
  }

  const encoding = match[1];
  let q = 1;

  if (match[2]) {
    const params = match[2].split(';');
    for (let i = 0; i < params.length; i++) {
      const p = params[i].trim().split('=');
      if (p[0] === 'q') {
        q = parseFloat(p[1]);
        break;
      }
    }
  }

  return {
    encoding,
    q,
    i: index
  };
}

function specifyEncoding(encoding, spec, index) {
  let s = 0;

  if (spec.encoding.toLowerCase() === encoding.toLowerCase()) {
    s |= 1;
  } else if (spec.encoding !== '*') {
    return null;
  }

  return {
    encoding,
    i: index,
    o: spec.i,
    q: spec.q,
    s
  };
}

function parseAcceptEncoding(accept) {
  const accepts = accept.split(',');
  let hasIdentity = false;
  let minQuality = 1;

  for (let i = 0, j = 0; i < accepts.length; i++) {
    const encoding = parseEncoding(accepts[i].trim(), i);
    if (encoding) {
      accepts[j++] = encoding;
      hasIdentity = hasIdentity || Boolean(specifyEncoding('identity', encoding));
      minQuality = Math.min(minQuality, encoding.q || 1);
    }
  }

  accepts.length = accepts.length === 0
    ? 0
    : accepts.findLastIndex((item) => item && typeof item === 'object') + 1;

  if (!hasIdentity) {
    accepts.push({
      encoding: 'identity',
      q: minQuality,
      i: accepts.length
    });
  }

  return accepts;
}

function preferredEncodings(accept, provided) {
  const accepts = parseAcceptEncoding(accept || '');

  if (!provided) {
    return accepts
      .filter(isQuality)
      .sort(compareSpecs)
      .map((spec) => spec.encoding);
  }

  const priorities = provided.map((type, index) => {
    let priority = { encoding: type, o: -1, q: 0, s: 0 };

    for (let i = 0; i < accepts.length; i++) {
      const spec = specifyEncoding(type, accepts[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }

    return priority;
  });

  return priorities
    .filter(isQuality)
    .sort(compareSpecs)
    .map((priority) => provided[priorities.indexOf(priority)]);
}

function parseLanguage(value, index) {
  const match = SIMPLE_LANGUAGE_REGEXP.exec(value);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const suffix = match[2];
  let full = prefix;
  if (suffix) {
    full += `-${suffix}`;
  }

  let q = 1;
  if (match[3]) {
    const params = match[3].split(';');
    for (let i = 0; i < params.length; i++) {
      const p = params[i].split('=');
      if (p[0] === 'q') {
        q = parseFloat(p[1]);
      }
    }
  }

  return {
    prefix,
    suffix,
    q,
    i: index,
    full
  };
}

function parseAcceptLanguage(accept) {
  const accepts = accept.split(',');

  for (let i = 0, j = 0; i < accepts.length; i++) {
    const language = parseLanguage(accepts[i].trim(), i);
    if (language) {
      accepts[j++] = language;
    }
  }

  accepts.length = accepts.length === 0 ? 0 : accepts.findLastIndex((item) => item && typeof item === 'object') + 1;
  return accepts;
}

function specifyLanguage(language, spec, index) {
  const parsed = parseLanguage(language);
  if (!parsed) {
    return null;
  }

  let s = 0;
  if (spec.full.toLowerCase() === parsed.full.toLowerCase()) {
    s |= 4;
  } else if (spec.prefix.toLowerCase() === parsed.full.toLowerCase()) {
    s |= 2;
  } else if (spec.full.toLowerCase() === parsed.prefix.toLowerCase()) {
    s |= 1;
  } else if (spec.full !== '*') {
    return null;
  }

  return {
    i: index,
    o: spec.i,
    q: spec.q,
    s
  };
}

function preferredLanguages(accept, provided) {
  const accepts = parseAcceptLanguage(accept === undefined ? '*' : accept || '');

  if (!provided) {
    return accepts
      .filter(isQuality)
      .sort(compareSpecs)
      .map((spec) => spec.full);
  }

  const priorities = provided.map((type, index) => {
    let priority = { o: -1, q: 0, s: 0 };

    for (let i = 0; i < accepts.length; i++) {
      const spec = specifyLanguage(type, accepts[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }

    return priority;
  });

  return priorities
    .filter(isQuality)
    .sort(compareSpecs)
    .map((priority) => provided[priorities.indexOf(priority)]);
}
