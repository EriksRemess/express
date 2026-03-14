"use strict";
var { describe, it } = require("node:test");
var assert = require("node:assert");
var express = require("../"),
  request = require("supertest");

describe("app", function () {
  describe(".VERB()", function () {
    it("should not get invoked without error handler on error", async function () {
      var app = express();

      app.use(function (req, res, next) {
        next(new Error("boom!"));
      });

      app.get("/bar", function (req, res) {
        res.send("hello, world!");
      });

      await request(app)
        .post("/bar")
        .expect(500, /Error: boom!/);
    });

    it("should only call an error handling routing callback when an error is propagated", async function () {
      var app = express();

      var a = false;
      var b = false;
      var c = false;
      var d = false;

      app.get(
        "/",
        function (req, res, next) {
          next(new Error("fabricated error"));
        },
        function (req, res, next) {
          a = true;
          next();
        },
        function (err, req, res, next) {
          b = true;
          assert.strictEqual(err.message, "fabricated error");
          next(err);
        },
        function (err, req, res, next) {
          c = true;
          assert.strictEqual(err.message, "fabricated error");
          next();
        },
        function (err, req, res, next) {
          d = true;
          next();
        },
        function (req, res) {
          assert.ok(!a);
          assert.ok(b);
          assert.ok(c);
          assert.ok(!d);
          res.sendStatus(204);
        },
      );

      await request(app).get("/").expect(204);
    });
  });
});
