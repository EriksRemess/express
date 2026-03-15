"use strict";

import {describe, it, before} from "node:test";
let __testApp;
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import express from "#express";
import request from "supertest";
import {Buffer} from "node:buffer";
describe("express.raw()", () => {
  before(() => {
    __testApp = createApp();
  });
  it("should parse application/octet-stream", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/octet-stream")
      .send("the user is tobi")
      .expect(200, {
        buf: "746865207573657220697320746f6269",
      });
  });
  it("should 400 when invalid content-length", async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.raw());
    app.post("/", (req, res) => {
      if (Buffer.isBuffer(req.body)) {
        res.json({
          buf: req.body.toString("hex"),
        });
      } else {
        res.json(req.body);
      }
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/octet-stream")
      .send("stuff")
      .expect(400, /content length/);
  });
  it("should handle Content-Length: 0", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/octet-stream")
      .set("Content-Length", "0")
      .expect(200, {
        buf: "",
      });
  });
  it("should handle empty message-body", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/octet-stream")
      .set("Transfer-Encoding", "chunked")
      .send("")
      .expect(200, {
        buf: "",
      });
  });
  it("should handle duplicated middleware", async () => {
    const app = express();
    app.use(express.raw());
    app.use(express.raw());
    app.post("/", (req, res) => {
      if (Buffer.isBuffer(req.body)) {
        res.json({
          buf: req.body.toString("hex"),
        });
      } else {
        res.json(req.body);
      }
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/octet-stream")
      .send("the user is tobi")
      .expect(200, {
        buf: "746865207573657220697320746f6269",
      });
  });
  describe("with limit option", () => {
    it("should 413 when over limit with Content-Length", async () => {
      const buf = Buffer.alloc(1028, ".");
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.set("Content-Length", "1028");
      await test.write(buf);
      await test.expect(413);
    });
    it("should 413 when over limit with chunked encoding", async () => {
      const buf = Buffer.alloc(1028, ".");
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.set("Transfer-Encoding", "chunked");
      await test.write(buf);
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a14704040000",
          "hex",
        ),
      );
      await test.expect(413);
    });
    it("should accept number of bytes", async () => {
      const buf = Buffer.alloc(1028, ".");
      const app = createApp({
        limit: 1024,
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(buf);
      await test.expect(413);
    });
    it("should not change when options altered", async () => {
      const buf = Buffer.alloc(1028, ".");
      const options = {
        limit: "1kb",
      };
      const app = createApp(options);
      options.limit = "100kb";
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(buf);
      await test.expect(413);
    });
    it("should not hang response", async () => {
      const buf = Buffer.alloc(10240, ".");
      const app = createApp({
        limit: "8kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(buf);
      await test.write(buf);
      await test.write(buf);
      await test.expect(413);
    });
    it("should not error when inflating", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a147040400",
          "hex",
        ),
      );
      await test.expect(413);
    });
  });
  describe("with inflate option", () => {
    describe("when false", () => {
      before(() => {
        __testApp = createApp({
          inflate: false,
        });
      });
      it("should not accept content-encoding", async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Encoding", "gzip");
        await test.set("Content-Type", "application/octet-stream");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
            "hex",
          ),
        );
        await test.expect(
          415,
          "[encoding.unsupported] content encoding unsupported",
        );
      });
    });
    describe("when true", () => {
      before(() => {
        __testApp = createApp({
          inflate: true,
        });
      });
      it("should accept content-encoding", async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Encoding", "gzip");
        await test.set("Content-Type", "application/octet-stream");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
            "hex",
          ),
        );
        await test.expect(200, {
          buf: "6e616d653de8aeba",
        });
      });
    });
  });
  describe("with type option", () => {
    describe('when "application/vnd+octets"', () => {
      before(() => {
        __testApp = createApp({
          type: "application/vnd+octets",
        });
      });
      it("should parse for custom type", async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Type", "application/vnd+octets");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, {
          buf: "000102",
        });
      });
      it("should ignore standard type", async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Type", "application/octet-stream");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, "");
      });
    });
    describe('when ["application/octet-stream", "application/vnd+octets"]', () => {
      before(() => {
        __testApp = createApp({
          type: ["application/octet-stream", "application/vnd+octets"],
        });
      });
      it('should parse "application/octet-stream"', async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Type", "application/octet-stream");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, {
          buf: "000102",
        });
      });
      it('should parse "application/vnd+octets"', async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Type", "application/vnd+octets");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, {
          buf: "000102",
        });
      });
      it('should ignore "application/x-foo"', async () => {
        const test = request(__testApp).post("/");
        await test.set("Content-Type", "application/x-foo");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, "");
      });
    });
    describe("when a function", () => {
      it("should parse when truthy value returned", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return req.headers["content-type"] === "application/vnd.octet";
        }
        const test = request(app).post("/");
        await test.set("Content-Type", "application/vnd.octet");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, {
          buf: "000102",
        });
      });
      it("should work without content-type", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return true;
        }
        const test = request(app).post("/");
        await test.write(Buffer.from("000102", "hex"));
        await test.expect(200, {
          buf: "000102",
        });
      });
      it("should not invoke without a body", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          throw new Error("oops!");
        }
        await request(app).get("/").expect(404);
      });
    });
  });
  describe("with verify option", () => {
    it("should assert value is function", () => {
      assert.throws(
        createApp.bind(null, {
          verify: "lol",
        }),
        /TypeError: option verify must be function/,
      );
    });
    it("should error from verify", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x00) throw new Error("no leading null");
        },
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("000102", "hex"));
      await test.expect(403, "[entity.verify.failed] no leading null");
    });
    it("should allow custom codes", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x00) return;
          const err = new Error("no leading null");
          err.status = 400;
          throw err;
        },
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("000102", "hex"));
      await test.expect(400, "[entity.verify.failed] no leading null");
    });
    it("should allow pass-through", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x00) throw new Error("no leading null");
        },
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("0102", "hex"));
      await test.expect(200, {
        buf: "0102",
      });
    });
  });
  describe("async local storage", () => {
    before(() => {
      const app = express();
      const store = {
        foo: "bar",
      };
      app.use((req, res, next) => {
        req.asyncLocalStorage = new AsyncLocalStorage();
        req.asyncLocalStorage.run(store, next);
      });
      app.use(express.raw());
      app.use((req, res, next) => {
        const local = req.asyncLocalStorage.getStore();
        if (local) {
          res.setHeader("x-store-foo", String(local.foo));
        }
        next();
      });
      app.use((err, req, res, next) => {
        const local = req.asyncLocalStorage.getStore();
        if (local) {
          res.setHeader("x-store-foo", String(local.foo));
        }
        res.status(err.status || 500);
        res.send("[" + err.type + "] " + err.message);
      });
      app.post("/", (req, res) => {
        if (Buffer.isBuffer(req.body)) {
          res.json({
            buf: req.body.toString("hex"),
          });
        } else {
          res.json(req.body);
        }
      });
      __testApp = app;
    });
    it("should persist store", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/octet-stream")
        .send("the user is tobi")
        .expect(200)
        .expect("x-store-foo", "bar")
        .expect({
          buf: "746865207573657220697320746f6269",
        });
    });
    it("should persist store when unmatched content-type", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/fizzbuzz")
        .send("buzz")
        .expect(200)
        .expect("x-store-foo", "bar");
    });
    it("should persist store when inflated", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200);
      await test.expect("x-store-foo", "bar");
      await test.expect({
        buf: "6e616d653de8aeba",
      });
      await test;
    });
    it("should persist store when inflate error", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad6080000",
          "hex",
        ),
      );
      await test.expect(400);
      await test.expect("x-store-foo", "bar");
      await test;
    });
    it("should persist store when limit exceeded", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/octet-stream")
        .send("the user is " + Buffer.alloc(1024 * 100, ".").toString())
        .expect(413)
        .expect("x-store-foo", "bar");
    });
  });
  describe("charset", () => {
    before(() => {
      __testApp = createApp();
    });
    it("should ignore charset", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/octet-stream; charset=utf-8");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, {
        buf: "6e616d6520697320e8aeba",
      });
    });
  });
  describe("encoding", () => {
    before(() => {
      __testApp = createApp({
        limit: "10kb",
      });
    });
    it("should parse without encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, {
        buf: "6e616d653de8aeba",
      });
    });
    it("should support identity encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "identity");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, {
        buf: "6e616d653de8aeba",
      });
    });
    it("should support gzip encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200, {
        buf: "6e616d653de8aeba",
      });
    });
    it("should support deflate encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "deflate");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("789ccb4bcc4db57db16e17001068042f", "hex"));
      await test.expect(200, {
        buf: "6e616d653de8aeba",
      });
    });
    it("should be case-insensitive", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "GZIP");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200, {
        buf: "6e616d653de8aeba",
      });
    });
    it("should 415 on unknown encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "nulls");
      await test.set("Content-Type", "application/octet-stream");
      await test.write(Buffer.from("000000000000", "hex"));
      await test.expect(
        415,
        '[encoding.unsupported] unsupported content encoding "nulls"',
      );
    });
  });
});
function createApp(options) {
  const app = express();
  app.use(express.raw(options));
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.send(
      String(
        req.headers["x-error-property"]
          ? err[req.headers["x-error-property"]]
          : "[" + err.type + "] " + err.message,
      ),
    );
  });
  app.post("/", (req, res) => {
    if (Buffer.isBuffer(req.body)) {
      res.json({
        buf: req.body.toString("hex"),
      });
    } else {
      res.json(req.body);
    }
  });
  return app;
}
