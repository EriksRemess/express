/*!
 * express
 * MIT Licensed
 */

import send, { normalizeSendOptions } from "#lib/send";
import encodeUrl from "#lib/utils/encode-url";
import escapeHtml from "#lib/utils/escape-html";
import createHtmlDocument from "#lib/utils/html-document";
import parseurl, { originalurl } from "#lib/utils/parseurl";
import { collapseLeadingSlashes } from "#lib/utils/url-path";
import { Buffer } from "node:buffer";
import { resolve } from "node:path";

/**
 * Create middleware to serve static files from a root directory.
 *
 * @param {string} root
 * @param {object} [options]
 * @returns {Function}
 */
export default function serveStatic(root, options) {
  if (!root) {
    throw new TypeError("root path required");
  }

  if (typeof root !== "string") {
    throw new TypeError("root path must be a string");
  }

  const opts = options
    ? { ...options }
    : {};
  const fallthrough = opts.fallthrough !== false;
  const redirect = opts.redirect !== false;
  const setHeaders = opts.setHeaders;

  if (setHeaders && typeof setHeaders !== "function") {
    throw new TypeError("option setHeaders must be function");
  }

  opts.maxage = opts.maxage || opts.maxAge || 0;
  opts.root = resolve(root);
  const sendOptions = normalizeSendOptions(opts);

  const onDirectory = redirect
    ? createRedirectDirectoryListener()
    : createNotFoundDirectoryListener();

  return function serveStaticMiddleware(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (fallthrough) {
        next();
        return;
      }

      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Length", "0");
      res.end();
      return;
    }

    let forwardError = !fallthrough;
    let path = parseurl(req).pathname;

    if (path === "/") {
      const originalUrl = originalurl(req);

      if (originalUrl.pathname.endsWith("/") === false) {
        path = "";
      }
    }

    const stream = send(req, path, sendOptions);

    stream.on("directory", onDirectory);

    if (setHeaders) {
      stream.on("headers", setHeaders);
    }

    if (fallthrough) {
      stream.on("file", function onFile() {
        forwardError = true;
      });
    }

    stream.on("error", error => {
      if (forwardError || error.statusCode >= 500) {
        next(error);
        return;
      }

      next();
    });

    stream.pipe(res);
  };
}

function createNotFoundDirectoryListener() {
  return function notFound() {
    this.error(404);
  };
}

function createRedirectDirectoryListener() {
  return function redirect(res) {
    if (this.hasTrailingSlash()) {
      this.error(404);
      return;
    }

    const originalUrl = originalurl(this.req);
    const pathname = collapseLeadingSlashes(`${originalUrl.pathname}/`);
    const location = encodeUrl(pathname + (originalUrl.search || ""));
    const document = createHtmlDocument(
      "Redirecting",
      `Redirecting to ${escapeHtml(location)}`,
    );

    res.statusCode = 301;
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.setHeader("Content-Length", Buffer.byteLength(document));
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Location", location);
    res.end(document);
  };
}
