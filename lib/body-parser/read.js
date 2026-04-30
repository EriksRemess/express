/*!
 * express
 * MIT Licensed
 */

import { getCharset, isSupportedCharset } from "#lib/body-parser/utils";
import createError from "#lib/utils/http-errors";
import onFinished, { isFinished } from "#lib/utils/on-finished";
import { getOwnOption } from "#lib/utils/options";
import { hasBody } from "#lib/utils/type-is";
import { Buffer } from "node:buffer";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

/**
 * Read, verify, decode, and parse a request body.
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @param {Function} parse
 * @param {Function} debug
 * @param {object} options
 * @returns {void}
 */
export default function readBody(req, res, next, parse, debug, options) {
  if (isFinished(req)) {
    debug("body already parsed");
    next();
    return;
  }

  if (!("body" in req)) {
    req.body = undefined;
  }

  if (!hasBody(req)) {
    debug("skip empty body");
    next();
    return;
  }

  debug("content-type %j", getOwnOption(req.headers, "content-type"));

  if (!options.shouldParse(req)) {
    debug("skip parsing");
    next();
    return;
  }

  const charset = options.skipCharset === true
    ? null
    : getCharset(req) ?? options.defaultCharset;

  if (charset !== null) {
    if (options.isValidCharset && !options.isValidCharset(charset)) {
      next(createError(415, `unsupported charset "${charset.toUpperCase()}"`, {
        charset,
        type: "charset.unsupported",
      }));
      return;
    }

    if (!isSupportedCharset(charset)) {
      next(createError(415, `unsupported charset "${charset.toUpperCase()}"`, {
        charset,
        type: "charset.unsupported",
      }));
      return;
    }
  }

  let stream;
  let length;

  try {
    ({ stream, length } = getContentStream(req, debug, options.inflate));
  } catch (error) {
    next(error);
    return;
  }

  readBuffer(stream, req, length, options.limit, debug)
    .then(buffer => {
      if (options.verify) {
        try {
          debug("verify body");
          options.verify(req, res, buffer, charset);
        } catch (error) {
          throw createError(getOwnOption(error, "status") ?? 403, error, {
            body: charset === null ? buffer : decodeBuffer(buffer, charset),
            type: getOwnOption(error, "type") || "entity.verify.failed",
          });
        }
      }

      let body = buffer;
      if (charset !== null) {
        body = decodeBuffer(buffer, charset);
      }

      try {
        debug("parse body");
        req.body = parse(body, charset);
      } catch (error) {
        throw createError(400, error, {
          body,
          type: getOwnOption(error, "type") || "entity.parse.failed",
        });
      }
    })
    .then(() => {
      next();
    })
    .catch(error => {
      drainRequest(req);
      next(getOwnOption(error, "status") ? error : createError(400, error));
    });
}

function decodeBuffer(buffer, charset) {
  return new TextDecoder(charset).decode(buffer);
}

function getContentStream(req, debug, inflate) {
  const encoding = (getOwnOption(req.headers, "content-encoding") || "identity").toLowerCase();
  const length = getOwnOption(req.headers, "content-length");

  debug('content-encoding "%s"', encoding);

  if (inflate === false && encoding !== "identity") {
    throw createError(415, "content encoding unsupported", {
      encoding,
      type: "encoding.unsupported",
    });
  }

  if (encoding === "identity") {
    return {
      length: parseExpectedLength(length),
      stream: req,
    };
  }

  let stream;
  switch (encoding) {
    case "br":
      debug("brotli decompress body");
      stream = createBrotliDecompress();
      break;
    case "deflate":
      debug("inflate body");
      stream = createInflate();
      break;
    case "gzip":
      debug("gunzip body");
      stream = createGunzip();
      break;
    default:
      throw createError(415, `unsupported content encoding "${encoding}"`, {
        encoding,
        type: "encoding.unsupported",
      });
  }

  req.pipe(stream);

  return {
    length: undefined,
    stream,
  };
}

function parseExpectedLength(length) {
  if (length === undefined) {
    return undefined;
  }

  const expected = Number(length);
  return Number.isNaN(expected) ? undefined : expected;
}

function readBuffer(stream, req, expectedLength, limit, debug) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let settled = false;

    function cleanup() {
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", onError);
      req.off("aborted", onAborted);
      req.off("close", onClose);
    }

    function finish(error, buffer) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(buffer);
    }

    function fail(error) {
      if (stream !== req) {
        req.unpipe(stream);
        stream.destroy();
      }

      debug("read body error");
      finish(error);
    }

    function onAborted() {
      fail(createError(400, "request aborted", {
        code: "ECONNABORTED",
        type: "request.aborted",
      }));
    }

    function onClose() {
      if (!settled && !req.complete) {
        onAborted();
      }
    }

    function onData(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;

      if (limit !== undefined && length > limit) {
        fail(createError(413, "request entity too large", {
          limit,
          length,
          type: "entity.too.large",
        }));
        return;
      }

      chunks.push(buffer);
    }

    function onEnd() {
      if (expectedLength !== undefined && length !== expectedLength) {
        finish(createError(400, "request size did not match content length", {
          expected: expectedLength,
          length,
          type: "request.size.invalid",
        }));
        return;
      }

      finish(null, Buffer.concat(chunks, length));
    }

    function onError(error) {
      fail(createError(400, error));
    }

    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
    req.once("aborted", onAborted);
    req.once("close", onClose);
  });
}

function drainRequest(req) {
  if (isFinished(req)) {
    return;
  }

  onFinished(req, () => {});
  req.resume();
}
