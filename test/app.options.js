"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("OPTIONS", function () {
  it("should default to the routes defined", async function () {
    var app = express();

    app.post("/", function () {});
    app.get("/users", function (req, res) {});
    app.put("/users", function (req, res) {});

    await request(app)
      .options("/users")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should only include each method once", async function () {
    var app = express();

    app.delete("/", function () {});
    app.get("/users", function (req, res) {});
    app.put("/users", function (req, res) {});
    app.get("/users", function (req, res) {});

    await request(app)
      .options("/users")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should not be affected by app.all", async function () {
    var app = express();

    app.get("/", function () {});
    app.get("/users", function (req, res) {});
    app.put("/users", function (req, res) {});
    app.all("/users", function (req, res, next) {
      res.setHeader("x-hit", "1");
      next();
    });

    await request(app)
      .options("/users")
      .expect("x-hit", "1")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should not respond if the path is not defined", async function () {
    var app = express();

    app.get("/users", function (req, res) {});

    await request(app).options("/other").expect(404);
  });

  it("should forward requests down the middleware chain", async function () {
    var app = express();
    var router = new express.Router();

    router.get("/users", function (req, res) {});
    app.use(router);
    app.get("/other", function (req, res) {});

    await request(app)
      .options("/other")
      .expect("Allow", "GET, HEAD")
      .expect(200, "GET, HEAD");
  });

  describe("when error occurs in response handler", function () {
    it("should pass error to callback", async function () {
      var app = express();
      var router = express.Router();

      router.get("/users", function (req, res) {});

      app.use(function (req, res, next) {
        res.writeHead(200);
        next();
      });
      app.use(router);
      app.use(function (err, req, res, next) {
        res.end("true");
      });

      await request(app).options("/users").expect(200, "true");
    });
  });
});

describe("app.options()", function () {
  it("should override the default behavior", async function () {
    var app = express();

    app.options("/users", function (req, res) {
      res.set("Allow", "GET");
      res.send("GET");
    });

    app.get("/users", function (req, res) {});
    app.put("/users", function (req, res) {});

    await request(app).options("/users").expect("GET").expect("Allow", "GET");
  });
});
