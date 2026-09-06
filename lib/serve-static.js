/*!
 * express
 * MIT Licensed
 */

import { setContentLength } from '#lib/utils/http-framing';
import send, { normalizeSendOptions } from "#lib/send";
import encodeUrl from "#lib/utils/encode-url";
import escapeHtml from "#lib/utils/escape-html";
import createHtmlDocument from "#lib/utils/html-document";
import { copyOptions } from "#lib/utils/options";
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

  const opts = copyOptions(options);
  const fallthrough = opts.fallthrough !== false;
  const redirect = opts.redirect !== false;
  const setHeaders = opts.setHeaders;

  if (setHeaders && typeof setHeaders !== "function") {
    throw new TypeError("option setHeaders must be function");
  }

  opts.maxage = opts.maxage || opts.maxAge || 0;
  opts.root = resolve(root);
  normalizeSendOptions(opts);
  const sendOptionsWithoutEtag = opts.etag === undefined
    ? normalizeSendOptions(Object.assign(copyOptions(opts), { etag: false }))
    : null;

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
      setContentLength(res, 0);
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

    const stream = send(req, path, getSendOptions(req));

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

  function getSendOptions(req) {
    if (opts.etag !== undefined) {
      return opts;
    }

    if (req.app && typeof req.app.get === "function") {
      return typeof req.app.get("etag fn") === "function"
        ? opts
        : sendOptionsWithoutEtag;
    }

    return opts;
  }
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
    setContentLength(res, Buffer.byteLength(document));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Location", location);
    res.end(document);
  };
}
