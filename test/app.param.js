"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("app", function () {
  describe(".param(names, fn)", function () {
    it("should map the array", async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        app.param(["id", "uid"], function (req, res, next, id) {
          id = Number(id);
          if (isNaN(id)) return next("route");
          req.params.id = id;
          next();
        });

        app.get("/post/:id", function (req, res) {
          var id = req.params.id;
          res.send(typeof id + ":" + id);
        });

        app.get("/user/:uid", function (req, res) {
          var id = req.params.id;
          res.send(typeof id + ":" + id);
        });

        request(app)
          .get("/user/123")
          .expect(200, "number:123", function (err) {
            if (err) return reject(err);
            request(app)
              .get("/post/123")
              .expect("number:123", (err) => {
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

  describe(".param(name, fn)", function () {
    it("should map logic for a single param", async function () {
      var app = express();

      app.param("id", function (req, res, next, id) {
        id = Number(id);
        if (isNaN(id)) return next("route");
        req.params.id = id;
        next();
      });

      app.get("/user/:id", function (req, res) {
        var id = req.params.id;
        res.send(typeof id + ":" + id);
      });

      await request(app).get("/user/123").expect(200, "number:123");
    });

    it("should only call once per request", async function () {
      var app = express();
      var called = 0;
      var count = 0;

      app.param("user", function (req, res, next, user) {
        called++;
        req.user = user;
        next();
      });

      app.get("/foo/:user", function (req, res, next) {
        count++;
        next();
      });
      app.get("/foo/:user", function (req, res, next) {
        count++;
        next();
      });
      app.use(function (req, res) {
        res.end([count, called, req.user].join(" "));
      });

      await request(app).get("/foo/bob").expect("2 1 bob");
    });

    it("should call when values differ", async function () {
      var app = express();
      var called = 0;
      var count = 0;

      app.param("user", function (req, res, next, user) {
        called++;
        req.users = (req.users || []).concat(user);
        next();
      });

      app.get("/:user/bob", function (req, res, next) {
        count++;
        next();
      });
      app.get("/foo/:user", function (req, res, next) {
        count++;
        next();
      });
      app.use(function (req, res) {
        res.end([count, called, req.users.join(",")].join(" "));
      });

      await request(app).get("/foo/bob").expect("2 2 foo,bob");
    });

    it("should support altering req.params across routes", async function () {
      var app = express();

      app.param("user", function (req, res, next, user) {
        req.params.user = "loki";
        next();
      });

      app.get("/:user", function (req, res, next) {
        next("route");
      });
      app.get("/:user", function (req, res) {
        res.send(req.params.user);
      });

      await request(app).get("/bob").expect("loki");
    });

    it("should not invoke without route handler", async function () {
      var app = express();

      app.param("thing", function (req, res, next, thing) {
        req.thing = thing;
        next();
      });

      app.param("user", function (req, res, next, user) {
        next(new Error("invalid invocation"));
      });

      app.post("/:user", function (req, res) {
        res.send(req.params.user);
      });

      app.get("/:thing", function (req, res) {
        res.send(req.thing);
      });

      await request(app).get("/bob").expect(200, "bob");
    });

    it("should work with encoded values", async function () {
      var app = express();

      app.param("name", function (req, res, next, name) {
        req.params.name = name;
        next();
      });

      app.get("/user/:name", function (req, res) {
        var name = req.params.name;
        res.send("" + name);
      });

      await request(app).get("/user/foo%25bar").expect("foo%bar");
    });

    it("should catch thrown error", async function () {
      var app = express();

      app.param("id", function (req, res, next, id) {
        throw new Error("err!");
      });

      app.get("/user/:id", function (req, res) {
        var id = req.params.id;
        res.send("" + id);
      });

      await request(app).get("/user/123").expect(500);
    });

    it("should catch thrown secondary error", async function () {
      var app = express();

      app.param("id", function (req, res, next, val) {
        process.nextTick(next);
      });

      app.param("id", function (req, res, next, id) {
        throw new Error("err!");
      });

      app.get("/user/:id", function (req, res) {
        var id = req.params.id;
        res.send("" + id);
      });

      await request(app).get("/user/123").expect(500);
    });

    it("should defer to next route", async function () {
      var app = express();

      app.param("id", function (req, res, next, id) {
        next("route");
      });

      app.get("/user/:id", function (req, res) {
        var id = req.params.id;
        res.send("" + id);
      });

      app.get("/:name/123", function (req, res) {
        res.send("name");
      });

      await request(app).get("/user/123").expect("name");
    });

    it("should defer all the param routes", async function () {
      var app = express();

      app.param("id", function (req, res, next, val) {
        if (val === "new") return next("route");
        return next();
      });

      app.all("/user/:id", function (req, res) {
        res.send("all.id");
      });

      app.get("/user/:id", function (req, res) {
        res.send("get.id");
      });

      app.get("/user/new", function (req, res) {
        res.send("get.new");
      });

      await request(app).get("/user/new").expect("get.new");
    });

    it("should not call when values differ on error", async function () {
      var app = express();
      var called = 0;
      var count = 0;

      app.param("user", function (req, res, next, user) {
        called++;
        if (user === "foo") throw new Error("err!");
        req.user = user;
        next();
      });

      app.get("/:user/bob", function (req, res, next) {
        count++;
        next();
      });
      app.get("/foo/:user", function (req, res, next) {
        count++;
        next();
      });

      app.use(function (err, req, res, next) {
        res.status(500);
        res.send([count, called, err.message].join(" "));
      });

      await request(app).get("/foo/bob").expect(500, "0 1 err!");
    });

    it('should call when values differ when using "next"', async function () {
      var app = express();
      var called = 0;
      var count = 0;

      app.param("user", function (req, res, next, user) {
        called++;
        if (user === "foo") return next("route");
        req.user = user;
        next();
      });

      app.get("/:user/bob", function (req, res, next) {
        count++;
        next();
      });
      app.get("/foo/:user", function (req, res, next) {
        count++;
        next();
      });
      app.use(function (req, res) {
        res.end([count, called, req.user].join(" "));
      });

      await request(app).get("/foo/bob").expect("1 2 bob");
    });
  });
});
