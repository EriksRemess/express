"use strict";

import {describe, it, before} from "node:test";
let __testApp;
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import {Buffer} from "node:buffer";
import express from "#express";
import request from "supertest";
describe("express.json()", () => {
  it("should parse JSON", async () => {
    await request(createApp())
      .post("/")
      .set("Content-Type", "application/json")
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}');
  });
  it("should handle Content-Length: 0", async () => {
    await request(createApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("Content-Length", "0")
      .expect(200, "{}");
  });
  it("should handle empty message-body", async () => {
    await request(createApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("Transfer-Encoding", "chunked")
      .expect(200, "{}");
  });
  it("should handle no message-body", async () => {
    await request(createApp())
      .post("/")
      .set("Content-Type", "application/json")
      .unset("Transfer-Encoding")
      .expect(200, "{}");
  });

  // The old node error message modification in body parser is catching this
  it("should 400 when only whitespace", async () => {
    await request(createApp())
      .post("/")
      .set("Content-Type", "application/json")
      .send("  \n")
      .expect(400, "[entity.parse.failed] " + parseError(" \n"));
  });
  it("should 400 when invalid content-length", async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers["content-length"] = "20"; // bad length
      next();
    });
    app.use(express.json());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send('{"str":')
      .expect(400, /content length/);
  });
  it("should handle duplicated middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use(express.json());
    app.post("/", (req, res) => {
      res.json(req.body);
    });
    await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}');
  });
  describe("when JSON is invalid", () => {
    before(() => {
      __testApp = createApp();
    });
    it("should 400 for bad token", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/json")
        .send("{:")
        .expect(400, "[entity.parse.failed] " + parseError("{:"));
    });
    it("should 400 for incomplete", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/json")
        .send('{"user"')
        .expect(400, "[entity.parse.failed] " + parseError('{"user"'));
    });
    it("should include original body on error object", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/json")
        .set("X-Error-Property", "body")
        .send(' {"user"')
        .expect(400, ' {"user"');
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
        .set("Content-Type", "application/json")
        .set("Content-Length", "1034")
        .send(
          JSON.stringify({
            str: buf.toString(),
          }),
        )
        .expect(413, "[entity.too.large] request entity too large");
    });
    it("should 413 when over limit with chunked encoding", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const buf = Buffer.alloc(1024, ".");
      const test = request(app).post("/");
      await test.set("Content-Type", "application/json");
      await test.set("Transfer-Encoding", "chunked");
      await test.write('{"str":');
      await test.write('"' + buf.toString() + '"}');
      await test.expect(413);
    });
    it("should 413 when inflated body over limit", async () => {
      const app = createApp({
        limit: "1kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000aab562a2e2952b252d21b05a360148c58a0540b0066f7ce1e0a040000",
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
        .set("Content-Type", "application/json")
        .send(
          JSON.stringify({
            str: buf.toString(),
          }),
        )
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
        .set("Content-Type", "application/json")
        .send(
          JSON.stringify({
            str: buf.toString(),
          }),
        )
        .expect(413);
    });
    it("should not hang response", async () => {
      const buf = Buffer.alloc(10240, ".");
      const app = createApp({
        limit: "8kb",
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/json");
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
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000aab562a2e2952b252d21b05a360148c58a0540b0066f7ce1e0a0400",
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
        await test.set("Content-Type", "application/json");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000",
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
        await test.set("Content-Type", "application/json");
        await test.write(
          Buffer.from(
            "1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000",
            "hex",
          ),
        );
        await test.expect(200, '{"name":"论"}');
      });
    });
  });
  describe("with strict option", () => {
    describe("when undefined", () => {
      before(() => {
        __testApp = createApp();
      });
      it("should 400 on primitives", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send("true")
          .expect(
            400,
            "[entity.parse.failed] " + parseError("#rue").replace(/#/g, "t"),
          );
      });
    });
    describe("when false", () => {
      before(() => {
        __testApp = createApp({
          strict: false,
        });
      });
      it("should parse primitives", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send("true")
          .expect(200, "true");
      });
    });
    describe("when true", () => {
      before(() => {
        __testApp = createApp({
          strict: true,
        });
      });
      it("should not parse primitives", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send("true")
          .expect(
            400,
            "[entity.parse.failed] " + parseError("#rue").replace(/#/g, "t"),
          );
      });
      it("should not parse primitives with leading whitespaces", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send("    true")
          .expect(
            400,
            "[entity.parse.failed] " +
              parseError("    #rue").replace(/#/g, "t"),
          );
      });
      it("should allow leading whitespaces in JSON", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send('   { "user": "tobi" }')
          .expect(200, '{"user":"tobi"}');
      });
      it("should include correct message in stack trace", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .set("X-Error-Property", "stack")
          .send("true")
          .expect(400)
          .expect(shouldContainInBody(parseError("#rue").replace(/#/g, "t")));
      });
    });
  });
  describe("with type option", () => {
    describe('when "application/vnd.api+json"', () => {
      before(() => {
        __testApp = createApp({
          type: "application/vnd.api+json",
        });
      });
      it("should parse JSON for custom type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/vnd.api+json")
          .send('{"user":"tobi"}')
          .expect(200, '{"user":"tobi"}');
      });
      it("should ignore standard type", async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send('{"user":"tobi"}')
          .expect(200, "");
      });
    });
    describe('when ["application/json", "application/vnd.api+json"]', () => {
      before(() => {
        __testApp = createApp({
          type: ["application/json", "application/vnd.api+json"],
        });
      });
      it('should parse JSON for "application/json"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/json")
          .send('{"user":"tobi"}')
          .expect(200, '{"user":"tobi"}');
      });
      it('should parse JSON for "application/vnd.api+json"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/vnd.api+json")
          .send('{"user":"tobi"}')
          .expect(200, '{"user":"tobi"}');
      });
      it('should ignore "application/x-json"', async () => {
        await request(__testApp)
          .post("/")
          .set("Content-Type", "application/x-json")
          .send('{"user":"tobi"}')
          .expect(200, "");
      });
    });
    describe("when a function", () => {
      it("should parse when truthy value returned", async () => {
        const app = createApp({
          type: accept,
        });
        function accept(req) {
          return req.headers["content-type"] === "application/vnd.api+json";
        }
        await request(app)
          .post("/")
          .set("Content-Type", "application/vnd.api+json")
          .send('{"user":"tobi"}')
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
        await test.write('{"user":"tobi"}');
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
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .send('["tobi"]')
        .expect(403, "[entity.verify.failed] no arrays");
    });
    it("should allow custom codes", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x5b) return;
          const err = new Error("no arrays");
          err.status = 400;
          throw err;
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .send('["tobi"]')
        .expect(400, "[entity.verify.failed] no arrays");
    });
    it("should allow custom type", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x5b) return;
          const err = new Error("no arrays");
          err.type = "foo.bar";
          throw err;
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .send('["tobi"]')
        .expect(403, "[foo.bar] no arrays");
    });
    it("should include original body on error object", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("X-Error-Property", "body")
        .send('["tobi"]')
        .expect(403, '["tobi"]');
    });
    it("should allow pass-through", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}');
    });
    it("should work with different charsets", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error("no arrays");
        },
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/json; charset=utf-16");
      await test.write(
        Buffer.from(
          "feff007b0022006e0061006d00650022003a00228bba0022007d",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should 415 on unknown charset prior to verify", async () => {
      const app = createApp({
        verify: (req, res, buf) => {
          throw new Error("unexpected verify call");
        },
      });
      const test = request(app).post("/");
      await test.set("Content-Type", "application/json; charset=x-bogus");
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
      app.use(express.json());
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
        .set("Content-Type", "application/json")
        .send('{"user":"tobi"}')
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
        .expect("x-store-foo", "bar")
        .expect("");
    });
    it("should persist store when inflated", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000",
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
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bab56cc4d55b2527ab16e97522d00515be1cc0e000000",
          "hex",
        ),
      );
      await test.expect(400);
      await test.expect("x-store-foo", "bar");
      await test;
    });
    it("should persist store when parse error", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/json")
        .send('{"user":')
        .expect(400)
        .expect("x-store-foo", "bar");
    });
    it("should persist store when limit exceeded", async () => {
      await request(__testApp)
        .post("/")
        .set("Content-Type", "application/json")
        .send('{"user":"' + Buffer.alloc(1024 * 100, ".").toString() + '"}')
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
      await test.set("Content-Type", "application/json; charset=utf-8");
      await test.write(Buffer.from("7b226e616d65223a22e8aeba227d", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should parse utf-16", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/json; charset=utf-16");
      await test.write(
        Buffer.from(
          "feff007b0022006e0061006d00650022003a00228bba0022007d",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should parse when content-length != char length", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/json; charset=utf-8");
      await test.set("Content-Length", "13");
      await test.write(Buffer.from("7b2274657374223a22c3a5227d", "hex"));
      await test.expect(200, '{"test":"å"}');
    });
    it("should default to utf-8", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/json");
      await test.write(Buffer.from("7b226e616d65223a22e8aeba227d", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should fail on unknown charset", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/json; charset=koi8-r");
      await test.write(Buffer.from("7b226e616d65223a22cec5d4227d", "hex"));
      await test.expect(
        415,
        '[charset.unsupported] unsupported charset "KOI8-R"',
      );
    });
  });
  describe("encoding", () => {
    before(() => {
      __testApp = createApp({
        limit: "1kb",
      });
    });
    it("should parse without encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Type", "application/json");
      await test.write(Buffer.from("7b226e616d65223a22e8aeba227d", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support identity encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "identity");
      await test.set("Content-Type", "application/json");
      await test.write(Buffer.from("7b226e616d65223a22e8aeba227d", "hex"));
      await test.expect(200, '{"name":"论"}');
    });
    it("should support gzip encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should support deflate encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "deflate");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from("789cab56ca4bcc4d55b2527ab16e97522d00274505ac", "hex"),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should be case-insensitive", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "GZIP");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000",
          "hex",
        ),
      );
      await test.expect(200, '{"name":"论"}');
    });
    it("should 415 on unknown encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "nulls");
      await test.set("Content-Type", "application/json");
      await test.write(Buffer.from("000000000000", "hex"));
      await test.expect(
        415,
        '[encoding.unsupported] unsupported content encoding "nulls"',
      );
    });
    it("should 400 on malformed encoding", async () => {
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bab56cc4d55b2527ab16e97522d00515be1cc0e000000",
          "hex",
        ),
      );
      await test.expect(400);
    });
    it("should 413 when inflated value exceeds limit", async () => {
      // gzip'd data exceeds 1kb, but deflated below 1kb
      const test = request(__testApp).post("/");
      await test.set("Content-Encoding", "gzip");
      await test.set("Content-Type", "application/json");
      await test.write(
        Buffer.from(
          "1f8b080000000000000bedc1010d000000c2a0f74f6d0f071400000000000000",
          "hex",
        ),
      );
      await test.write(
        Buffer.from(
          "0000000000000000000000000000000000000000000000000000000000000000",
          "hex",
        ),
      );
      await test.write(
        Buffer.from("0000000000000000004f0625b3b71650c30000", "hex"),
      );
      await test.expect(413);
    });
  });
});
function createApp(options) {
  const app = express();
  app.use(express.json(options));
  app.use((err, req, res, next) => {
    // console.log(err)
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
function parseError(str) {
  try {
    JSON.parse(str);
    throw new SyntaxError("strict violation");
  } catch (e) {
    return e.message;
  }
}
function shouldContainInBody(str) {
  return res => {
    assert.ok(
      res.text.indexOf(str) !== -1,
      "expected '" + res.text + "' to contain '" + str + "'",
    );
  };
}
