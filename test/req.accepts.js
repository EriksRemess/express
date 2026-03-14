"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".accepts(type)", function () {
    it("should return true when Accept is not present", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts("json") ? "yes" : "no");
      });

      await request(app).get("/").expect("yes");
    });

    it("should return true when present", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts("json") ? "yes" : "no");
      });

      await request(app)
        .get("/")
        .set("Accept", "application/json")
        .expect("yes");
    });

    it("should return false otherwise", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts("json") ? "yes" : "no");
      });

      await request(app).get("/").set("Accept", "text/html").expect("no");
    });
  });

  it("should accept an argument list of type names", async function () {
    var app = express();

    app.use(function (req, res, next) {
      res.end(req.accepts("json", "html"));
    });

    await request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("json");
  });

  describe(".accepts(types)", function () {
    it("should return the first when Accept is not present", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts(["json", "html"]));
      });

      await request(app).get("/").expect("json");
    });

    it("should return the first acceptable type", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts(["json", "html"]));
      });

      await request(app).get("/").set("Accept", "text/html").expect("html");
    });

    it("should return false when no match is made", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(
          req.accepts(["text/html", "application/json"]) ? "yup" : "nope",
        );
      });

      await request(app)
        .get("/")
        .set("Accept", "foo/bar, bar/baz")
        .expect("nope");
    });

    it("should take quality into account", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts(["text/html", "application/json"]));
      });

      await request(app)
        .get("/")
        .set("Accept", "*/html; q=.5, application/json")
        .expect("application/json");
    });

    it("should return the first acceptable type with canonical mime types", async function () {
      var app = express();

      app.use(function (req, res, next) {
        res.end(req.accepts(["application/json", "text/html"]));
      });

      await request(app).get("/").set("Accept", "*/html").expect("text/html");
    });
  });
});
