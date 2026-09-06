"use strict";

import {describe, it, before} from "node:test";
let __testApp;
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import {Buffer} from "node:buffer";
import express from "#express";
import request from "supertest";
describe("express.text()", () => {
  before(() => {
    __testApp = createApp();
  });
  it("should parse text/plain", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user is tobi")
      .expect(200, '"user is tobi"');
  });
  it("should 400 when invalid content-length", async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.text());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user")
      .expect(400, /content length/);
  });
  it("should handle Content-Length: 0", async () => {
    await request(
      createApp({
        limit: "1kb",
      }),
    )
      .post("/")
      .set("Content-Type", "text/plain")
      .set("Content-Length", "0")
      .expect(200, '""');
  });
  it("should handle empty message-body", async () => {
    await request(
      createApp({
        limit: "1kb",
      }),
    )
      .post("/")
      .set("Content-Type", "text/plain")
      .set("Transfer-Encoding", "chunked")
      .send("")
      .expect(200, '""');
  });
  it("should handle duplicated middleware", async () => {
    const app = express();
    app.use(express.text());
    app.use(express.text());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user is tobi")
      .expect(200, '"user is tobi"');
  });
  describe("with defaultCharset option", () => {
    it("should change default charset", async () => {
      const server = createApp({
        defaultCharset: "koi8-r",
      });
      const test = request(server).post("/");
      test.set("Content-Type", "text/plain");
      test.write(Buffer.from("6e616d6520697320cec5d4", "hex"));
      await test.expect(200, '"name is нет"');
    });
    it("should honor content-type charset", async () => {
      const server = createApp({
        defaultCharset: "koi8-r",
      });
      const test = request(server).post("/");
      test.set("Content-Type", "text/plain; charset=utf-8");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
  });
  describe("with limit option", () => {
    it("should 413 when over limit with Content-Length", async () => {
      const buf = Buffer.alloc(1028, ".");
      await request(
        createApp({
          limit: "1kb",
        }),
      )
        .post("/")
        .set("Content-Type", "text/plain")
        .set("Content-Length", "1028")
        .send(buf.toString())
        .expect(413);
    });
    it("should 413 when over limit with chunked encoding", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const buf = Buffer.alloc(1028, ".");
      const test = request(app).post("/");
      test.set("Content-Type", "text/plain");
      test.set("Transfer-Encoding", "chunked");
      test.write(buf.toString());
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      test.set("Content-Encoding", "gzip");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a14704040000",
          "hex",
        ),
      );
      await test.expect(413);
    });
    it("should accept number of bytes", async () => {
      const buf = Buffer.alloc(1028, ".");
      await request(
        createApp({
          limit: 1024,
        }),
      )
        .post("/")
        .set("Content-Type", "text/plain")
        .send(buf.toString())
        .expect(413);
    });
    it("should not change when options altered", async () => {
      const buf = Buffer.alloc(1028, ".");
      const options = {
        limit: "1kb",
      };
      const app = createApp(options);
      options.limit = "100kb";
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send(buf.toString())
        .expect(413);
    });
    it("should not hang response", async () => {
      const app = createApp({
        limit: "8kb",
      });
      const buf = Buffer.alloc(10240, ".");
      const test = request(app).post("/");
      test.set("Content-Type", "text/plain");
      test.write(buf);
      test.write(buf);
      test.write(buf);
      await test.expect(413);
    });
    it("should not error when inflating", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      test.set("Content-Encoding", "gzip");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a1470404",
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
        test.set("Content-Encoding", "gzip");
        test.set("Content-Type", "text/plain");
        test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
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
        test.set("Content-Encoding", "gzip");
        test.set("Content-Type", "text/plain");
        test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
            "hex",
          ),
        );
        await test.expect(200, '"name is 论"');
      });
    });
  });
  describe("with type option", () => {
    describe('when "text/html"', () => {
      before(() => {
        __testApp = createApp({
          type: "text/html",
        });
      });
      it("should parse for custom type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/html")
          .send("<b>tobi</b>")
          .expect(200, '"<b>tobi</b>"');
      });
      it("should ignore standard type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/plain")
          .send("user is tobi")
          .expect(200, "");
      });
    });
    describe('when ["text/html", "text/plain"]', () => {
      before(() => {
        __testApp = createApp({
          type: ["text/html", "text/plain"],
        });
      });
      it('should parse "text/html"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/html")
          .send("<b>tobi</b>")
          .expect(200, '"<b>tobi</b>"');
      });
      it('should parse "text/plain"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/plain")
          .send("tobi")
          .expect(200, '"tobi"');
      });
      it('should ignore "text/xml"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/xml")
          .send("<user>tobi</user>")
          .expect(200, "");
      });
    });
    describe("when a function", () => {
      it("should parse when truthy value returned", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return req.headers["content-type"] === "text/vnd.something";
        }
        await request(app)
          .post("/")
          .set("Content-Type", "text/vnd.something")
          .send("user is tobi")
          .expect(200, '"user is tobi"');
      });
      it("should work without content-type", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return true;
        }
        const test = request(app).post("/");
        test.write("user is tobi");
        await test.expect(200, '"user is tobi"');
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
          if (buf[0] === 0x20) throw new Error("no leading space");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send(" user is tobi")
        .expect(403, "[entity.verify.failed] no leading space");
    });
    it("should allow custom codes", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x20) return;
          const err = new Error("no leading space");
          err.status = 400;
          throw err;
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send(" user is tobi")
        .expect(400, "[entity.verify.failed] no leading space");
    });
    it("should allow pass-through", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x20) throw new Error("no leading space");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is tobi")
        .expect(200, '"user is tobi"');
    });
    it("should 415 on unknown charset prior to verify", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          throw new Error("unexpected verify call");
        },
      });
      const test = request(app).post("/");
      test.set("Content-Type", "text/plain; charset=x-bogus");
      test.write(Buffer.from("00000000", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "X-BOGUS"',
      );
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
      app.use(express.text());
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
        res.json(req.body);
      });
      __testApp = app;
    });
    it("should persist store", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is tobi")
        .expect(200)
        .expect("x-store-foo", "bar")
        .expect('"user is tobi"');
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
      test.set("Content-Encoding", "gzip");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      test.expect(200);
      test.expect("x-store-foo", "bar");
      await test.expect('"name is 论"');
      await test;
    });
    it("should persist store when inflate error", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "gzip");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b0000",
          "hex",
        ),
      );
      test.expect(400);
      await test.expect("x-store-foo", "bar");
      await test;
    });
    it("should persist store when limit exceeded", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is " + Buffer.alloc(1024 * 100, ".").toString())
        .expect(413)
        .expect("x-store-foo", "bar");
    });
  });
  describe("charset", () => {
    before(() => {
      __testApp = createApp();
    });
    it("should parse utf-8", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Type", "text/plain; charset=utf-8");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should parse codepage charsets", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Type", "text/plain; charset=koi8-r");
      test.write(Buffer.from("6e616d6520697320cec5d4", "hex"));
      await test.expect(200, '"name is нет"');
    });
    it("should parse when content-length != char length", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Type", "text/plain; charset=utf-8");
      test.set("Content-Length", "11");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should default to utf-8", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Type", "text/plain");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should 415 on unknown charset", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Type", "text/plain; charset=x-bogus");
      test.write(Buffer.from("00000000", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "X-BOGUS"',
      );
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
      test.set("Content-Type", "text/plain");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should support identity encoding", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "identity");
      test.set("Content-Type", "text/plain");
      test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should support gzip encoding", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "gzip");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should support deflate encoding", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "deflate");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from("789ccb4bcc4d55c82c5678b16e17001a6f050e", "hex"),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should be case-insensitive", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "GZIP");
      test.set("Content-Type", "text/plain");
      test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should 415 on unknown encoding", async () => {
      const test = request(__testApp).post("/");
      test.set("Content-Encoding", "nulls");
      test.set("Content-Type", "text/plain");
      test.write(Buffer.from("000000000000", "hex"));
      await test.expect(
        415,
        '[encoding.unsupported] unsupported content encoding "nulls"',
      );
    });
  });
});
function createApp(options) {
  const app = express();
  app.use(express.text(options));
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
    res.json(req.body);
  });
  return app;
}
