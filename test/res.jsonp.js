"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest"),
  assert = require("node:assert");
var utils = require("./support/utils");

describe("res", function () {
  describe(".jsonp(object)", function () {
    it("should respond with jsonp", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?callback=something")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /something\(\{"count":1\}\);/);
    });

    it("should use first callback parameter with jsonp", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?callback=something&callback=somethingelse")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /something\(\{"count":1\}\);/);
    });

    it("should ignore object callback parameter with jsonp", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?callback[a]=something")
        .expect("Content-Type", "application/json; charset=utf-8")
        .expect(200, '{"count":1}');
    });

    it("should allow renaming callback", async function () {
      var app = express();

      app.set("jsonp callback name", "clb");

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?clb=something")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /something\(\{"count":1\}\);/);
    });

    it("should allow []", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?callback=callbacks[123]")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /callbacks\[123\]\(\{"count":1\}\);/);
    });

    it("should disallow arbitrary js", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({});
      });

      await request(app)
        .get("/?callback=foo;bar()")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /foobar\(\{\}\);/);
    });

    it("should escape utf whitespace", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ str: "\u2028 \u2029 woot" });
      });

      await request(app)
        .get("/?callback=foo")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect(200, /foo\(\{"str":"\\u2028 \\u2029 woot"\}\);/);
    });

    it("should not escape utf whitespace for json fallback", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ str: "\u2028 \u2029 woot" });
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "application/json; charset=utf-8")
        .expect(200, '{"str":"\u2028 \u2029 woot"}');
    });

    it("should include security header and prologue", async function () {
      var app = express();

      app.use(function (req, res) {
        res.jsonp({ count: 1 });
      });

      await request(app)
        .get("/?callback=something")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect("X-Content-Type-Options", "nosniff")
        .expect(200, /^\/\*\*\//);
    });

    it("should not override previous Content-Types with no callback", async function () {
      var app = express();

      app.get("/", function (req, res) {
        res.type("application/vnd.example+json");
        res.jsonp({ hello: "world" });
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "application/vnd.example+json; charset=utf-8")
        .expect(utils.shouldNotHaveHeader("X-Content-Type-Options"))
        .expect(200, '{"hello":"world"}');
    });

    it("should override previous Content-Types with callback", async function () {
      var app = express();

      app.get("/", function (req, res) {
        res.type("application/vnd.example+json");
        res.jsonp({ hello: "world" });
      });

      await request(app)
        .get("/?callback=cb")
        .expect("Content-Type", "text/javascript; charset=utf-8")
        .expect("X-Content-Type-Options", "nosniff")
        .expect(200, /cb\(\{"hello":"world"\}\);$/);
    });

    describe("when given undefined", function () {
      it("should invoke callback with no arguments", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp(undefined);
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(\)/);
      });
    });

    describe("when given null", function () {
      it("should invoke callback with null", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp(null);
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(null\)/);
      });
    });

    describe("when given a string", function () {
      it("should invoke callback with a string", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp("tobi");
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\("tobi"\)/);
      });
    });

    describe("when given a number", function () {
      it("should invoke callback with a number", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp(42);
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(42\)/);
      });
    });

    describe("when given an array", function () {
      it("should invoke callback with an array", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp(["foo", "bar", "baz"]);
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(\["foo","bar","baz"\]\)/);
      });
    });

    describe("when given an object", function () {
      it("should invoke callback with an object", async function () {
        var app = express();

        app.use(function (req, res) {
          res.jsonp({ name: "tobi" });
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(\{"name":"tobi"\}\)/);
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
          res.jsonp({ "&": "\u2028<script>\u2029" });
        });

        await request(app)
          .get("/?callback=foo")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(
            200,
            /foo\({"\\u0026":"\\u2028\\u003cscript\\u003e\\u2029"}\)/,
          );
      });

      it("should not break undefined escape", async function () {
        var app = express();

        app.enable("json escape");

        app.use(function (req, res) {
          res.jsonp(undefined);
        });

        await request(app)
          .get("/?callback=cb")
          .expect("Content-Type", "text/javascript; charset=utf-8")
          .expect(200, /cb\(\)/);
      });
    });

    describe('"json replacer" setting', function () {
      it("should be passed to JSON.stringify()", async function () {
        var app = express();

        app.set("json replacer", function (key, val) {
          return key[0] === "_" ? undefined : val;
        });

        app.use(function (req, res) {
          res.jsonp({ name: "tobi", _id: 12345 });
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
          res.jsonp({ name: "tobi", age: 2 });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{\n  "name": "tobi",\n  "age": 2\n}');
      });
    });
  });
});
