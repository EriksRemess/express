"use strict";
var { describe, it } = require("node:test");
var express = require("../");
var request = require("supertest");

describe("app.route", function () {
  it("should return a new route", async function () {
    var app = express();

    app
      .route("/foo")
      .get(function (req, res) {
        res.send("get");
      })
      .post(function (req, res) {
        res.send("post");
      });

    await request(app).post("/foo").expect("post");
  });

  it("should all .VERB after .all", async function () {
    var app = express();

    app
      .route("/foo")
      .all(function (req, res, next) {
        next();
      })
      .get(function (req, res) {
        res.send("get");
      })
      .post(function (req, res) {
        res.send("post");
      });

    await request(app).post("/foo").expect("post");
  });

  it("should support dynamic routes", async function () {
    var app = express();

    app.route("/:foo").get(function (req, res) {
      res.send(req.params.foo);
    });

    await request(app).get("/test").expect("test");
  });

  it("should not error on empty routes", async function () {
    var app = express();

    app.route("/:foo");

    await request(app).get("/test").expect(404);
  });

  describe("promise support", function () {
    it("should pass rejected promise value", async function () {
      var app = express();
      var route = app.route("/foo");

      route.all(function createError(req, res, next) {
        return Promise.reject(new Error("boom!"));
      });

      route.all(function helloWorld(req, res) {
        res.send("hello, world!");
      });

      route.all(function handleError(err, req, res, next) {
        res.status(500);
        res.send("caught: " + err.message);
      });

      await request(app).get("/foo").expect(500, "caught: boom!");
    });

    it("should pass rejected promise without value", async function () {
      var app = express();
      var route = app.route("/foo");

      route.all(function createError(req, res, next) {
        return Promise.reject();
      });

      route.all(function helloWorld(req, res) {
        res.send("hello, world!");
      });

      route.all(function handleError(err, req, res, next) {
        res.status(500);
        res.send("caught: " + err.message);
      });

      await request(app).get("/foo").expect(500, "caught: Rejected promise");
    });

    it("should ignore resolved promise", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var route = app.route("/foo");

        route.all(function createError(req, res, next) {
          res.send("saw GET /foo");
          return Promise.resolve("foo");
        });

        route.all(function () {
          reject(new Error("Unexpected route invoke"));
        });

        request(app)
          .get("/foo")
          .expect(200, "saw GET /foo", (err) => {
            if (err != null) {
              reject(err);
              return;
            }
            resolve();
          });
      });
    });

    describe("error handling", function () {
      it("should pass rejected promise value", async function () {
        var app = express();
        var route = app.route("/foo");

        route.all(function createError(req, res, next) {
          return Promise.reject(new Error("boom!"));
        });

        route.all(function handleError(err, req, res, next) {
          return Promise.reject(new Error("caught: " + err.message));
        });

        route.all(function handleError(err, req, res, next) {
          res.status(500);
          res.send("caught again: " + err.message);
        });

        await request(app)
          .get("/foo")
          .expect(500, "caught again: caught: boom!");
      });

      it("should pass rejected promise without value", async function () {
        var app = express();
        var route = app.route("/foo");

        route.all(function createError(req, res, next) {
          return Promise.reject(new Error("boom!"));
        });

        route.all(function handleError(err, req, res, next) {
          return Promise.reject();
        });

        route.all(function handleError(err, req, res, next) {
          res.status(500);
          res.send("caught again: " + err.message);
        });

        await request(app)
          .get("/foo")
          .expect(500, "caught again: Rejected promise");
      });

      it("should ignore resolved promise", async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var route = app.route("/foo");

          route.all(function createError(req, res, next) {
            return Promise.reject(new Error("boom!"));
          });

          route.all(function handleError(err, req, res, next) {
            res.status(500);
            res.send("caught: " + err.message);
            return Promise.resolve("foo");
          });

          route.all(function () {
            reject(new Error("Unexpected route invoke"));
          });

          request(app)
            .get("/foo")
            .expect(500, "caught: boom!", (err) => {
              if (err != null) {
                reject(err);
                return;
              }
              resolve();
            });
        });
      });
    });
  });
});
