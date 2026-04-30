"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".query", () => {
    it("should default to {}", async () => {
      const app = createApp();

      await request(app).get("/").expect(200, "{}");
    });

    it("should default to parse simple keys", async () => {
      const app = createApp();

      await request(app)
        .get("/?user[name]=tj")
        .expect(200, '{"user[name]":"tj"}');
    });

    describe('when "query parser" is extended', () => {
      it("should parse complex keys", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?foo[0][bar]=baz&foo[0][fizz]=buzz&foo[]=done!")
          .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"},"done!"]}');
      });

      it("should preserve values when array notation later becomes object notation", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?foo[]=done!&foo[bar]=baz")
          .expect(200, '{"foo":{"0":"done!","bar":"baz"}}');
      });

      it("should compact sparse indexed arrays", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?foo[1]=bar&foo[3]=baz")
          .expect(200, '{"foo":["bar","baz"]}');
      });

      it("should parse malformed bracket notation consistently", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?foo%5B%5Bbar%5D=baz")
          .expect(200, '{"foo[":{"bar":"baz"}}');
      });

      it("should parse parameters with dots", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?user.name=tj")
          .expect(200, '{"user.name":"tj"}');
      });

      it("should not overflow the stack on deeply nested input", async () => {
        const app = express();
        let key = "a";

        app.set("query parser", "extended");
        app.use((req, res) => {
          void req.query;
          res.send("ok");
        });

        for (let i = 0; i < 5000; i++) {
          key += "[a]";
        }

        await request(app)
          .get(`/?${key}=1`)
          .expect(200, "ok");
      });

      it("should preserve deeply nested structures without truncation", async () => {
        const app = express();
        let key = "a";
        const expectedDepth = 100;

        app.set("query parser", "extended");
        app.use((req, res) => {
          let current = req.query;
          let depth = 0;

          while (current && typeof current === "object" && current.a !== undefined) {
            current = current.a;
            depth++;
          }

          res.send(String(depth));
        });

        for (let i = 0; i < expectedDepth; i++) {
          key += "[a]";
        }

        await request(app)
          .get(`/?${key}=1`)
          .expect(200, String(expectedDepth + 1));
      });
    });

    describe('when "query parser" is simple', () => {
      it("should not parse complex keys", async () => {
        const app = createApp("simple");

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"user[name]":"tj"}');
      });

      it("should preserve repeated keys as arrays", async () => {
        const app = createApp("simple");

        await request(app)
          .get("/?color=black&color=yellow")
          .expect(200, '{"color":["black","yellow"]}');
      });

      it('should decode "+" as a space', async () => {
        const app = createApp("simple");

        await request(app)
          .get("/?full+name=tj+holowaychuk")
          .expect(200, '{"full name":"tj holowaychuk"}');
      });

      it("should ignore empty pairs from dangling separators", async () => {
        const app = createApp("simple");

        await request(app)
          .get("/?&&color=black&&")
          .expect(200, '{"color":"black"}');
      });

      it("should ignore unsafe prototype keys", async () => {
        const app = express();

        app.set("query parser", "simple");
        app.use((req, res) => {
          const merged = Object.assign({}, req.query);

          res.send({
            keys: Object.keys(req.query).sort(),
            polluted: {}.polluted,
            prototype: Object.getPrototypeOf(merged) === Object.prototype,
          });
        });

        await request(app)
          .get("/?__proto__=polluted&__proto__=again&constructor=bad&prototype=bad&safe=value")
          .expect(200, '{"keys":["safe"],"prototype":true}');
      });
    });

    describe('when "query parser" is a function', () => {
      it("should parse using function", async () => {
        const app = createApp(str => {
          return { length: (str || "").length };
        });

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"length":17}');
      });
    });

    describe('when "query parser" disabled', () => {
      it("should not parse query", async () => {
        const app = createApp(false);

        await request(app).get("/?user%5Bname%5D=tj").expect(200, "{}");
      });
    });

    describe('when "query parser" enabled', () => {
      it("should not parse complex keys", async () => {
        const app = createApp(true);

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"user[name]":"tj"}');
      });
    });

    describe('when "query parser" an unknown value', () => {
      it("should throw", () => {
        assert.throws(
          createApp.bind(null, "bogus"),
          /unknown value.*query parser/,
        );
      });
    });
  });
});

function createApp(setting) {
  const app = express();

  if (setting !== undefined) {
    app.set("query parser", setting);
  }

  app.use((req, res) => {
    res.send(req.query);
  });

  return app;
}
