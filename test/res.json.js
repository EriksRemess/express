"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest"),
  assert = require("node:assert");

describe("res", function () {
  describe(".json(object)", function () {
    it("should not support jsonp callbacks", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json({ foo: "bar" });
      });

      await request(app).get("/?callback=foo").expect('{"foo":"bar"}');
    });

    it("should not override previous Content-Types", async function () {
      var app = express();

      app.get("/", function (req, res) {
        res.type("application/vnd.example+json");
        res.json({ hello: "world" });
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "application/vnd.example+json; charset=utf-8")
        .expect(200, '{"hello":"world"}');
    });

    describe("when given primitives", function () {
      it("should respond with json for null", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json(null);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "null");
      });

      it("should respond with json for Number", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json(300);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "300");
      });

      it("should respond with json for String", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json("str");
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '"str"');
      });
    });

    describe("when given an array", function () {
      it("should respond with json", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json(["foo", "bar", "baz"]);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '["foo","bar","baz"]');
      });
    });

    describe("when given an object", function () {
      it("should respond with json", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json({ name: "tobi" });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"name":"tobi"}');
      });
    });

    describe('"json escape" setting', function () {
      it("should be undefined by default", function () {
        var app = express();
        assert.strictEqual(app.get("json escape"), undefined);
      });

      it("should unicode escape HTML-sniffing characters", async function () {
        var app = express();

        app.enable("json escape");

        app.use(function (req, res) {
          res.json({ "&": "<script>" });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"\\u0026":"\\u003cscript\\u003e"}');
      });

      it("should not break undefined escape", async function () {
        var app = express();

        app.enable("json escape");

        app.use(function (req, res) {
          res.json(undefined);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "");
      });
    });

    describe('"json replacer" setting', function () {
      it("should be passed to JSON.stringify()", async function () {
        var app = express();

        app.set("json replacer", function (key, val) {
          return key[0] === "_" ? undefined : val;
        });

        app.use(function (req, res) {
          res.json({ name: "tobi", _id: 12345 });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"name":"tobi"}');
      });
    });

    describe('"json spaces" setting', function () {
      it("should be undefined by default", function () {
        var app = express();
        assert(undefined === app.get("json spaces"));
      });

      it("should be passed to JSON.stringify()", async function () {
        var app = express();

        app.set("json spaces", 2);

        app.use(function (req, res) {
          res.json({ name: "tobi", age: 2 });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{\n  "name": "tobi",\n  "age": 2\n}');
      });
    });
  });
});
