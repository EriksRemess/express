"use strict";
var { describe, it } = require("node:test");
var assert = require("node:assert");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".query", function () {
    it("should default to {}", async function () {
      var app = createApp();

      await request(app).get("/").expect(200, "{}");
    });

    it("should default to parse simple keys", async function () {
      var app = createApp();

      await request(app)
        .get("/?user[name]=tj")
        .expect(200, '{"user[name]":"tj"}');
    });

    describe('when "query parser" is extended', function () {
      it("should parse complex keys", async function () {
        var app = createApp("extended");

        await request(app)
          .get("/?foo[0][bar]=baz&foo[0][fizz]=buzz&foo[]=done!")
          .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"},"done!"]}');
      });

      it("should parse parameters with dots", async function () {
        var app = createApp("extended");

        await request(app)
          .get("/?user.name=tj")
          .expect(200, '{"user.name":"tj"}');
      });
    });

    describe('when "query parser" is simple', function () {
      it("should not parse complex keys", async function () {
        var app = createApp("simple");

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"user[name]":"tj"}');
      });
    });

    describe('when "query parser" is a function', function () {
      it("should parse using function", async function () {
        var app = createApp(function (str) {
          return { length: (str || "").length };
        });

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"length":17}');
      });
    });

    describe('when "query parser" disabled', function () {
      it("should not parse query", async function () {
        var app = createApp(false);

        await request(app).get("/?user%5Bname%5D=tj").expect(200, "{}");
      });
    });

    describe('when "query parser" enabled', function () {
      it("should not parse complex keys", async function () {
        var app = createApp(true);

        await request(app)
          .get("/?user%5Bname%5D=tj")
          .expect(200, '{"user[name]":"tj"}');
      });
    });

    describe('when "query parser" an unknown value', function () {
      it("should throw", function () {
        assert.throws(
          createApp.bind(null, "bogus"),
          /unknown value.*query parser/,
        );
      });
    });
  });
});

function createApp(setting) {
  var app = express();

  if (setting !== undefined) {
    app.set("query parser", setting);
  }

  app.use(function (req, res) {
    res.send(req.query);
  });

  return app;
}
