"use strict";
import {describe, it} from "node:test";
import after from "#test/support/after";
import express from "#express";
import request from "supertest";
import assert from "node:assert";
import { httpMethods } from "#lib/utils/methods";
import {shouldSkipQuery} from "#test/support/utils";

describe("app.router", () => {
  it("should restore req.params after leaving router", async () => {
    const app = express();
    const router = new express.Router();

    function handler1(req, res, next) {
      res.setHeader("x-user-id", String(req.params.id));
      next();
    }

    function handler2(req, res) {
      res.send(req.params.id);
    }

    router.use((req, res, next) => {
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

  describe("methods", () => {
    httpMethods.forEach(method => {
      if (method === "connect") return;

      it(
        "should include " + method.toUpperCase(),
        { skip: method === "query" && shouldSkipQuery(process.versions.node) },
        async () => {
          const app = express();

          app[method]("/foo", (req, res) => {
            res.send(method);
          });

          await request(app)[method]("/foo").expect(200);
        },
      );

      it("should reject numbers for app." + method, () => {
        const app = express();
        assert.throws(
          app[method].bind(app, "/", 3),
          /argument handler must be a function/,
        );
      });
    });

    it("should re-route when method is altered", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use((req, res, next) => {
          if (req.method !== "POST") return next();
          req.method = "DELETE";
          res.setHeader("X-Method-Altered", "1");
          next();
        });

        app.delete("/", (req, res) => {
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

  describe("decode params", () => {
    it("should decode correct params", async () => {
      const app = express();

      app.get("/:name", (req, res) => {
        res.send(req.params.name);
      });

      await request(app).get("/foo%2Fbar").expect("foo/bar");
    });

    it("should not accept params in malformed paths", async () => {
      const app = express();

      app.get("/:name", (req, res) => {
        res.send(req.params.name);
      });

      await request(app).get("/%foobar").expect(400);
    });

    it("should not decode spaces", async () => {
      const app = express();

      app.get("/:name", (req, res) => {
        res.send(req.params.name);
      });

      await request(app).get("/foo+bar").expect("foo+bar");
    });

    it("should work with unicode", async () => {
      const app = express();

      app.get("/:name", (req, res) => {
        res.send(req.params.name);
      });

      await request(app).get("/%ce%b1").expect("\u03b1");
    });
  });

  it("should be .use()able", async () => {
    const app = express();

    const calls = [];

    app.use((req, res, next) => {
      calls.push("before");
      next();
    });

    app.get("/", (req, res, next) => {
      calls.push("GET /");
      next();
    });

    app.use((req, res, next) => {
      calls.push("after");
      res.json(calls);
    });

    await request(app).get("/").expect(200, ["before", "GET /", "after"]);
  });

  describe("when given a regexp", () => {
    it("should match the pathname only", async () => {
      const app = express();

      app.get(/^\/user\/[0-9]+$/, (req, res) => {
        res.end("user");
      });

      await request(app).get("/user/12?foo=bar").expect("user");
    });

    it("should populate req.params with the captures", async () => {
      const app = express();

      app.get(/^\/user\/([0-9]+)\/(view|edit)?$/, (req, res) => {
        const id = req.params[0], op = req.params[1];
        res.end(op + "ing user " + id);
      });

      await request(app).get("/user/10/edit").expect("editing user 10");
    });

    if (supportsRegexp("(?<foo>.*)")) {
      it("should populate req.params with named captures", async () => {
        const app = express();
        const re = new RegExp("^/user/(?<userId>[0-9]+)/(view|edit)?$");

        app.get(re, (req, res) => {
          const id = req.params.userId, op = req.params[0];
          res.end(op + "ing user " + id);
        });

        await request(app).get("/user/10/edit").expect("editing user 10");
      });
    }

    it("should ensure regexp matches path prefix", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const p = [];

        app.use(/\/api.*/, (req, res, next) => {
          p.push("a");
          next();
        });
        app.use(/api/, (req, res, next) => {
          p.push("b");
          next();
        });
        app.use(/\/test/, (req, res, next) => {
          p.push("c");
          next();
        });
        app.use((req, res) => {
          res.end();
        });

        request(app)
          .get("/test/api/1234")
          .expect(200, err => {
            if (err) return reject(err);
            assert.deepEqual(p, ["c"]);
            resolve();
          });
      });
    });
  });

  describe("case sensitivity", () => {
    it("should be disabled by default", async () => {
      const app = express();

      app.get("/user", (req, res) => {
        res.end("tj");
      });

      await request(app).get("/USER").expect("tj");
    });

    describe('when "case sensitive routing" is enabled', () => {
      it("should match identical casing", async () => {
        const app = express();

        app.enable("case sensitive routing");

        app.get("/uSer", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/uSer").expect("tj");
      });

      it("should not match otherwise", async () => {
        const app = express();

        app.enable("case sensitive routing");

        app.get("/uSer", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user").expect(404);
      });
    });
  });

  describe("params", () => {
    it("should overwrite existing req.params by default", async () => {
      const app = express();
      const router = new express.Router();

      router.get("/:action", (req, res) => {
        res.send(req.params);
      });

      app.use("/user/:user", router);

      await request(app).get("/user/1/get").expect(200, '{"action":"get"}');
    });

    it("should allow merging existing req.params", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get("/:action", (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/:user", router);

      await request(app)
        .get("/user/tj/get")
        .expect(200, '[["action","get"],["user","tj"]]');
    });

    it("should merge prototype-named params as own properties", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get("/:constructor", (req, res) => {
        const keys = Object.keys(req.params).sort();

        res.send({
          keys,
          prototype: Object.getPrototypeOf(req.params),
          values: keys.map(k => {
            return [k, req.params[k]];
          }),
        });
      });

      app.use("/user/:__proto__", router);

      await request(app)
        .get("/user/tj/get")
        .expect(
          200,
          '{"keys":["__proto__","constructor"],"prototype":null,"values":[["__proto__","tj"],["constructor","get"]]}',
        );
    });

    it("should use params from router", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get("/:thing", (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/:thing", router);

      await request(app).get("/user/tj/get").expect(200, '[["thing","get"]]');
    });

    it("should merge numeric indices req.params", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get(/^\/(.*)\.(.*)/, (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/^\/user\/id:(\d+)/, router);

      await request(app)
        .get("/user/id:10/profile.json")
        .expect(200, '[["0","10"],["1","profile"],["2","json"]]');
    });

    it("should merge numeric indices req.params when more in parent", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get(/\/(.*)/, (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/^\/user\/id:(\d+)\/name:(\w+)/, router);

      await request(app)
        .get("/user/id:10/name:tj/profile")
        .expect(200, '[["0","10"],["1","tj"],["2","profile"]]');
    });

    it("should merge numeric indices req.params when parent has same number", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get(/\/name:(\w+)/, (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use(/\/user\/id:(\d+)/, router);

      await request(app)
        .get("/user/id:10/name:tj")
        .expect(200, '[["0","10"],["1","tj"]]');
    });

    it("should ignore invalid incoming req.params", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get("/:name", (req, res) => {
        const keys = Object.keys(req.params).sort();
        res.send(
          keys.map(k => {
            return [k, req.params[k]];
          }),
        );
      });

      app.use("/user/", (req, res, next) => {
        req.params = 3; // wat?
        router(req, res, next);
      });

      await request(app).get("/user/tj").expect(200, '[["name","tj"]]');
    });

    it("should restore req.params", async () => {
      const app = express();
      const router = new express.Router({ mergeParams: true });

      router.get(/\/user:(\w+)\//, (req, res, next) => {
        next();
      });

      app.use(/\/user\/id:(\d+)/, (req, res, next) => {
        router(req, res, err => {
          const keys = Object.keys(req.params).sort();
          res.send(
            keys.map(k => {
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

  describe("trailing slashes", () => {
    it("should be optional by default", async () => {
      const app = express();

      app.get("/user", (req, res) => {
        res.end("tj");
      });

      await request(app).get("/user/").expect("tj");
    });

    describe('when "strict routing" is enabled', () => {
      it("should match trailing slashes", async () => {
        const app = express();

        app.enable("strict routing");

        app.get("/user/", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user/").expect("tj");
      });

      it("should pass-though middleware", async () => {
        const app = express();

        app.enable("strict routing");

        app.use((req, res, next) => {
          res.setHeader("x-middleware", "true");
          next();
        });

        app.get("/user/", (req, res) => {
          res.end("tj");
        });

        await request(app)
          .get("/user/")
          .expect("x-middleware", "true")
          .expect(200, "tj");
      });

      it("should pass-though mounted middleware", async () => {
        const app = express();

        app.enable("strict routing");

        app.use("/user/", (req, res, next) => {
          res.setHeader("x-middleware", "true");
          next();
        });

        app.get("/user/test/", (req, res) => {
          res.end("tj");
        });

        await request(app)
          .get("/user/test/")
          .expect("x-middleware", "true")
          .expect(200, "tj");
      });

      it("should match no slashes", async () => {
        const app = express();

        app.enable("strict routing");

        app.get("/user", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user").expect("tj");
      });

      it("should match middleware when omitting the trailing slash", async () => {
        const app = express();

        app.enable("strict routing");

        app.use("/user/", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user").expect(200, "tj");
      });

      it("should match middleware", async () => {
        const app = express();

        app.enable("strict routing");

        app.use("/user", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user").expect(200, "tj");
      });

      it("should match middleware when adding the trailing slash", async () => {
        const app = express();

        app.enable("strict routing");

        app.use("/user", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user/").expect(200, "tj");
      });

      it("should fail when omitting the trailing slash", async () => {
        const app = express();

        app.enable("strict routing");

        app.get("/user/", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user").expect(404);
      });

      it("should fail when adding the trailing slash", async () => {
        const app = express();

        app.enable("strict routing");

        app.get("/user", (req, res) => {
          res.end("tj");
        });

        await request(app).get("/user/").expect(404);
      });
    });
  });

  it('should allow literal "."', async () => {
    const app = express();

    app.get("/api/users/:from..:to", (req, res) => {
      const from = req.params.from, to = req.params.to;

      res.end("users from " + from + " to " + to);
    });

    await request(app).get("/api/users/1..50").expect("users from 1 to 50");
  });

  describe(":name", () => {
    it("should denote a capture group", async () => {
      const app = express();

      app.get("/user/:user", (req, res) => {
        res.end(req.params.user);
      });

      await request(app).get("/user/tj").expect("tj");
    });

    it("should match a single segment only", async () => {
      const app = express();

      app.get("/user/:user", (req, res) => {
        res.end(req.params.user);
      });

      await request(app).get("/user/tj/edit").expect(404);
    });

    it("should allow several capture groups", async () => {
      const app = express();

      app.get("/user/:user/:op", (req, res) => {
        res.end(req.params.op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj/edit").expect("editing tj");
    });

    it("should work following a partial capture group", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/user{s}/:user/:op", (req, res) => {
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

    it("should work inside literal parenthesis", async () => {
      const app = express();

      app.get("/:user\\(:op\\)", (req, res) => {
        res.end(req.params.op + "ing " + req.params.user);
      });

      await request(app).get("/tj(edit)").expect("editing tj");
    });

    it("should work in array of paths", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get(["/user/:user/poke", "/user/:user/pokes"], (req, res) => {
          res.end("poking " + req.params.user);
        });

        request(app).get("/user/tj/poke").expect("poking tj", cb);

        request(app).get("/user/tj/pokes").expect("poking tj", cb);
      });
    });
  });

  describe(":name?", () => {
    it("should denote an optional capture group", async () => {
      const app = express();

      app.get("/user/:user{/:op}", (req, res) => {
        const op = req.params.op || "view";
        res.end(op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj").expect("viewing tj");
    });

    it("should populate the capture group", async () => {
      const app = express();

      app.get("/user/:user{/:op}", (req, res) => {
        const op = req.params.op || "view";
        res.end(op + "ing " + req.params.user);
      });

      await request(app).get("/user/tj/edit").expect("editing tj");
    });
  });

  describe(":name*", () => {
    it("should match one segment", async () => {
      const app = express();

      app.get("/user/*user", (req, res) => {
        res.end(req.params.user[0]);
      });

      await request(app).get("/user/122").expect("122");
    });

    it("should match many segments", async () => {
      const app = express();

      app.get("/user/*user", (req, res) => {
        res.end(req.params.user.join("/"));
      });

      await request(app).get("/user/1/2/3/4").expect("1/2/3/4");
    });

    it("should match zero segments", async () => {
      const app = express();

      app.get("/user{/*user}", (req, res) => {
        res.end(req.params.user);
      });

      await request(app).get("/user").expect("");
    });
  });

  describe(":name+", () => {
    it("should match one segment", async () => {
      const app = express();

      app.get("/user/*user", (req, res) => {
        res.end(req.params.user[0]);
      });

      await request(app).get("/user/122").expect(200, "122");
    });

    it("should match many segments", async () => {
      const app = express();

      app.get("/user/*user", (req, res) => {
        res.end(req.params.user.join("/"));
      });

      await request(app).get("/user/1/2/3/4").expect(200, "1/2/3/4");
    });

    it("should not match zero segments", async () => {
      const app = express();

      app.get("/user/*user", (req, res) => {
        res.end(req.params.user);
      });

      await request(app).get("/user").expect(404);
    });
  });

  describe(".:name", () => {
    it("should denote a format", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/:name.:format", (req, res) => {
          res.end(req.params.name + " as " + req.params.format);
        });

        request(app).get("/foo.json").expect(200, "foo as json", cb);

        request(app).get("/foo").expect(404, cb);
      });
    });
  });

  describe(".:name?", () => {
    it("should denote an optional format", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.get("/:name{.:format}", (req, res) => {
          res.end(req.params.name + " as " + (req.params.format || "html"));
        });

        request(app).get("/foo").expect(200, "foo as html", cb);

        request(app).get("/foo.json").expect(200, "foo as json", cb);
      });
    });
  });

  describe("when next() is called", () => {
    it("should continue lookup", async () => {
      const app = express(), calls = [];

      app.get("/foo{/:bar}", (req, res, next) => {
        calls.push("/foo/:bar?");
        next();
      });

      app.get("/bar", () => {
        assert(0);
      });

      app.get("/foo", (req, res, next) => {
        calls.push("/foo");
        next();
      });

      app.get("/foo", (req, res) => {
        calls.push("/foo 2");
        res.json(calls);
      });

      await request(app)
        .get("/foo")
        .expect(200, ["/foo/:bar?", "/foo", "/foo 2"]);
    });
  });

  describe('when next("route") is called', () => {
    it("should jump to next route", async () => {
      const app = express();

      function fn(req, res, next) {
        res.set("X-Hit", "1");
        next("route");
      }

      app.get("/foo", fn, (req, res) => {
        res.end("failure");
      });

      app.get("/foo", (req, res) => {
        res.end("success");
      });

      await request(app)
        .get("/foo")
        .expect("X-Hit", "1")
        .expect(200, "success");
    });
  });

  describe('when next("router") is called', () => {
    it("should jump out of router", async () => {
      const app = express();
      const router = express.Router();

      function fn(req, res, next) {
        res.set("X-Hit", "1");
        next("router");
      }

      router.get("/foo", fn, (req, res) => {
        res.end("failure");
      });

      router.get("/foo", (req, res) => {
        res.end("failure");
      });

      app.use(router);

      app.get("/foo", (req, res) => {
        res.end("success");
      });

      await request(app)
        .get("/foo")
        .expect("X-Hit", "1")
        .expect(200, "success");
    });
  });

  describe("when next(err) is called", () => {
    it("should break out of app.router", async () => {
      const app = express(), calls = [];

      app.get("/foo{/:bar}", (req, res, next) => {
        calls.push("/foo/:bar?");
        next();
      });

      app.get("/bar", () => {
        assert(0);
      });

      app.get("/foo", (req, res, next) => {
        calls.push("/foo");
        next(new Error("fail"));
      });

      app.get("/foo", () => {
        assert(0);
      });

      app.use((err, req, res, next) => {
        res.json({
          calls: calls,
          error: err.message,
        });
      });

      await request(app)
        .get("/foo")
        .expect(200, { calls: ["/foo/:bar?", "/foo"], error: "fail" });
    });

    it("should call handler in same route, if exists", async () => {
      const app = express();

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

      app.use((err, req, res, next) => {
        res.end("error!");
      });

      await request(app).get("/foo").expect("route go boom!");
    });
  });

  describe("promise support", () => {
    it("should pass rejected promise value", async () => {
      const app = express();
      const router = new express.Router();

      router.use(function createError(req, res, next) {
        return Promise.reject(new Error("boom!"));
      });

      router.use(function sawError(err, req, res, next) {
        res.send("saw " + err.name + ": " + err.message);
      });

      app.use(router);

      await request(app).get("/").expect(200, "saw Error: boom!");
    });

    it("should pass rejected promise without value", async () => {
      const app = express();
      const router = new express.Router();

      router.use(function createError(req, res, next) {
        return Promise.reject();
      });

      router.use(function sawError(err, req, res, next) {
        res.send("saw " + err.name + ": " + err.message);
      });

      app.use(router);

      await request(app).get("/").expect(200, "saw Error: Rejected promise");
    });

    it("should ignore resolved promise", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const router = new express.Router();

        router.use(function createError(req, res, next) {
          res.send("saw GET /foo");
          return Promise.resolve("foo");
        });

        router.use(() => {
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

    describe("error handling", () => {
      it("should pass rejected promise value", async () => {
        const app = express();
        const router = new express.Router();

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

      it("should pass rejected promise without value", async () => {
        const app = express();
        const router = new express.Router();

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

      it("should ignore resolved promise", async () => {
        await new Promise((resolve, reject) => {
          const app = express();
          const router = new express.Router();

          router.use(function createError(req, res, next) {
            return Promise.reject(new Error("boom!"));
          });

          router.use(function handleError(err, req, res, next) {
            res.send("saw " + err.name + ": " + err.message);
            return Promise.resolve("foo");
          });

          router.use(() => {
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

  it("should allow rewriting of the url", async () => {
    const app = express();

    app.get("/account/edit", (req, res, next) => {
      req.user = { id: 12 }; // faux authenticated user
      req.url = "/user/" + req.user.id + "/edit";
      next();
    });

    app.get("/user/:id/edit", (req, res) => {
      res.send("editing user " + req.params.id);
    });

    await request(app).get("/account/edit").expect("editing user 12");
  });

  it("should run in order added", async () => {
    const app = express();
    const path = [];

    app.get("/*path", (req, res, next) => {
      path.push(0);
      next();
    });

    app.get("/user/:id", (req, res, next) => {
      path.push(1);
      next();
    });

    app.use((req, res, next) => {
      path.push(2);
      next();
    });

    app.all("/user/:id", (req, res, next) => {
      path.push(3);
      next();
    });

    app.get("/*splat", (req, res, next) => {
      path.push(4);
      next();
    });

    app.use((req, res, next) => {
      path.push(5);
      res.end(path.join(","));
    });

    await request(app).get("/user/1").expect(200, "0,1,2,3,4,5");
  });

  it("should be chainable", () => {
    const app = express();
    assert.strictEqual(
      app.get("/", () => {}),
      app,
    );
  });

  it("should not use disposed router/middleware", async () => {
    await new Promise((resolve, reject) => {
      // more context: https://github.com/expressjs/express/issues/5743#issuecomment-2277148412

      const app = express();
      let router = new express.Router();

      router.use((req, res, next) => {
        res.setHeader("old", "foo");
        next();
      });

      app.use((req, res, next) => {
        return router.handle(req, res, next);
      });

      app.get("/", (req, res, next) => {
        res.send("yee");
        next();
      });

      request(app)
        .get("/")
        .expect("old", "foo")
        .expect(res => {
          if (typeof res.headers["new"] !== "undefined") {
            throw new Error("`new` header should not be present");
          }
        })
        .expect(200, "yee", (err, res) => {
          if (err) return reject(err);

          router = new express.Router();

          router.use((req, res, next) => {
            res.setHeader("new", "bar");
            next();
          });

          request(app)
            .get("/")
            .expect("new", "bar")
            .expect(res => {
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
