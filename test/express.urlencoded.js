"use strict";

var { describe, it, before } = require("node:test");
var __testApp;
var assert = require("node:assert");
var AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
const { Buffer } = require("node:buffer");
var express = require("..");
var request = require("supertest");
describe("express.urlencoded()", function () {
  before(function () {
    __testApp = createApp();
  });
  it("should parse x-www-form-urlencoded", async function () {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user=tobi")
      .expect(200, '{"user":"tobi"}');
  });
  it("should 400 when invalid content-length", async function () {
    var app = express();
    app.use(function (req, res, next) {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.urlencoded());
    app.post("/", function (req, res) {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("str=")
      .expect(400, /content length/);
  });
  it("should handle Content-Length: 0", async function () {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("Content-Length", "0")
      .send("")
      .expect(200, "{}");
  });
  it("should handle empty message-body", async function () {
    await request(
      createApp({
        limit: "1kb",
      }),
    )
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("Transfer-Encoding", "chunked")
      .send("")
      .expect(200, "{}");
  });
  it("should handle duplicated middleware", async function () {
    var app = express();
    app.use(express.urlencoded());
    app.use(express.urlencoded());
    app.post("/", function (req, res) {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user=tobi")
      .expect(200, '{"user":"tobi"}');
  });
  it("should not parse extended syntax", async function () {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user[name][first]=Tobi")
      .expect(200, '{"user[name][first]":"Tobi"}');
  });
  describe("with extended option", function () {
    describe("when false", function () {
      before(function () {
        __testApp = createApp({
          extended: false,
        });
      });
      it("should not parse extended syntax", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user[name][first]=Tobi")
          .expect(200, '{"user[name][first]":"Tobi"}');
      });
      it("should parse multiple key instances", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=Tobi&user=Loki")
          .expect(200, '{"user":["Tobi","Loki"]}');
      });
    });
    describe("when true", function () {
      before(function () {
        __testApp = createApp({
          extended: true,
        });
      });
      it("should parse multiple key instances", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=Tobi&user=Loki")
          .expect(200, '{"user":["Tobi","Loki"]}');
      });
      it("should parse extended syntax", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user[name][first]=Tobi")
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}');
      });
      it("should parse parameters with dots", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user.name=Tobi")
          .expect(200, '{"user.name":"Tobi"}');
      });
      it("should parse fully-encoded extended syntax", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user%5Bname%5D%5Bfirst%5D=Tobi")
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}');
      });
      it("should parse array index notation", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("foo[0]=bar&foo[1]=baz")
          .expect(200, '{"foo":["bar","baz"]}');
      });
      it("should parse array index notation with large array", async function () {
        var str = "f[0]=0";
        for (var i = 1; i < 500; i++) {
          str += "&f[" + i + "]=" + i.toString(16);
        }
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(str)
          .expect(function (res) {
            var obj = JSON.parse(res.text);
            assert.strictEqual(Object.keys(obj).length, 1);
            assert.strictEqual(Array.isArray(obj.f), true);
            assert.strictEqual(obj.f.length, 500);
          })
          .expect(200);
      });
      it("should parse array of objects syntax", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("foo[0][bar]=baz&foo[0][fizz]=buzz&foo[]=done!")
          .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"},"done!"]}');
      });
      it("should parse deep object", async function () {
        var str = "foo";
        for (var i = 0; i < 32; i++) {
          str += "[p]";
        }
        str += "=bar";
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(str)
          .expect(function (res) {
            var obj = JSON.parse(res.text);
            assert.strictEqual(Object.keys(obj).length, 1);
            assert.strictEqual(typeof obj.foo, "object");
            var depth = 0;
            var ref = obj.foo;
            while ((ref = ref.p)) {
              depth++;
            }
            assert.strictEqual(depth, 32);
          })
          .expect(200);
      });
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
        await test.set("Content-Type", "application/x-www-form-urlencoded");
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
    describe("when true", function () {
      before(function () {
        __testApp = createApp({
          inflate: true,
        });
      });
      it("should accept content-encoding", async function () {
        var test = request(__testApp).post("/");
        await test.set("Content-Encoding", "gzip");
        await test.set("Content-Type", "application/x-www-form-urlencoded");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
            "hex",
          ),
        );
        await test.expect(200, '{"name":"论"}');
      });
    });
  });
  describe("with limit option", function () {
    it("should 413 when over limit with Content-Length", async function () {
      var buf = Buffer.alloc(1024, ".");
      await request(
        createApp({
          limit: "1kb",
        }),
      )
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Content-Length", "1028")
        .send("str=" + buf.toString())
        .expect(413);
    });
    it("should 413 when over limit with chunked encoding", async function () {
      var app = createApp({
        limit: "1kb",
      });
      var buf = Buffer.alloc(1024, ".");
      var test = request(app).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.set("Transfer-Encoding", "chunked");
      await test.write("str=");
      await test.write(buf.toString());
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async function () {
      var app = createApp({
        limit: "1kb",
      });
      var test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(
        Buffer.from(
          "1f8b080000000000000a2b2e29b2d51b05a360148c580000a0351f9204040000",
          "hex",
        ),
      );
      await test.expect(413);
    });
    it("should accept number of bytes", async function () {
      var buf = Buffer.alloc(1024, ".");
      await request(
        createApp({
          limit: 1024,
        }),
      )
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("str=" + buf.toString())
        .expect(413);
    });
    it("should not change when options altered", async function () {
      var buf = Buffer.alloc(1024, ".");
      var options = {
        limit: "1kb",
      };
      var app = createApp(options);
      options.limit = "100kb";
      await request(app)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("str=" + buf.toString())
        .expect(413);
    });
    it("should not hang response", async function () {
      var app = createApp({
        limit: "8kb",
      });
      var buf = Buffer.alloc(10240, ".");
      var test = request(app).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
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
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(
        Buffer.from(
          "1f8b080000000000000a2b2e29b2d51b05a360148c580000a0351f92040400",
          "hex",
        ),
      );
      await test.expect(413);
    });
  });
  describe("with parameterLimit option", function () {
    describe("with extended: false", function () {
      it("should reject 0", function () {
        assert.throws(
          createApp.bind(null, {
            extended: false,
            parameterLimit: 0,
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should reject string", function () {
        assert.throws(
          createApp.bind(null, {
            extended: false,
            parameterLimit: "beep",
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should 413 if over limit", async function () {
        await request(
          createApp({
            extended: false,
            parameterLimit: 10,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(11))
          .expect(413, "[parameters.too.many] too many parameters");
      });
      it("should work when at the limit", async function () {
        await request(
          createApp({
            extended: false,
            parameterLimit: 10,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(10))
          .expect(expectKeyCount(10))
          .expect(200);
      });
      it("should work if number is floating point", async function () {
        await request(
          createApp({
            extended: false,
            parameterLimit: 10.1,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(11))
          .expect(413, /too many parameters/);
      });
      it("should work with large limit", async function () {
        await request(
          createApp({
            extended: false,
            parameterLimit: 5000,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(5000))
          .expect(expectKeyCount(5000))
          .expect(200);
      });
      it("should work with Infinity limit", async function () {
        await request(
          createApp({
            extended: false,
            parameterLimit: Infinity,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(10000))
          .expect(expectKeyCount(10000))
          .expect(200);
      });
    });
    describe("with extended: true", function () {
      it("should reject 0", function () {
        assert.throws(
          createApp.bind(null, {
            extended: true,
            parameterLimit: 0,
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should reject string", function () {
        assert.throws(
          createApp.bind(null, {
            extended: true,
            parameterLimit: "beep",
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should 413 if over limit", async function () {
        await request(
          createApp({
            extended: true,
            parameterLimit: 10,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(11))
          .expect(413, "[parameters.too.many] too many parameters");
      });
      it("should work when at the limit", async function () {
        await request(
          createApp({
            extended: true,
            parameterLimit: 10,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(10))
          .expect(expectKeyCount(10))
          .expect(200);
      });
      it("should work if number is floating point", async function () {
        await request(
          createApp({
            extended: true,
            parameterLimit: 10.1,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(11))
          .expect(413, /too many parameters/);
      });
      it("should work with large limit", async function () {
        await request(
          createApp({
            extended: true,
            parameterLimit: 5000,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(5000))
          .expect(expectKeyCount(5000))
          .expect(200);
      });
      it("should work with Infinity limit", async function () {
        await request(
          createApp({
            extended: true,
            parameterLimit: Infinity,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(createManyParams(10000))
          .expect(expectKeyCount(10000))
          .expect(200);
      });
    });
  });
  describe("with type option", function () {
    describe('when "application/vnd.x-www-form-urlencoded"', function () {
      before(function () {
        __testApp = createApp({
          type: "application/vnd.x-www-form-urlencoded",
        });
      });
      it("should parse for custom type", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/vnd.x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should ignore standard type", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, "");
      });
    });
    describe('when ["urlencoded", "application/x-pairs"]', function () {
      before(function () {
        __testApp = createApp({
          type: ["urlencoded", "application/x-pairs"],
        });
      });
      it('should parse "application/x-www-form-urlencoded"', async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it('should parse "application/x-pairs"', async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-pairs")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should ignore application/x-foo", async function () {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-foo")
          .send("user=tobi")
          .expect(200, "");
      });
    });
    describe("when a function", function () {
      it("should parse when truthy value returned", async function () {
        var app = createApp({
          type: accept,
        });
        function accept(req) {
          return req.headers["content-type"] === "application/vnd.something";
        }
        await request(app)
          .post("/")
          .set("Content-Type", "application/vnd.something")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should work without content-type", async function () {
        var app = createApp({
          type: accept,
        });
        function accept(req) {
          return true;
        }
        var test = request(app).post("/");
        await test.write("user=tobi");
        await test.expect(200, '{"user":"tobi"}');
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
    it("should assert value if function", function () {
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(" user=tobi")
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(" user=tobi")
        .expect(400, "[entity.verify.failed] no leading space");
    });
    it("should allow custom type", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x20) return;
          var err = new Error("no leading space");
          err.type = "foo.bar";
          throw err;
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(" user=tobi")
        .expect(403, "[foo.bar] no leading space");
    });
    it("should allow pass-through", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=tobi")
        .expect(200, '{"user":"tobi"}');
    });
    it("should 415 on unknown charset prior to verify", async function () {
      var app = createApp({
        verify: function (req, res, buf) {
          throw new Error("unexpected verify call");
        },
      });
      var test = request(app).post("/");
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=x-bogus",
      );
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
      app.use(express.urlencoded());
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=tobi")
        .expect(200)
        .expect("x-store-foo", "bar")
        .expect('{"user":"tobi"}');
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
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200);
      await test.expect("x-store-foo", "bar");
      await test.expect('{"name":"论"}');
      await test;
    });
    it("should persist store when inflate error", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
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
    it("should persist store when limit exceeded", async function () {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=" + Buffer.alloc(1024 * 100, ".").toString())
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
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=utf-8",
      );
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should parse when content-length != char length", async function () {
      var test = request(__testApp).post("/");
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=utf-8",
      );
      await test.set("Content-Length", "7");
      await test.write(Buffer.from("746573743dc3a5", "hex"));
      await test.expect(200, '{"test":"å"}');
    });
    it("should default to utf-8", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should fail on unknown charset", async function () {
      var test = request(__testApp).post("/");
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=koi8-r",
      );
      await test.write(Buffer.from("6e616d653dcec5d4", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "KOI8-R"',
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
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support identity encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "identity");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support gzip encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should support deflate encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "deflate");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("789ccb4bcc4db57db16e17001068042f", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should be case-insensitive", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "GZIP");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should 415 on unknown encoding", async function () {
      var test = request(__testApp).post("/");
      await test.set("Content-Encoding", "nulls");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("000000000000", "hex"));
      await test.expect(
        415,
        '[encoding.unsupported] unsupported content encoding "nulls"',
      );
    });
  });
});
function createManyParams(count) {
  var str = "";
  if (count === 0) {
    return str;
  }
  str += "0=0";
  for (var i = 1; i < count; i++) {
    var n = i.toString(36);
    str += "&" + n + "=" + n;
  }
  return str;
}
function createApp(options) {
  var app = express();
  app.use(express.urlencoded(options));
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
function expectKeyCount(count) {
  return function (res) {
    assert.strictEqual(Object.keys(JSON.parse(res.text)).length, count);
  };
}
