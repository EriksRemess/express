"use strict";
var { describe, it } = require("node:test");
var after = require("after");
var express = require("../"),
  request = require("supertest"),
  assert = require("node:assert"),
  methods = require("../lib/utils").methods;
var shouldSkipQuery = require("./support/utils").shouldSkipQuery;

describe("app.router", function () {
  it("should restore req.params after leaving router", async function () {
    var app = express();
    var router = new express.Router();

    function handler1(req, res, next) {
      res.setHeader("x-user-id", String(req.params.id));
      next();
    }

    function handler2(req, res) {
      res.send(req.params.id);
    }

    router.use(function (req, res, next) {
      res.setHeader("x-router", String(req.params.id));
      next();
    });

    app.get("/user/:id", handler1, router, handler2);

    await request(app)
      .get("/user/1")
      .expect("x-router", "undefined")
      .expect("x-user-id", "1")
      .expect(200, "1");
  });

  describe("methods", function () {
    methods.forEach(function (method) {
      if (method === "connect") return;

      it(
        "should include " + method.toUpperCase(),
        { skip: method === "query" && shouldSkipQuery(process.versions.node) },
        async function () {
          var app = express();

          app[method]("/foo", function (req, res) {
            res.send(method);
          });

          await request(app)[method]("/foo").expect(200);
        },
      );

      it("should reject numbers for app." + method, function () {
        var app = express();
        assert.throws(
          app[method].bind(app, "/", 3),
          /argument handler must be a function/,
        );
      });
    });

    it("should re-route when method is altered", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(3, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use(function (req, res, next) {
          if (req.method !== "POST") return next();
          req.method = "DELETE";
          res.setHeader("X-Method-Altered", "1");
          next();
        });

        app.delete("/", function (req, res) {
          res.end("deleted everything");
        });

        request(app).get("/").expect(404, cb);

        request(app).delete("/").expect(200, "deleted everything", cb);

        request(app)
          .post("/")
          .expect("X-Method-Altered", "1")
          .expect(200, "deleted everything", cb);
      });
    });
  });

  describe("decode params", function () {
    it("should decode correct params", async function () {
      var app = express();

      app.get("/:name", function (req, res) {
        res.send(req.params.name);
      });

      await request(app).get("/foo%2Fbar").expect("foo/bar");
    });

    it("should not accept params in malformed paths", async function () {
      var app = express();

      app.get("/:name", function (req, res) {
        res.send(req.params.name);
      });

      await request(app).get("/%foobar").expect(400);
    });

    it("should not decode spaces", async function () {
      var app = express();

      app.get("/:name", function (req, res) {
        res.send(req.params.name);
      });

      await request(app).get("/foo+bar").expect("foo+bar");
    });

    it("should work with unicode", async function () {
      var app = express();

      app.get("/:name", function (req, res) {
        res.send(req.params.name);
      });

      await request(app).get("/%ce%b1").expect("\u03b1");
    });
  });

  it("should be .use()able", async function () {
    var app = express();

    var calls = [];

    app.use(function (req, res, next) {
      calls.push("before");
      next();
    });

    app.get("/", function (req, res, next) {
      calls.push("GET /");
      next();
    });

    app.use(function (req, res, next) {
      calls.push("after");
      res.json(calls);
    });

    await request(app).get("/").expect(200, ["before", "GET /", "after"]);
  });

  describe("when given a regexp", function () {
    it("should match the pathname only", async function () {
      var app = express();

      app.get(/^\/user\/[0-9]+$/, function (req, res) {
        res.end("user");
      });

      await request(app).get("/user/12?foo=bar").expect("user");
    });

    it("should populate req.params with the captures", async function () {
      var app = express();

      app.get(/^\/user\/([0-9]+)\/(view|edit)?$/, function (req, res) {
        var id = req.params[0],
          op = req.params[1];
        res.end(op + "ing user " + id);
      });

      await request(app).get("/user/10/edit").expect("editing user 10");
    });

    if (supportsRegexp("(?<foo>.*)")) {
      it("should populate req.params with named captures", async function () {
        var app = express();
        var re = new RegExp("^/user/(?<userId>[0-9]+)/(view|edit)?$");

        app.get(re, function (req, res) {
          var id = req.params.userId,
            op = req.params[0];
          res.end(op + "ing user " + id);
        });

        await request(app).get("/user/10/edit").expect("editing user 10");
      });
    }

    it("should ensure regexp matches path prefix", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var p = [];

        app.use(/\/api.*/, function (req, res, next) {
          p.push("a");
          next();
        });
        app.use(/api/, function (req, res, next) {
          p.push("b");
          next();
        });
        app.use(/\/test/, function (req, res, next) {
          p.push("c");
          next();
        });
        app.use(function (req, res) {
          res.end();
        });

        request(app)
          .get("/test/api/1234")
          .expect(200, function (err) {
            if (err) return reject(err);
            assert.deepEqual(p, ["c"]);
            resolve();
          });
      });
    });
  });

  describe("case sensitivity", function () {
    it("should be disabled by default", async function () {
      var app = express();

      app.get("/user", function (req, res) {
        res.end("tj");
      });

      await request(app).get("/USER").expect("tj");
    });

    describe('when "case sensitive routing" is enabled', function () {
      it("should match identical casing", async function () {
        var app = express();

        app.enable("case sensitive routing");

        app.get("/uSer", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/uSer").expect("tj");
      });

      it("should not match otherwise", async function () {
        var app = express();

        app.enable("case sensitive routing");

        app.get("/uSer", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user").expect(404);
      });
    });
  });

  describe("params", function () {
    it("should overwrite existing req.params by default", async function () {
      var app = express();
      var router = new express.Router();

      router.get("/:action", function (req, res) {
        res.send(req.params);
      });

      app.use("/user/:user", router);

      await request(app).get("/user/1/get").expect(200, '{"action":"get"}');
    });

    it("should allow merging existing req.params", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get("/:action", function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/:user", router);

      await request(app)
        .get("/user/tj/get")
        .expect(200, '[["action","get"],["user","tj"]]');
    });

    it("should use params from router", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get("/:thing", function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/:thing", router);

      await request(app).get("/user/tj/get").expect(200, '[["thing","get"]]');
    });

    it("should merge numeric indices req.params", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get(/^\/(.*)\.(.*)/, function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/^\/user\/id:(\d+)/, router);

      await request(app)
        .get("/user/id:10/profile.json")
        .expect(200, '[["0","10"],["1","profile"],["2","json"]]');
    });

    it("should merge numeric indices req.params when more in parent", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get(/\/(.*)/, function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/^\/user\/id:(\d+)\/name:(\w+)/, router);

      await request(app)
        .get("/user/id:10/name:tj/profile")
        .expect(200, '[["0","10"],["1","tj"],["2","profile"]]');
    });

    it("should merge numeric indices req.params when parent has same number", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get(/\/name:(\w+)/, function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/\/user\/id:(\d+)/, router);

      await request(app)
        .get("/user/id:10/name:tj")
        .expect(200, '[["0","10"],["1","tj"]]');
    });

    it("should ignore invalid incoming req.params", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get("/:name", function (req, res) {
        var keys = Object.keys(req.params).sort();
        res.send(
          keys.map(function (k) {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/", function (req, res, next) {
        req.params = 3; // wat?
        router(req, res, next);
      });

      await request(app).get("/user/tj").expect(200, '[["name","tj"]]');
    });

    it("should restore req.params", async function () {
      var app = express();
      var router = new express.Router({ mergeParams: true });

      router.get(/\/user:(\w+)\//, function (req, res, next) {
        next();
      });

      app.use(/\/user\/id:(\d+)/, function (req, res, next) {
        router(req, res, function (err) {
          var keys = Object.keys(req.params).sort();
          res.send(
            keys.map(function (k) {
              return [k, req.params[k]];
            }),
          );
        });
      });

      await request(app)
        .get("/user/id:42/user:tj/profile")
        .expect(200, '[["0","42"]]');
    });
  });

  describe("trailing slashes", function () {
    it("should be optional by default", async function () {
      var app = express();

      app.get("/user", function (req, res) {
        res.end("tj");
      });

      await request(app).get("/user/").expect("tj");
    });

    describe('when "strict routing" is enabled', function () {
      it("should match trailing slashes", async function () {
        var app = express();

        app.enable("strict routing");

        app.get("/user/", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user/").expect("tj");
      });

      it("should pass-though middleware", async function () {
        var app = express();

        app.enable("strict routing");

        app.use(function (req, res, next) {
          res.setHeader("x-middleware", "true");
          next();
        });

        app.get("/user/", function (req, res) {
          res.end("tj");
        });

        await request(app)
          .get("/user/")
          .expect("x-middleware", "true")
          .expect(200, "tj");
      });

      it("should pass-though mounted middleware", async function () {
        var app = express();

        app.enable("strict routing");

        app.use("/user/", function (req, res, next) {
          res.setHeader("x-middleware", "true");
          next();
        });

        app.get("/user/test/", function (req, res) {
          res.end("tj");
        });

        await request(app)
          .get("/user/test/")
          .expect("x-middleware", "true")
          .expect(200, "tj");
      });

      it("should match no slashes", async function () {
        var app = express();

        app.enable("strict routing");

        app.get("/user", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user").expect("tj");
      });

      it("should match middleware when omitting the trailing slash", async function () {
        var app = express();

        app.enable("strict routing");

        app.use("/user/", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user").expect(200, "tj");
      });

      it("should match middleware", async function () {
        var app = express();

        app.enable("strict routing");

        app.use("/user", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user").expect(200, "tj");
      });

      it("should match middleware when adding the trailing slash", async function () {
        var app = express();

        app.enable("strict routing");

        app.use("/user", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user/").expect(200, "tj");
      });

      it("should fail when omitting the trailing slash", async function () {
        var app = express();

        app.enable("strict routing");

        app.get("/user/", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user").expect(404);
      });

      it("should fail when adding the trailing slash", async function () {
        var app = express();

        app.enable("strict routing");

        app.get("/user", function (req, res) {
          res.end("tj");
        });

        await request(app).get("/user/").expect(404);
      });
    });
  });

  it('should allow literal "."', async function () {
    var app = express();

    app.get("/api/users/:from..:to", function (req, res) {
      var from = req.params.from,
        to = req.params.to;

      res.end("users from " + from + " to " + to);
    });

    await request(app).get("/api/users/1..50").expect("users from 1 to 50");
  });

  describe(":name", function () {
    it("should denote a capture group", async function () {
      var app = express();

      app.get("/user/:user", function (req, res) {
        res.end(req.params.user);
      });

      await request(app).get("/user/tj").expect("tj");
    });

    it("should match a single segment only", async function () {
      var app = express();

      app.get("/user/:user", function (req, res) {
        res.end(req.params.user);
      });

      await request(app).get("/user/tj/edit").expect(404);
    });

    it("should allow several capture groups", async function () {
      var app = express();

      app.get("/user/:user/:op", function (req, res) {
        res.end(req.params.op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj/edit").expect("editing tj");
    });

    it("should work following a partial capture group", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/user{s}/:user/:op", function (req, res) {
          res.end(
            req.params.op +
              "ing " +
              req.params.user +
              (req.url.startsWith("/users") ? " (old)" : ""),
          );
        });

        request(app).get("/user/tj/edit").expect("editing tj", cb);

        request(app).get("/users/tj/edit").expect("editing tj (old)", cb);
      });
    });

    it("should work inside literal parenthesis", async function () {
      var app = express();

      app.get("/:user\\(:op\\)", function (req, res) {
        res.end(req.params.op + "ing " + req.params.user);
      });

      await request(app).get("/tj(edit)").expect("editing tj");
    });

    it("should work in array of paths", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get(["/user/:user/poke", "/user/:user/pokes"], function (req, res) {
          res.end("poking " + req.params.user);
        });

        request(app).get("/user/tj/poke").expect("poking tj", cb);

        request(app).get("/user/tj/pokes").expect("poking tj", cb);
      });
    });
  });

  describe(":name?", function () {
    it("should denote an optional capture group", async function () {
      var app = express();

      app.get("/user/:user{/:op}", function (req, res) {
        var op = req.params.op || "view";
        res.end(op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj").expect("viewing tj");
    });

    it("should populate the capture group", async function () {
      var app = express();

      app.get("/user/:user{/:op}", function (req, res) {
        var op = req.params.op || "view";
        res.end(op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj/edit").expect("editing tj");
    });
  });

  describe(":name*", function () {
    it("should match one segment", async function () {
      var app = express();

      app.get("/user/*user", function (req, res) {
        res.end(req.params.user[0]);
      });

      await request(app).get("/user/122").expect("122");
    });

    it("should match many segments", async function () {
      var app = express();

      app.get("/user/*user", function (req, res) {
        res.end(req.params.user.join("/"));
      });

      await request(app).get("/user/1/2/3/4").expect("1/2/3/4");
    });

    it("should match zero segments", async function () {
      var app = express();

      app.get("/user{/*user}", function (req, res) {
        res.end(req.params.user);
      });

      await request(app).get("/user").expect("");
    });
  });

  describe(":name+", function () {
    it("should match one segment", async function () {
      var app = express();

      app.get("/user/*user", function (req, res) {
        res.end(req.params.user[0]);
      });

      await request(app).get("/user/122").expect(200, "122");
    });

    it("should match many segments", async function () {
      var app = express();

      app.get("/user/*user", function (req, res) {
        res.end(req.params.user.join("/"));
      });

      await request(app).get("/user/1/2/3/4").expect(200, "1/2/3/4");
    });

    it("should not match zero segments", async function () {
      var app = express();

      app.get("/user/*user", function (req, res) {
        res.end(req.params.user);
      });

      await request(app).get("/user").expect(404);
    });
  });

  describe(".:name", function () {
    it("should denote a format", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/:name.:format", function (req, res) {
          res.end(req.params.name + " as " + req.params.format);
        });

        request(app).get("/foo.json").expect(200, "foo as json", cb);

        request(app).get("/foo").expect(404, cb);
      });
    });
  });

  describe(".:name?", function () {
    it("should denote an optional format", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/:name{.:format}", function (req, res) {
          res.end(req.params.name + " as " + (req.params.format || "html"));
        });

        request(app).get("/foo").expect(200, "foo as html", cb);

        request(app).get("/foo.json").expect(200, "foo as json", cb);
      });
    });
  });

  describe("when next() is called", function () {
    it("should continue lookup", async function () {
      var app = express(),
        calls = [];

      app.get("/foo{/:bar}", function (req, res, next) {
        calls.push("/foo/:bar?");
        next();
      });

      app.get("/bar", function () {
        assert(0);
      });

      app.get("/foo", function (req, res, next) {
        calls.push("/foo");
        next();
      });

      app.get("/foo", function (req, res) {
        calls.push("/foo 2");
        res.json(calls);
      });

      await request(app)
        .get("/foo")
        .expect(200, ["/foo/:bar?", "/foo", "/foo 2"]);
    });
  });

  describe('when next("route") is called', function () {
    it("should jump to next route", async function () {
      var app = express();

      function fn(req, res, next) {
        res.set("X-Hit", "1");
        next("route");
      }

      app.get("/foo", fn, function (req, res) {
        res.end("failure");
      });

      app.get("/foo", function (req, res) {
        res.end("success");
      });

      await request(app)
        .get("/foo")
        .expect("X-Hit", "1")
        .expect(200, "success");
    });
  });

  describe('when next("router") is called', function () {
    it("should jump out of router", async function () {
      var app = express();
      var router = express.Router();

      function fn(req, res, next) {
        res.set("X-Hit", "1");
        next("router");
      }

      router.get("/foo", fn, function (req, res) {
        res.end("failure");
      });

      router.get("/foo", function (req, res) {
        res.end("failure");
      });

      app.use(router);

      app.get("/foo", function (req, res) {
        res.end("success");
      });

      await request(app)
        .get("/foo")
        .expect("X-Hit", "1")
        .expect(200, "success");
    });
  });

  describe("when next(err) is called", function () {
    it("should break out of app.router", async function () {
      var app = express(),
        calls = [];

      app.get("/foo{/:bar}", function (req, res, next) {
        calls.push("/foo/:bar?");
        next();
      });

      app.get("/bar", function () {
        assert(0);
      });

      app.get("/foo", function (req, res, next) {
        calls.push("/foo");
        next(new Error("fail"));
      });

      app.get("/foo", function () {
        assert(0);
      });

      app.use(function (err, req, res, next) {
        res.json({
          calls: calls,
          error: err.message,
        });
      });

      await request(app)
        .get("/foo")
        .expect(200, { calls: ["/foo/:bar?", "/foo"], error: "fail" });
    });

    it("should call handler in same route, if exists", async function () {
      var app = express();

      function fn1(req, res, next) {
        next(new Error("boom!"));
      }

      function fn2(req, res, next) {
        res.send("foo here");
      }

      function fn3(err, req, res, next) {
        res.send("route go " + err.message);
      }

      app.get("/foo", fn1, fn2, fn3);

      app.use(function (err, req, res, next) {
        res.end("error!");
      });

      await request(app).get("/foo").expect("route go boom!");
    });
  });

  describe("promise support", function () {
    it("should pass rejected promise value", async function () {
      var app = express();
      var router = new express.Router();

      router.use(function createError(req, res, next) {
        return Promise.reject(new Error("boom!"));
      });

      router.use(function sawError(err, req, res, next) {
        res.send("saw " + err.name + ": " + err.message);
      });

      app.use(router);

      await request(app).get("/").expect(200, "saw Error: boom!");
    });

    it("should pass rejected promise without value", async function () {
      var app = express();
      var router = new express.Router();

      router.use(function createError(req, res, next) {
        return Promise.reject();
      });

      router.use(function sawError(err, req, res, next) {
        res.send("saw " + err.name + ": " + err.message);
      });

      app.use(router);

      await request(app).get("/").expect(200, "saw Error: Rejected promise");
    });

    it("should ignore resolved promise", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var router = new express.Router();

        router.use(function createError(req, res, next) {
          res.send("saw GET /foo");
          return Promise.resolve("foo");
        });

        router.use(function () {
          reject(new Error("Unexpected middleware invoke"));
        });

        app.use(router);

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
        var router = new express.Router();

        router.use(function createError(req, res, next) {
          return Promise.reject(new Error("boom!"));
        });

        router.use(function handleError(err, req, res, next) {
          return Promise.reject(new Error("caught: " + err.message));
        });

        router.use(function sawError(err, req, res, next) {
          res.send("saw " + err.name + ": " + err.message);
        });

        app.use(router);

        await request(app).get("/").expect(200, "saw Error: caught: boom!");
      });

      it("should pass rejected promise without value", async function () {
        var app = express();
        var router = new express.Router();

        router.use(function createError(req, res, next) {
          return Promise.reject();
        });

        router.use(function handleError(err, req, res, next) {
          return Promise.reject(new Error("caught: " + err.message));
        });

        router.use(function sawError(err, req, res, next) {
          res.send("saw " + err.name + ": " + err.message);
        });

        app.use(router);

        await request(app)
          .get("/")
          .expect(200, "saw Error: caught: Rejected promise");
      });

      it("should ignore resolved promise", async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var router = new express.Router();

          router.use(function createError(req, res, next) {
            return Promise.reject(new Error("boom!"));
          });

          router.use(function handleError(err, req, res, next) {
            res.send("saw " + err.name + ": " + err.message);
            return Promise.resolve("foo");
          });

          router.use(function () {
            reject(new Error("Unexpected middleware invoke"));
          });

          app.use(router);

          request(app)
            .get("/foo")
            .expect(200, "saw Error: boom!", (err) => {
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

  it("should allow rewriting of the url", async function () {
    var app = express();

    app.get("/account/edit", function (req, res, next) {
      req.user = { id: 12 }; // faux authenticated user
      req.url = "/user/" + req.user.id + "/edit";
      next();
    });

    app.get("/user/:id/edit", function (req, res) {
      res.send("editing user " + req.params.id);
    });

    await request(app).get("/account/edit").expect("editing user 12");
  });

  it("should run in order added", async function () {
    var app = express();
    var path = [];

    app.get("/*path", function (req, res, next) {
      path.push(0);
      next();
    });

    app.get("/user/:id", function (req, res, next) {
      path.push(1);
      next();
    });

    app.use(function (req, res, next) {
      path.push(2);
      next();
    });

    app.all("/user/:id", function (req, res, next) {
      path.push(3);
      next();
    });

    app.get("/*splat", function (req, res, next) {
      path.push(4);
      next();
    });

    app.use(function (req, res, next) {
      path.push(5);
      res.end(path.join(","));
    });

    await request(app).get("/user/1").expect(200, "0,1,2,3,4,5");
  });

  it("should be chainable", function () {
    var app = express();
    assert.strictEqual(
      app.get("/", function () {}),
      app,
    );
  });

  it("should not use disposed router/middleware", async function () {
    await new Promise((resolve, reject) => {
      // more context: https://github.com/expressjs/express/issues/5743#issuecomment-2277148412

      var app = express();
      var router = new express.Router();

      router.use(function (req, res, next) {
        res.setHeader("old", "foo");
        next();
      });

      app.use(function (req, res, next) {
        return router.handle(req, res, next);
      });

      app.get("/", function (req, res, next) {
        res.send("yee");
        next();
      });

      request(app)
        .get("/")
        .expect("old", "foo")
        .expect(function (res) {
          if (typeof res.headers["new"] !== "undefined") {
            throw new Error("`new` header should not be present");
          }
        })
        .expect(200, "yee", function (err, res) {
          if (err) return reject(err);

          router = new express.Router();

          router.use(function (req, res, next) {
            res.setHeader("new", "bar");
            next();
          });

          request(app)
            .get("/")
            .expect("new", "bar")
            .expect(function (res) {
              if (typeof res.headers["old"] !== "undefined") {
                throw new Error("`old` header should not be present");
              }
            })
            .expect(200, "yee", (err) => {
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

function supportsRegexp(source) {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}
