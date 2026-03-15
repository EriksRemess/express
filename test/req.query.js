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

      it("should parse parameters with dots", async () => {
        const app = createApp("extended");

        await request(app)
          .get("/?user.name=tj")
          .expect(200, '{"user.name":"tj"}');
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
