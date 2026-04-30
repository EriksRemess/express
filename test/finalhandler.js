"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import finalhandler from "#lib/utils/finalhandler";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

function createReq(overrides) {
  return {
    complete: true,
    httpVersionMajor: 1,
    method: "GET",
    originalUrl: "/",
    readable: false,
    socket: {
      destroy() {},
      readable: false,
    },
    ...overrides,
  };
}

function createRes(overrides) {
  const headers = new Map();
  const removed = [];
  const res = {
    headersSent: false,
    statusCode: 200,
    statusMessage: undefined,
    body: undefined,
    encoding: undefined,
    getHeader(name) {
      return headers.get(name);
    },
    removeHeader(name) {
      removed.push(name);
      headers.delete(name);
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
    end(body, encoding) {
      this.body = body;
      this.encoding = encoding;
      this.headersSent = true;
    },
    ...overrides,
  };

  return { headers, removed, res };
}

describe("finalhandler()", () => {
  it("should generate a 404 body with an encoded resource name", () => {
    const req = createReq({ originalUrl: "/<script>" });
    const { headers, removed, res } = createRes();

    finalhandler(req, res)();

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.statusMessage, "Not Found");
    assert.match(res.body, /Cannot GET \/%3Cscript%3E/);
    assert.strictEqual(headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.strictEqual(headers.get("Content-Security-Policy"), "default-src 'none'");
    assert.strictEqual(headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepStrictEqual(removed, [
      "Content-Encoding",
      "Content-Language",
      "Content-Range",
    ]);
  });

  it("should use production status text and copy error headers", () => {
    const req = createReq();
    const { headers, res } = createRes();
    const err = Object.assign(new Error("boom"), {
      headers: { "Retry-After": "120" },
      status: 418,
    });

    finalhandler(req, res, { env: "production" })(err);

    assert.strictEqual(res.statusCode, 418);
    assert.strictEqual(res.statusMessage, "I'm a Teapot");
    assert.strictEqual(headers.get("Retry-After"), "120");
    assert.doesNotMatch(res.body, /Error: boom/);
    assert.match(res.body, /I&#39;m a Teapot|I'm a Teapot/);
  });

  it("should fall back to res.statusCode and err.toString()", () => {
    const req = createReq();
    const { res } = createRes({ statusCode: 503 });
    const err = {
      status: 200,
      toString() {
        return "custom boom";
      },
    };

    finalhandler(req, res, { env: "development" })(err);

    assert.strictEqual(res.statusCode, 503);
    assert.match(res.body, /custom boom/);
  });

  it("should honor err.statusCode when err.status is absent", () => {
    const req = createReq();
    const { headers, res } = createRes();
    const err = {
      headers: "nope",
      statusCode: 504,
      toString() {
        return "gateway issue";
      },
    };

    finalhandler(req, res, { env: "development" })(err);

    assert.strictEqual(res.statusCode, 504);
    assert.strictEqual(headers.get("Retry-After"), undefined);
    assert.match(res.body, /gateway issue/);
  });

  it("should ignore inherited error status and headers", async () => {
    await withObjectPrototypeProperties({
      headers: {
        "Set-Cookie": "polluted=yes",
      },
      status: 418,
      statusCode: 418,
    }, () => {
      const req = createReq();
      const { headers, res } = createRes();

      finalhandler(req, res, { env: "production" })(new Error("boom"));

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(headers.get("Set-Cookie"), undefined);
      assert.match(res.body, /Internal Server Error/);
    });
  });

  it("should call onerror asynchronously", async () => {
    const req = createReq();
    const { res } = createRes();
    const err = new Error("boom");
    let sync = true;

    await new Promise((resolve) => {
      finalhandler(req, res, {
        onerror(receivedErr, receivedReq, receivedRes) {
          assert.strictEqual(sync, false);
          assert.strictEqual(receivedErr, err);
          assert.strictEqual(receivedReq, req);
          assert.strictEqual(receivedRes, res);
          resolve();
        },
      })(err);

      sync = false;
    });
  });

  it("should destroy the socket when headers were already sent for an error", () => {
    let destroyed = false;
    const req = createReq({
      socket: {
        destroy() {
          destroyed = true;
        },
        readable: false,
      },
    });
    const { res } = createRes({ headersSent: true });

    finalhandler(req, res)(new Error("boom"));

    assert.strictEqual(destroyed, true);
  });

  it("should not do anything for a 404 after headers were already sent", () => {
    const req = createReq();
    let ended = false;
    const { res } = createRes({
      end() {
        ended = true;
      },
      headersSent: true,
    });

    finalhandler(req, res)();

    assert.strictEqual(ended, false);
  });

  it('should fall back to "resource" when reading the URL throws', () => {
    const req = createReq();
    Object.defineProperty(req, "originalUrl", {
      get() {
        throw new Error("boom");
      },
    });

    const { res } = createRes();
    finalhandler(req, res)();

    assert.match(res.body, /Cannot GET resource/);
  });

  it("should end without a body on HEAD requests", () => {
    const req = createReq({ method: "HEAD" });
    const { res } = createRes();

    finalhandler(req, res)();

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body, undefined);
    assert.strictEqual(res.encoding, undefined);
  });

  it("should defer writing until an unfinished request completes", async () => {
    const req = new EventEmitter();
    req.complete = false;
    req.httpVersionMajor = 1;
    req.method = "GET";
    req.originalUrl = "/deferred";
    req.readable = true;
    req.socket = new EventEmitter();
    req.socket.readable = true;

    let unpiped = 0;
    let resumed = 0;
    req.unpipe = () => {
      unpiped += 1;
    };
    req.resume = () => {
      resumed += 1;
    };

    const { res } = createRes();
    finalhandler(req, res)();

    assert.strictEqual(res.body, undefined);
    assert.strictEqual(unpiped, 1);
    assert.strictEqual(resumed, 1);

    req.emit("end");

    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(res.statusCode, 404);
    assert.match(res.body, /Cannot GET \/deferred/);
  });
});
