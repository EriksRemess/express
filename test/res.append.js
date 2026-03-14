"use strict";

var { describe, it } = require("node:test");
var assert = require("node:assert");
var express = require("..");
var request = require("supertest");
describe("res", function () {
  describe(".append(field, val)", function () {
    it("should append multiple headers", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.append("Set-Cookie", "foo=bar");
        next();
      });
      app.use(function (req, res) {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should accept array of values", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.append("Set-Cookie", ["foo=bar", "fizz=buzz"]);
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should get reset by res.set(field, val)", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.append("Set-Cookie", "foo=bar");
        res.append("Set-Cookie", "fizz=buzz");
        next();
      });
      app.use(function (req, res) {
        res.set("Set-Cookie", "pet=tobi");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["pet=tobi"]));
    });
    it("should work with res.set(field, val) first", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.set("Set-Cookie", "foo=bar");
        next();
      });
      app.use(function (req, res) {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should work together with res.cookie", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.cookie("foo", "bar");
        next();
      });
      app.use(function (req, res) {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(
          shouldHaveHeaderValues("Set-Cookie", [
            "foo=bar; Path=/",
            "fizz=buzz",
          ]),
        );
    });
  });
});
function shouldHaveHeaderValues(key, values) {
  return function (res) {
    var headers = res.headers[key.toLowerCase()];
    assert.ok(headers, 'should have header "' + key + '"');
    assert.strictEqual(
      headers.length,
      values.length,
      "should have " + values.length + ' occurrences of "' + key + '"',
    );
    for (var i = 0; i < values.length; i++) {
      assert.strictEqual(headers[i], values[i]);
    }
  };
}
