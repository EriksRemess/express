"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("res", function () {
  describe(".locals", function () {
    it("should be empty by default", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(res.locals);
      });

      await request(app).get("/").expect(200, {});
    });
  });

  it("should work when mounted", async function () {
    var app = express();
    var blog = express();

    app.use(blog);

    blog.use(function (req, res, next) {
      res.locals.foo = "bar";
      next();
    });

    app.use(function (req, res) {
      res.json(res.locals);
    });

    await request(app).get("/").expect(200, { foo: "bar" });
  });
});
