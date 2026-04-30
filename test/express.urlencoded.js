"use strict";

import {describe, it, before} from "node:test";
let __testApp;
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import {Buffer} from "node:buffer";
import express from "#express";
import request from "supertest";
describe("express.urlencoded()", () => {
  before(() => {
    __testApp = createApp();
  });
  it("should parse x-www-form-urlencoded", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user=tobi")
      .expect(200, '{"user":"tobi"}');
  });
  it("should 400 when invalid content-length", async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.urlencoded());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("str=")
      .expect(400, /content length/);
  });
  it("should handle Content-Length: 0", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("Content-Length", "0")
      .send("")
      .expect(200, "{}");
  });
  it("should handle empty message-body", async () => {
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
  it("should handle duplicated middleware", async () => {
    const app = express();
    app.use(express.urlencoded());
    app.use(express.urlencoded());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user=tobi")
      .expect(200, '{"user":"tobi"}');
  });
  it("should not parse extended syntax", async () => {
    await request(__testApp)
      .post("/")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("user[name][first]=Tobi")
      .expect(200, '{"user[name][first]":"Tobi"}');
  });
  describe("with extended option", () => {
    describe("when false", () => {
      before(() => {
        __testApp = createApp({
          extended: false,
        });
      });
      it("should not parse extended syntax", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user[name][first]=Tobi")
          .expect(200, '{"user[name][first]":"Tobi"}');
      });
      it("should parse multiple key instances", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=Tobi&user=Loki")
          .expect(200, '{"user":["Tobi","Loki"]}');
      });
      it("should ignore unsafe prototype keys", async () => {
        const app = express();

        app.use(express.urlencoded({
          extended: false,
        }));
        app.post("/", (req, res) => {
          const merged = Object.assign({}, req.body);

          res.send({
            keys: Object.keys(req.body).sort(),
            polluted: {}.polluted,
            prototype: Object.getPrototypeOf(merged) === Object.prototype,
          });
        });

        await request(app)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("__proto__=polluted&__proto__=again&constructor=bad&prototype=bad&safe=value")
          .expect(200, '{"keys":["safe"],"prototype":true}');
      });
    });
    describe("when true", () => {
      before(() => {
        __testApp = createApp({
          extended: true,
        });
      });
      it("should parse multiple key instances", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=Tobi&user=Loki")
          .expect(200, '{"user":["Tobi","Loki"]}');
      });
      it("should parse extended syntax", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user[name][first]=Tobi")
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}');
      });
      it("should parse parameters with dots", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user.name=Tobi")
          .expect(200, '{"user.name":"Tobi"}');
      });
      it("should parse fully-encoded extended syntax", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user%5Bname%5D%5Bfirst%5D=Tobi")
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}');
      });
      it("should parse array index notation", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("foo[0]=bar&foo[1]=baz")
          .expect(200, '{"foo":["bar","baz"]}');
      });
      it("should parse array index notation with large array", async () => {
        let str = "f[0]=0";
        for (let i = 1; i < 500; i++) {
          str += "&f[" + i + "]=" + i.toString(16);
        }
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(str)
          .expect(res => {
            const obj = JSON.parse(res.text);
            assert.strictEqual(Object.keys(obj).length, 1);
            assert.strictEqual(Array.isArray(obj.f), true);
            assert.strictEqual(obj.f.length, 500);
          })
          .expect(200);
      });
      it("should parse array of objects syntax", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("foo[0][bar]=baz&foo[0][fizz]=buzz&foo[]=done!")
          .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"},"done!"]}');
      });
      it("should parse deep object", async () => {
        let str = "foo";
        for (let i = 0; i < 32; i++) {
          str += "[p]";
        }
        str += "=bar";
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send(str)
          .expect(res => {
            const obj = JSON.parse(res.text);
            assert.strictEqual(Object.keys(obj).length, 1);
            assert.strictEqual(typeof obj.foo, "object");
            let depth = 0;
            let ref = obj.foo;
            while ((ref = ref.p)) {
              depth++;
            }
            assert.strictEqual(depth, 32);
          })
          .expect(200);
      });
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
    describe("when true", () => {
      before(() => {
        __testApp = createApp({
          inflate: true,
        });
      });
      it("should accept content-encoding", async () => {
        const test = request(__testApp).post("/");
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
  describe("with limit option", () => {
    it("should 413 when over limit with Content-Length", async () => {
      const buf = Buffer.alloc(1024, ".");
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
    it("should 413 when over limit with chunked encoding", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const buf = Buffer.alloc(1024, ".");
      const test = request(app).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.set("Transfer-Encoding", "chunked");
      await test.write("str=");
      await test.write(buf.toString());
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
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
    it("should accept number of bytes", async () => {
      const buf = Buffer.alloc(1024, ".");
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
    it("should not change when options altered", async () => {
      const buf = Buffer.alloc(1024, ".");
      const options = {
        limit: "1kb",
      };
      const app = createApp(options);
      options.limit = "100kb";
      await request(app)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("str=" + buf.toString())
        .expect(413);
    });
    it("should not hang response", async () => {
      const app = createApp({
        limit: "8kb",
      });
      const buf = Buffer.alloc(10240, ".");
      const test = request(app).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
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
  describe("with parameterLimit option", () => {
    describe("with extended: false", () => {
      it("should reject 0", () => {
        assert.throws(
          createApp.bind(null, {
            extended: false,
            parameterLimit: 0,
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should reject string", () => {
        assert.throws(
          createApp.bind(null, {
            extended: false,
            parameterLimit: "beep",
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should 413 if over limit", async () => {
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
      it("should work when at the limit", async () => {
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
      it("should work if number is floating point", async () => {
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
      it("should work with large limit", async () => {
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
      it("should work with very large finite limits", async () => {
        await request(
          createApp({
            extended: false,
            parameterLimit: 2147483648,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should work with Infinity limit", async () => {
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
    describe("with extended: true", () => {
      it("should reject 0", () => {
        assert.throws(
          createApp.bind(null, {
            extended: true,
            parameterLimit: 0,
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should reject string", () => {
        assert.throws(
          createApp.bind(null, {
            extended: true,
            parameterLimit: "beep",
          }),
          /TypeError: option parameterLimit must be a positive number/,
        );
      });
      it("should 413 if over limit", async () => {
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
      it("should work when at the limit", async () => {
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
      it("should work if number is floating point", async () => {
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
      it("should work with large limit", async () => {
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
      it("should work with very large finite limits", async () => {
        await request(
          createApp({
            extended: true,
            parameterLimit: 2147483648,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user[name]=tobi")
          .expect(200, '{"user":{"name":"tobi"}}');
      });
      it("should not create sparse arrays for very large finite limits", async () => {
        await request(
          createApp({
            extended: true,
            parameterLimit: 2147483648,
          }),
        )
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("items[2147483647]=x")
          .expect(200, '{"items":{"2147483647":"x"}}');
      });
      it("should work with Infinity limit", async () => {
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
  describe("with type option", () => {
    describe('when "application/vnd.x-www-form-urlencoded"', () => {
      before(() => {
        __testApp = createApp({
          type: "application/vnd.x-www-form-urlencoded",
        });
      });
      it("should parse for custom type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/vnd.x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should ignore standard type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, "");
      });
    });
    describe('when ["urlencoded", "application/x-pairs"]', () => {
      before(() => {
        __testApp = createApp({
          type: ["urlencoded", "application/x-pairs"],
        });
      });
      it('should parse "application/x-www-form-urlencoded"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it('should parse "application/x-pairs"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-pairs")
          .send("user=tobi")
          .expect(200, '{"user":"tobi"}');
      });
      it("should ignore application/x-foo", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-foo")
          .send("user=tobi")
          .expect(200, "");
      });
    });
    describe("when a function", () => {
      it("should parse when truthy value returned", async () => {
        const app = createApp({
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
      it("should work without content-type", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return true;
        }
        const test = request(app).post("/");
        await test.write("user=tobi");
        await test.expect(200, '{"user":"tobi"}');
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
    it("should assert value if function", () => {
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(" user=tobi")
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(" user=tobi")
        .expect(400, "[entity.verify.failed] no leading space");
    });
    it("should allow custom type", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x20) return;
          const err = new Error("no leading space");
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
    it("should allow pass-through", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=tobi")
        .expect(200, '{"user":"tobi"}');
    });
    it("should 415 on unknown charset prior to verify", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          throw new Error("unexpected verify call");
        },
      });
      const test = request(app).post("/");
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
      app.use(express.urlencoded());
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
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=tobi")
        .expect(200)
        .expect("x-store-foo", "bar")
        .expect('{"user":"tobi"}');
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
    it("should persist store when inflate error", async () => {
      const test = request(__testApp).post("/");
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
    it("should persist store when limit exceeded", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("user=" + Buffer.alloc(1024 * 100, ".").toString())
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
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=utf-8",
      );
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should parse when content-length != char length", async () => {
      const test = request(__testApp).post("/");
      await test.set(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=utf-8",
      );
      await test.set("Content-Length", "7");
      await test.write(Buffer.from("746573743dc3a5", "hex"));
      await test.expect(200, '{"test":"å"}');
    });
    it("should default to utf-8", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should fail on unknown charset", async () => {
      const test = request(__testApp).post("/");
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
  describe("encoding", () => {
    before(() => {
      __testApp = createApp({
        limit: "10kb",
      });
    });
    it("should parse without encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support identity encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "identity");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("6e616d653de8aeba", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support gzip encoding", async () => {
      const test = request(__testApp).post("/");
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
    it("should support deflate encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "deflate");
      await test.set("Content-Type", "application/x-www-form-urlencoded");
      await test.write(Buffer.from("789ccb4bcc4db57db16e17001068042f", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should be case-insensitive", async () => {
      const test = request(__testApp).post("/");
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
    it("should 415 on unknown encoding", async () => {
      const test = request(__testApp).post("/");
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
  let str = "";
  if (count === 0) {
    return str;
  }
  str += "0=0";
  for (let i = 1; i < count; i++) {
    const n = i.toString(36);
    str += "&" + n + "=" + n;
  }
  return str;
}
function createApp(options) {
  const app = express();
  app.use(express.urlencoded(options));
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
function expectKeyCount(count) {
  return res => {
    assert.strictEqual(Object.keys(JSON.parse(res.text)).length, count);
  };
}
