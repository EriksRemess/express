"use strict";

import {describe, it} from "node:test";
import assert from "node:assert";
import {Buffer} from "node:buffer";
import express from "#express";
import {methods} from "#lib/utils";
import request from "supertest";
import utils from "#test/support/utils";
import {shouldSkipQuery} from "#test/support/utils";
describe("res", () => {
  describe(".send()", () => {
    it('should set body to ""', async () => {
      const app = express();
      app.use((req, res) => {
        res.send();
      });
      await request(app).get("/").expect(200, "");
    });
  });
  describe(".send(null)", () => {
    it('should set body to ""', async () => {
      const app = express();
      app.use((req, res) => {
        res.send(null);
      });
      await request(app).get("/").expect("Content-Length", "0").expect(200, "");
    });
  });
  describe(".send(undefined)", () => {
    it('should set body to ""', async () => {
      const app = express();
      app.use((req, res) => {
        res.send(undefined);
      });
      await request(app).get("/").expect(200, "");
    });
  });
  describe(".send(Number)", () => {
    it("should send as application/json", async () => {
      const app = express();
      app.use((req, res) => {
        res.send(1000);
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/json; charset=utf-8")
        .expect(200, "1000");
    });
  });
  describe(".send(String)", () => {
    it("should send as html", async () => {
      const app = express();
      app.use((req, res) => {
        res.send("<p>hey</p>");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect(200, "<p>hey</p>");
    });
    it("should set ETag", async () => {
      const app = express();
      app.use((req, res) => {
        const str = Array(1000).join("-");
        res.send(str);
      });
      await request(app)
        .get("/")
        .expect("ETag", 'W/"3e7-qPnkJ3CVdVhFJQvUBfF10TmVA7g"')
        .expect(200);
    });
    it("should not override Content-Type", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", "text/plain").send("hey");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8")
        .expect(200, "hey");
    });
    it("should override charset in Content-Type", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", "text/plain; charset=iso-8859-1").send("hey");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8")
        .expect(200, "hey");
    });
    it("should keep charset in Content-Type for Buffers", async () => {
      const app = express();
      app.use((req, res) => {
        res
          .set("Content-Type", "text/plain; charset=iso-8859-1")
          .send(Buffer.from("hi"));
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=iso-8859-1")
        .expect(200, "hi");
    });
  });
  describe(".send(Buffer)", () => {
    it("should send as octet-stream", async () => {
      const app = express();
      app.use((req, res) => {
        res.send(Buffer.from("hello"));
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect("Content-Type", "application/octet-stream")
        .expect(utils.shouldHaveBody(Buffer.from("hello")));
    });
    it("should set ETag", async () => {
      const app = express();
      app.use((req, res) => {
        res.send(Buffer.alloc(999, "-"));
      });
      await request(app)
        .get("/")
        .expect("ETag", 'W/"3e7-qPnkJ3CVdVhFJQvUBfF10TmVA7g"')
        .expect(200);
    });
    it("should not override Content-Type", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", "text/plain").send(Buffer.from("hey"));
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8")
        .expect(200, "hey");
    });
    it("should accept Uint8Array", async () => {
      const app = express();
      app.use((req, res) => {
        const encodedHey = new TextEncoder().encode("hey");
        res.set("Content-Type", "text/plain").send(encodedHey);
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8")
        .expect(200, "hey");
    });
    it("should not override ETag", async () => {
      const app = express();
      app.use((req, res) => {
        res.type("text/plain").set("ETag", '"foo"').send(Buffer.from("hey"));
      });
      await request(app).get("/").expect("ETag", '"foo"').expect(200, "hey");
    });
  });
  describe(".send(Object)", () => {
    it("should send as application/json", async () => {
      const app = express();
      app.use((req, res) => {
        res.send({
          name: "tobi",
        });
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/json; charset=utf-8")
        .expect(200, '{"name":"tobi"}');
    });
  });
  describe("when the request method is HEAD", () => {
    it("should ignore the body", async () => {
      const app = express();
      app.use((req, res) => {
        res.send("yay");
      });
      await request(app)
        .head("/")
        .expect(200)
        .expect(utils.shouldNotHaveBody());
    });
  });
  describe("when .statusCode is 204", () => {
    it("should strip Content-* fields, Transfer-Encoding field, and body", async () => {
      const app = express();
      app.use((req, res) => {
        res.status(204).set("Transfer-Encoding", "chunked").send("foo");
      });
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Content-Type"))
        .expect(utils.shouldNotHaveHeader("Content-Length"))
        .expect(utils.shouldNotHaveHeader("Transfer-Encoding"))
        .expect(204, "");
    });
  });
  describe("when .statusCode is 205", () => {
    it("should strip Transfer-Encoding field and body, set Content-Length", async () => {
      const app = express();
      app.use((req, res) => {
        res.status(205).set("Transfer-Encoding", "chunked").send("foo");
      });
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Transfer-Encoding"))
        .expect("Content-Length", "0")
        .expect(205, "");
    });
  });
  describe("when .statusCode is 304", () => {
    it("should strip Content-* fields, Transfer-Encoding field, and body", async () => {
      const app = express();
      app.use((req, res) => {
        res.status(304).set("Transfer-Encoding", "chunked").send("foo");
      });
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Content-Type"))
        .expect(utils.shouldNotHaveHeader("Content-Length"))
        .expect(utils.shouldNotHaveHeader("Transfer-Encoding"))
        .expect(304, "");
    });
  });
  it("should always check regardless of length", async () => {
    const app = express();
    const etag = '"asdf"';
    app.use((req, res, next) => {
      res.set("ETag", etag);
      res.send("hey");
    });
    await request(app).get("/").set("If-None-Match", etag).expect(304);
  });
  it("should respond with 304 Not Modified when fresh", async () => {
    const app = express();
    const etag = '"asdf"';
    app.use((req, res) => {
      const str = Array(1000).join("-");
      res.set("ETag", etag);
      res.send(str);
    });
    await request(app).get("/").set("If-None-Match", etag).expect(304);
  });
  it("should not perform freshness check unless 2xx or 304", async () => {
    const app = express();
    const etag = '"asdf"';
    app.use((req, res, next) => {
      res.status(500);
      res.set("ETag", etag);
      res.send("hey");
    });
    await request(app)
      .get("/")
      .set("If-None-Match", etag)
      .expect("hey")
      .expect(500);
  });
  it("should not support jsonp callbacks", async () => {
    const app = express();
    app.use((req, res) => {
      res.send({
        foo: "bar",
      });
    });
    await request(app).get("/?callback=foo").expect('{"foo":"bar"}');
  });
  it("should be chainable", async () => {
    const app = express();
    app.use((req, res) => {
      assert.equal(res.send("hey"), res);
    });
    await request(app).get("/").expect(200, "hey");
  });
  describe('"etag" setting', () => {
    describe("when enabled", () => {
      it("should send ETag", async () => {
        const app = express();
        app.use((req, res) => {
          res.send("kajdslfkasdf");
        });
        app.enable("etag");
        await request(app)
          .get("/")
          .expect("ETag", 'W/"c-IgR/L5SF7CJQff4wxKGF/vfPuZ0"')
          .expect(200);
      });
      methods.forEach(method => {
        if (method === "connect") return;
        it(
          "should send ETag in response to " +
            method.toUpperCase() +
            " request",
          {
            skip: method === "query" && shouldSkipQuery(process.versions.node),
          },
          async () => {
            const app = express();
            app[method]("/", (req, res) => {
              res.send("kajdslfkasdf");
            });
            await request(app)
              [method]("/")
              .expect("ETag", 'W/"c-IgR/L5SF7CJQff4wxKGF/vfPuZ0"')
              .expect(200);
          },
        );
      });
      it("should send ETag for empty string response", async () => {
        const app = express();
        app.use((req, res) => {
          res.send("");
        });
        app.enable("etag");
        await request(app)
          .get("/")
          .expect("ETag", 'W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"')
          .expect(200);
      });
      it("should send ETag for long response", async () => {
        const app = express();
        app.use((req, res) => {
          const str = Array(1000).join("-");
          res.send(str);
        });
        app.enable("etag");
        await request(app)
          .get("/")
          .expect("ETag", 'W/"3e7-qPnkJ3CVdVhFJQvUBfF10TmVA7g"')
          .expect(200);
      });
      it("should not override ETag when manually set", async () => {
        const app = express();
        app.use((req, res) => {
          res.set("etag", '"asdf"');
          res.send("hello!");
        });
        app.enable("etag");
        await request(app).get("/").expect("ETag", '"asdf"').expect(200);
      });
      it("should not send ETag for res.send()", async () => {
        const app = express();
        app.use((req, res) => {
          res.send();
        });
        app.enable("etag");
        await request(app)
          .get("/")
          .expect(utils.shouldNotHaveHeader("ETag"))
          .expect(200);
      });
    });
    describe("when disabled", () => {
      it("should send no ETag", async () => {
        const app = express();
        app.use((req, res) => {
          const str = Array(1000).join("-");
          res.send(str);
        });
        app.disable("etag");
        await request(app)
          .get("/")
          .expect(utils.shouldNotHaveHeader("ETag"))
          .expect(200);
      });
      it("should send ETag when manually set", async () => {
        const app = express();
        app.disable("etag");
        app.use((req, res) => {
          res.set("etag", '"asdf"');
          res.send("hello!");
        });
        await request(app).get("/").expect("ETag", '"asdf"').expect(200);
      });
    });
    describe('when "strong"', () => {
      it("should send strong ETag", async () => {
        const app = express();
        app.set("etag", "strong");
        app.use((req, res) => {
          res.send("hello, world!");
        });
        await request(app)
          .get("/")
          .expect("ETag", '"d-HwnTDHB9U/PRbFMN1z1wps51lqk"')
          .expect(200);
      });
    });
    describe('when "weak"', () => {
      it("should send weak ETag", async () => {
        const app = express();
        app.set("etag", "weak");
        app.use((req, res) => {
          res.send("hello, world!");
        });
        await request(app)
          .get("/")
          .expect("ETag", 'W/"d-HwnTDHB9U/PRbFMN1z1wps51lqk"')
          .expect(200);
      });
    });
    describe("when a function", () => {
      it("should send custom ETag", async () => {
        const app = express();
        app.set("etag", (body, encoding) => {
          const chunk = !Buffer.isBuffer(body)
            ? Buffer.from(body, encoding)
            : body;
          assert.strictEqual(chunk.toString(), "hello, world!");
          return '"custom"';
        });
        app.use((req, res) => {
          res.send("hello, world!");
        });
        await request(app).get("/").expect("ETag", '"custom"').expect(200);
      });
      it("should not send falsy ETag", async () => {
        const app = express();
        app.set("etag", (body, encoding) => {
          return undefined;
        });
        app.use((req, res) => {
          res.send("hello, world!");
        });
        await request(app)
          .get("/")
          .expect(utils.shouldNotHaveHeader("ETag"))
          .expect(200);
      });
    });
  });
});
