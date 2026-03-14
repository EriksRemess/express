"use strict";

var { describe, it, before } = require("node:test");
var __testApp;
var assert = require("node:assert");
var AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
const { Buffer } = require("node:buffer");
var express = require("..");
var request = require("supertest");
describe("express.text()", function () {
  before(function () {
    __testApp = createApp();
  });
  it("should parse text/plain", async function () {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user is tobi")
      .expect(200, '"user is tobi"');
  });
  it("should 400 when invalid content-length", async function () {
    var app = express();
    app.use(function (req, res, next) {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.text());
    app.post("/", function (req, res) {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user")
      .expect(400, /content length/);
  });
  it("should handle Content-Length: 0", async function () {
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
  it("should handle empty message-body", async function () {
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
  it("should handle duplicated middleware", async function () {
    var app = express();
    app.use(express.text());
    app.use(express.text());
    app.post("/", function (req, res) {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "text/plain")
      .send("user is tobi")
      .expect(200, '"user is tobi"');
  });
  describe("with defaultCharset option", function () {
    it("should change default charset", async function () {
      var server = createApp({
        defaultCharset: "koi8-r",
      });
      var test = request(server).post("/");
      await test.set("Content-Type", "text/plain");
      await test.write(Buffer.from("6e616d6520697320cec5d4", "hex"));
      await test.expect(200, '"name is нет"');
    });
    it("should honor content-type charset", async function () {
      var server = createApp({
        defaultCharset: "koi8-r",
      });
      var test = request(server).post("/");
      await test.set("Content-Type", "text/plain; charset=utf-8");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
  });
  describe("with limit option", function () {
    it("should 413 when over limit with Content-Length", async function () {
      var buf = Buffer.alloc(1028, ".");
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
    it("should 413 when over limit with chunked encoding", async function () {
      var app = createApp({
        limit: "1kb",
      });
      var buf = Buffer.alloc(1028, ".");
      var test = request(app).post("/");
      await test.set("Content-Type", "text/plain");
      await test.set("Transfer-Encoding", "chunked");
      await test.write(buf.toString());
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async function () {
      var app = createApp({
        limit: "1kb",
      });
      var test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a14704040000",
          "hex",
        ),
      );
      await test.expect(413);
    });
    it("should accept number of bytes", async function () {
      var buf = Buffer.alloc(1028, ".");
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
    it("should not change when options altered", async function () {
      var buf = Buffer.alloc(1028, ".");
      var options = {
        limit: "1kb",
      };
      var app = createApp(options);
      options.limit = "100kb";
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send(buf.toString())
        .expect(413);
    });
    it("should not hang response", async function () {
      var app = createApp({
        limit: "8kb",
      });
      var buf = Buffer.alloc(10240, ".");
      var test = request(app).post("/");
      await test.set("Content-Type", "text/plain");
      await test.write(buf);
      await test.write(buf);
      await test.write(buf);
      await test.expect(413);
    });
    it("should not error when inflating", async function () {
      var app = createApp({
        limit: "1kb",
      });
      var test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000ad3d31b05a360148c64000087e5a1470404",
          "hex",
        ),
      );
      setTimeout(function () {
        test.expect(413);
      }, 100);
    });
  });
  describe("with inflate option", function () {
    describe("when false", function () {
      before(function () {
        __testApp = createApp({
          inflate: false,
        });
      });
      it("should not accept content-encoding", async function () {
        var test = request(__testApp).post("/");
        await test.set("Content-Encoding", "gzip");
        await test.set("Content-Type", "text/plain");
        await test.write(
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
    describe("when true", function () {
      before(function () {
        __testApp = createApp({
          inflate: true,
        });
      });
      it("should accept content-encoding", async function () {
        var test = request(__testApp).post("/");
        await test.set("Content-Encoding", "gzip");
        await test.set("Content-Type", "text/plain");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
            "hex",
          ),
        );
        await test.expect(200, '"name is 论"');
      });
    });
  });
  describe("with type option", function () {
    describe('when "text/html"', function () {
      before(function () {
        __testApp = createApp({
          type: "text/html",
        });
      });
      it("should parse for custom type", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/html")
          .send("<b>tobi</b>")
          .expect(200, '"<b>tobi</b>"');
      });
      it("should ignore standard type", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/plain")
          .send("user is tobi")
          .expect(200, "");
      });
    });
    describe('when ["text/html", "text/plain"]', function () {
      before(function () {
        __testApp = createApp({
          type: ["text/html", "text/plain"],
        });
      });
      it('should parse "text/html"', async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/html")
          .send("<b>tobi</b>")
          .expect(200, '"<b>tobi</b>"');
      });
      it('should parse "text/plain"', async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/plain")
          .send("tobi")
          .expect(200, '"tobi"');
      });
      it('should ignore "text/xml"', async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "text/xml")
          .send("<user>tobi</user>")
          .expect(200, "");
      });
    });
    describe("when a function", function () {
      it("should parse when truthy value returned", async function () {
        var app = createApp({
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
      it("should work without content-type", async function () {
        var app = createApp({
          type: accept,
        });
        function accept(req) {
          return true;
        }
        var test = request(app).post("/");
        await test.write("user is tobi");
        await test.expect(200, '"user is tobi"');
      });
      it("should not invoke without a body", async function () {
        var app = createApp({
          type: accept,
        });
        function accept(req) {
          throw new Error("oops!");
        }
        await request(app).get("/").expect(404);
      });
    });
  });
  describe("with verify option", function () {
    it("should assert value is function", function () {
      assert.throws(
        createApp.bind(null, {
          verify: "lol",
        }),
        /TypeError: option verify must be function/,
      );
    });
    it("should error from verify", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x20) throw new Error("no leading space");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send(" user is tobi")
        .expect(403, "[entity.verify.failed] no leading space");
    });
    it("should allow custom codes", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x20) return;
          var err = new Error("no leading space");
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
    it("should allow pass-through", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x20) throw new Error("no leading space");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is tobi")
        .expect(200, '"user is tobi"');
    });
    it("should 415 on unknown charset prior to verify", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          throw new Error("unexpected verify call");
        },
      });
      var test = request(app).post("/");
      await test.set("Content-Type", "text/plain; charset=x-bogus");
      await test.write(Buffer.from("00000000", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "X-BOGUS"',
      );
    });
  });
  describe("async local storage", function () {
    before(function () {
      var app = express();
      var store = {
        foo: "bar",
      };
      app.use(function (req, res, next) {
        req.asyncLocalStorage = new AsyncLocalStorage();
        req.asyncLocalStorage.run(store, next);
      });
      app.use(express.text());
      app.use(function (req, res, next) {
        var local = req.asyncLocalStorage.getStore();
        if (local) {
          res.setHeader("x-store-foo", String(local.foo));
        }
        next();
      });
      app.use(function (err, req, res, next) {
        var local = req.asyncLocalStorage.getStore();
        if (local) {
          res.setHeader("x-store-foo", String(local.foo));
        }
        res.status(err.status || 500);
        res.send("[" + err.type + "] " + err.message);
      });
      app.post("/", function (req, res) {
        res.json(req.body);
      });
      __testApp = app;
    });
    it("should persist store", async function () {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is tobi")
        .expect(200)
        .expect("x-store-foo", "bar")
        .expect('"user is tobi"');
    });
    it("should persist store when unmatched content-type", async function () {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/fizzbuzz")
        .send("buzz")
        .expect(200)
        .expect("x-store-foo", "bar");
    });
    it("should persist store when inflated", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      await test.expect(200);
      await test.expect("x-store-foo", "bar");
      await test.expect('"name is 论"');
      await test;
    });
    it("should persist store when inflate error", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b0000",
          "hex",
        ),
      );
      await test.expect(400);
      await test.expect("x-store-foo", "bar");
      await test;
    });
    it("should persist store when limit exceeded", async function () {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "text/plain")
        .send("user is " + Buffer.alloc(1024 * 100, ".").toString())
        .expect(413)
        .expect("x-store-foo", "bar");
    });
  });
  describe("charset", function () {
    before(function () {
      __testApp = createApp();
    });
    it("should parse utf-8", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain; charset=utf-8");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should parse codepage charsets", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain; charset=koi8-r");
      await test.write(Buffer.from("6e616d6520697320cec5d4", "hex"));
      await test.expect(200, '"name is нет"');
    });
    it("should parse when content-length != char length", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain; charset=utf-8");
      await test.set("Content-Length", "11");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should default to utf-8", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should 415 on unknown charset", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain; charset=x-bogus");
      await test.write(Buffer.from("00000000", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "X-BOGUS"',
      );
    });
  });
  describe("encoding", function () {
    before(function () {
      __testApp = createApp({
        limit: "10kb",
      });
    });
    it("should parse without encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "text/plain");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should support identity encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "identity");
      await test.set("Content-Type", "text/plain");
      await test.write(Buffer.from("6e616d6520697320e8aeba", "hex"));
      await test.expect(200, '"name is 论"');
    });
    it("should support gzip encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should support deflate encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "deflate");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from("789ccb4bcc4d55c82c5678b16e17001a6f050e", "hex"),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should be case-insensitive", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "GZIP");
      await test.set("Content-Type", "text/plain");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000",
          "hex",
        ),
      );
      await test.expect(200, '"name is 论"');
    });
    it("should 415 on unknown encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "nulls");
      await test.set("Content-Type", "text/plain");
      await test.write(Buffer.from("000000000000", "hex"));
      await test.expect(
        415,
        '[encoding.unsupported] unsupported content encoding "nulls"',
      );
    });
  });
});
function createApp(options) {
  var app = express();
  app.use(express.text(options));
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.send(
      String(
        req.headers["x-error-property"]
          ? err[req.headers["x-error-property"]]
          : "[" + err.type + "] " + err.message,
      ),
    );
  });
  app.post("/", function (req, res) {
    res.json(req.body);
  });
  return app;
}
