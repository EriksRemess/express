"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("res", function () {
  describe(".clearCookie(name)", function () {
    it("should set a cookie passed expiry", async function () {
      var app = express();

      app.use(function (req, res) {
        res.clearCookie("sid").end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });
  });

  describe(".clearCookie(name, options)", function () {
    it("should set the given params", async function () {
      var app = express();

      app.use(function (req, res) {
        res.clearCookie("sid", { path: "/admin" }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });

    it("should ignore maxAge", async function () {
      var app = express();

      app.use(function (req, res) {
        res.clearCookie("sid", { path: "/admin", maxAge: 1000 }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });

    it("should ignore user supplied expires param", async function () {
      var app = express();

      app.use(function (req, res) {
        res.clearCookie("sid", { path: "/admin", expires: new Date() }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });
  });
});
