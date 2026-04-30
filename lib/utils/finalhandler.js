/*!
 * express
 * MIT Licensed
 */

import createDebug from "#lib/utils/debug";
import encodeUrl from "#lib/utils/encode-url";
import escapeHtml from "#lib/utils/escape-html";
import createHtmlDocument from "#lib/utils/html-document";
import onFinished, { isFinished } from "#lib/utils/on-finished";
import { getOwnOption, hasOwnOption } from "#lib/utils/options";
import { originalurl } from "#lib/utils/parseurl";
import { Buffer } from "node:buffer";
import { STATUS_CODES } from "node:http";

const debug = createDebug("finalhandler");

/**
 * Create a final request handler for default 404 and error responses.
 *
 * @param {object} req
 * @param {object} res
 * @param {{ env?: string, onerror?: Function }} [options]
 * @returns {(err?: Error) => void}
 */
export default function finalhandler(req, res, options) {
  const opts = options || {};
  const env = getOwnOption(opts, "env") || process.env.NODE_ENV || "development";
  const onerror = getOwnOption(opts, "onerror");

  return function finalHandler(err) {
    let headers;
    let message;
    let status;

    if (!err && res.headersSent) {
      debug("cannot 404 after headers sent");
      return;
    }

    if (err) {
      status = getErrorStatusCode(err);

      if (status === undefined) {
        status = getResponseStatusCode(res);
      } else {
        headers = getErrorHeaders(err);
      }

      message = getErrorMessage(err, status, env);
    } else {
      status = 404;
      message = `Cannot ${req.method} ${encodeUrl(getResourceName(req))}`;
    }

    debug("default %s", status);

    if (err && onerror) {
      setImmediate(onerror, err, req, res);
    }

    if (res.headersSent) {
      debug("cannot %d after headers sent", status);
      if (req.socket) {
        req.socket.destroy();
      }
      return;
    }

    send(req, res, status, headers, message);
  };
}

function getErrorHeaders(err) {
  if (!hasOwnOption(err, "headers") || typeof err.headers !== "object" || err.headers === null) {
    return undefined;
  }

  return { ...err.headers };
}

function getErrorMessage(err, status, env) {
  let message;

  if (env !== "production") {
    message = err.stack;

    if (!message && typeof err.toString === "function") {
      message = err.toString();
    }
  }

  return message || STATUS_CODES[status] || "Error";
}

function getErrorStatusCode(err) {
  const status = getOwnOption(err, "status");
  if (typeof status === "number" && status >= 400 && status < 600) {
    return status;
  }

  const statusCode = getOwnOption(err, "statusCode");
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }

  return undefined;
}

function getResourceName(req) {
  try {
    return originalurl(req)?.pathname || "resource";
  } catch {
    return "resource";
  }
}

function getResponseStatusCode(res) {
  const status = res.statusCode;

  if (typeof status !== "number" || status < 400 || status > 599) {
    return 500;
  }

  return status;
}

function send(req, res, status, headers, message) {
  function write() {
    const body = createHtmlDocument(
      "Error",
      escapeHtml(message)
        .replaceAll("\n", "<br>")
        .replaceAll("  ", " &nbsp;"),
    );

    res.statusCode = status;

    if (req.httpVersionMajor < 2) {
      res.statusMessage = STATUS_CODES[status];
    }

    res.removeHeader("Content-Encoding");
    res.removeHeader("Content-Language");
    res.removeHeader("Content-Range");

    for (const [key, value] of Object.entries(headers ?? {})) {
      res.setHeader(key, value);
    }

    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body, "utf8"));

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end(body, "utf8");
  }

  if (isFinished(req)) {
    write();
    return;
  }

  req.unpipe?.();
  onFinished(req, write);
  req.resume?.();
}
