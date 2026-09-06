"use strict";
import {describe, it} from "node:test";
import after from "#test/support/after";
import express from "#express";
const Router = express.Router;
import { httpMethods } from "#lib/utils/methods";
import assert from "node:assert";
import request from "supertest";
import methodOverride from "#lib/utils/method-override";

describe("Router", () => {
  describe("root mounts in path arrays", () => {
    for (const strict of [false, true]) {
      for (const mount of ["/", ["/"], ["/other", "/"], ["/", "/other"]]) {
        it(`should protect child paths with strict=${strict} and mount=${JSON.stringify(mount)}`, async () => {
          const app = express();
          const router = Router({ strict });
          router.use(mount, (req, res) => res.status(401).send("denied"));
          router.get("/admin", (req, res) => res.send("protected"));
          app.use("/api", router);

          for (const target of ["/api/", "/api/admin", "/api/admin/child"]) {
            await request(app).get(target).expect(401, "denied");
          }
        });
      }
    }

    for (const rootFirst of [false, true]) {
      it(`should preserve alternative order and params with rootFirst=${rootFirst}`, async () => {
        const app = express();
        const paths = rootFirst ? ["/", "/group/:id"] : ["/group/:id", "/"];
        app.use(paths, (req, res) => res.json({
          url: req.url, baseUrl: req.baseUrl, params: req.params,
        }));

        await request(app).get("/group/one/child").expect(200, rootFirst ? {
          url: "/group/one/child", baseUrl: "", params: {},
        } : {
          url: "/child", baseUrl: "/group/one", params: { id: "one" },
        });
        await request(app).get("/other").expect(200, {
          url: "/other", baseUrl: "", params: {},
        });
      });
    }

    it("should keep root routes in arrays limited to the root path", async () => {
      const app = express();
      app.get(["/"], (req, res) => res.send("root"));
      await request(app).get("/").expect(200, "root");
      await request(app).get("/child").expect(404);
    });

    it("should run root error middleware in arrays for child paths", async () => {
      const app = express();
      app.get("/child", (req, res, next) => next(new Error("failure")));
      app.use(["/"], (err, req, res, next) => res.status(503).send(err.message));
      await request(app).get("/child").expect(503, "failure");
    });
  });

  it("should bound dispatch caches for arbitrary overridden methods", async () => {
    const app = express();
    const router = Router();

    app.use(methodOverride());
    router.all("/", (req, res) => res.send(req.method));
    app.use(router);

    for (let index = 0; index < 100; index++) {
      const method = `METHOD${index}`;
      await request(app).post(`/?_method=${method}`).expect(200, method);
    }

    assert.strictEqual(Reflect.ownKeys(router.stack[0].route._dispatchPlans).length, 1);
  });

  it("should return a function with router methods", () => {
    const router = new Router();
    assert(typeof router === "function");
    assert(router instanceof Router);
    assert.strictEqual(Object.getPrototypeOf(router), Router.prototype);
    assert.strictEqual(router.constructor, Router);

    assert(typeof router.get === "function");
    assert(typeof router.handle === "function");
    assert(typeof router.use === "function");
  });

  it("should inherit extensions from Router.prototype", () => {
    const extension = Symbol("extension");
    const router = Router();

    Router.prototype[extension] = function extendedRouter() {
      return this;
    };

    try {
      assert.strictEqual(router[extension](), router);
    } finally {
      delete Router.prototype[extension];
    }
  });

  it("should support .use of other routers", async () => {
    await new Promise((resolve, reject) => {
      const router = new Router();
      const another = new Router();

      another.get("/bar", (req, res) => {
        res.end();
      });
      router.use("/foo", another);

      router.handle(
        { url: "/foo/bar", method: "GET" },
        {
          end: (err) => {
            if (err != null) {
              reject(err);
              return;
            }
            resolve();
          },
        },
        () => {},
      );
    });
  });

  it("should support dynamic routes", async () => {
    await new Promise((resolve, reject) => {
      const router = new Router();
      const another = new Router();

      another.get("/:bar", (req, res) => {
        assert.strictEqual(req.params.bar, "route");
        res.end();
      });
      router.use("/:foo", another);

      router.handle(
        { url: "/test/route", method: "GET" },
        {
          end: (err) => {
            if (err != null) {
              reject(err);
              return;
            }
            resolve();
          },
        },
        () => {},
      );
    });
  });

  it("should handle blank URL", async () => {
    const router = new Router();

    router.use((req, res) => {
      throw new Error("should not be called");
    });

    await new Promise((resolve, reject) => {
      router.handle({ url: "", method: "GET" }, {}, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  it("should handle missing URL", async () => {
    const router = new Router();

    router.use((req, res) => {
      throw new Error("should not be called");
    });

    await new Promise((resolve, reject) => {
      router.handle({ method: "GET" }, {}, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  it("handle missing method", async () => {
    await new Promise((resolve, reject) => {
      let all = false;
      const router = new Router();
      const route = router.route("/foo");
      let use = false;

      route.post((req, res, next) => {
        next(new Error("should not run"));
      });
      route.all((req, res, next) => {
        all = true;
        next();
      });
      route.get((req, res, next) => {
        next(new Error("should not run"));
      });

      router.get("/foo", (req, res, next) => {
        next(new Error("should not run"));
      });
      router.use((req, res, next) => {
        use = true;
        next();
      });

      router.handle({ url: "/foo" }, {}, err => {
        if (err) return reject(err);
        assert.ok(all);
        assert.ok(use);
        resolve();
      });
    });
  });

  it(
    "should not stack overflow with many registered routes",
    { timeout: 5000 },
    async () => {
      await new Promise((resolve, reject) => {
        const handler = (req, res) => {
          res.end(new Error("wrong handler"));
        };
        const router = new Router();

        for (let i = 0; i < 6000; i++) {
          router.get("/thing" + i, handler);
        }

        router.get("/", (req, res) => {
          res.end();
        });

        router.handle(
          { url: "/", method: "GET" },
          {
            end: (err) => {
              if (err != null) {
                reject(err);
                return;
              }
              resolve();
            },
          },
          () => {},
        );
      });
    },
  );

  it(
    "should not stack overflow with a large sync route stack",
    { timeout: 5000 },
    async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.get("/foo", (req, res, next) => {
          req.counter = 0;
          next();
        });

        for (let i = 0; i < 6000; i++) {
          router.get("/foo", (req, res, next) => {
            req.counter++;
            next();
          });
        }

        router.get("/foo", (req, res) => {
          assert.strictEqual(req.counter, 6000);
          res.end();
        });

        router.handle(
          { url: "/foo", method: "GET" },
          {
            end: (err) => {
              if (err != null) {
                reject(err);
                return;
              }
              resolve();
            },
          },
          err => {
            assert(!err, err);
          },
        );
      });
    },
  );

  it(
    "should not stack overflow with a large sync middleware stack",
    { timeout: 5000 },
    async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.use((req, res, next) => {
          req.counter = 0;
          next();
        });

        for (let i = 0; i < 6000; i++) {
          router.use((req, res, next) => {
            req.counter++;
            next();
          });
        }

        router.use((req, res) => {
          assert.strictEqual(req.counter, 6000);
          res.end();
        });

        router.handle(
          { url: "/", method: "GET" },
          {
            end: (err) => {
              if (err != null) {
                reject(err);
                return;
              }
              resolve();
            },
          },
          err => {
            assert(!err, err);
          },
        );
      });
    },
  );

  describe(".handle", () => {
    it("should dispatch", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.route("/foo").get((req, res) => {
          res.send("foo");
        });

        const res = {
          send: (val) => {
            assert.strictEqual(val, "foo");
            resolve();
          },
        };
        router.handle({ url: "/foo", method: "GET" }, res, () => {});
      });
    });

    it("should match trailing slashes for static routes when not strict", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.get("/foo", (req, res) => {
          res.end("ok");
        });

        router.handle(
          { url: "/foo/", method: "GET" },
          {
            end: value => {
              try {
                assert.strictEqual(value, "ok");
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
          reject,
        );
      });
    });

    it("should preserve route order when dynamic routes disable the fast path", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();
        const hits = [];

        router.get("/:name", (req, res, next) => {
          hits.push(`dynamic:${req.params.name}`);
          next("route");
        });

        router.get("/foo", (req, res) => {
          hits.push("static");
          res.end("done");
        });

        router.handle(
          { url: "/foo", method: "GET" },
          {
            end: value => {
              try {
                assert.strictEqual(value, "done");
                assert.deepStrictEqual(hits, ["dynamic:foo", "static"]);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
          reject,
        );
      });
    });

    it("should collect OPTIONS for static-only routes", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();
        const headers = {};

        router.get("/foo", () => {});
        router.put("/foo", () => {});

        router.handle(
          { url: "/foo", method: "OPTIONS" },
          {
            end: value => {
              try {
                assert.strictEqual(value, "GET, HEAD, PUT");
                assert.strictEqual(headers.Allow, "GET, HEAD, PUT");
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            setHeader(name, value) {
              headers[name] = value;
            },
          },
          reject,
        );
      });
    });

    it("should match trailing slashes for static routes after middleware disables the fast path", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.use((req, res, next) => {
          next();
        });

        router.get("/foo", (req, res) => {
          res.end("ok");
        });

        router.handle(
          { url: "/foo/", method: "GET" },
          {
            end: value => {
              try {
                assert.strictEqual(value, "ok");
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
          reject,
        );
      });
    });

    it("should preserve case-sensitive static route matching after middleware disables the fast path", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router({ caseSensitive: true });
        let matched = false;

        router.use((req, res, next) => {
          next();
        });

        router.get("/Foo", (req, res) => {
          matched = true;
          res.end("matched");
        });

        router.handle(
          { url: "/foo", method: "GET" },
          {},
          err => {
            if (err) {
              reject(err);
              return;
            }

            assert.strictEqual(matched, false);
            resolve();
          },
        );
      });
    });

    it("should match static middleware prefixes without crossing segment boundaries", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();
        let hit = false;

        router.use("/foo", (req, res) => {
          hit = true;
          res.end(req.url);
        });

        router.handle(
          { url: "/foobar", method: "GET" },
          {},
          err => {
            if (err) {
              reject(err);
              return;
            }

            assert.strictEqual(hit, false);
            resolve();
          },
        );
      });
    });

    it("should trim static middleware prefixes after matching", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.use("/foo/", (req, res) => {
          res.end(req.url);
        });

        router.handle(
          { url: "/foo/bar", method: "GET" },
          {
            end: value => {
              try {
                assert.strictEqual(value, "/bar");
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
          reject,
        );
      });
    });
  });

  describe(".multiple callbacks", () => {
    it("should throw if a callback is null", () => {
      assert.throws(() => {
        const router = new Router();
        router.route("/foo").all(null);
      });
    });

    it("should throw if a callback is undefined", () => {
      assert.throws(() => {
        const router = new Router();
        router.route("/foo").all(undefined);
      });
    });

    it("should throw if a callback is not a function", () => {
      assert.throws(() => {
        const router = new Router();
        router.route("/foo").all("not a function");
      });
    });

    it("should not throw if all callbacks are functions", () => {
      const router = new Router();
      router
        .route("/foo")
        .all(() => {})
        .all(() => {});
    });
  });

  describe("error", () => {
    it("should skip non error middleware", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.get("/foo", (req, res, next) => {
          next(new Error("foo"));
        });

        router.get("/bar", (req, res, next) => {
          next(new Error("bar"));
        });

        router.use((req, res, next) => {
          assert(false);
        });

        router.use((err, req, res, next) => {
          assert.equal(err.message, "foo");
          resolve();
        });

        router.handle({ url: "/foo", method: "GET" }, {}, (err) => {
          if (err != null) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    it("should handle throwing inside routes with params", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.get("/foo/:id", () => {
          throw new Error("foo");
        });

        router.use((req, res, next) => {
          assert(false);
        });

        router.use((err, req, res, next) => {
          assert.equal(err.message, "foo");
          resolve();
        });

        router.handle({ url: "/foo/2", method: "GET" }, {}, () => {});
      });
    });

    it("should handle throwing in handler after async param", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.param("user", (req, res, next, val) => {
          process.nextTick(() => {
            req.user = val;
            next();
          });
        });

        router.use("/:user", (req, res, next) => {
          throw new Error("oh no!");
        });

        router.use((err, req, res, next) => {
          assert.equal(err.message, "oh no!");
          resolve();
        });

        router.handle({ url: "/bob", method: "GET" }, {}, () => {});
      });
    });

    it("should handle throwing inside error handlers", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        router.use((req, res, next) => {
          throw new Error("boom!");
        });

        router.use((err, req, res, next) => {
          throw new Error("oops");
        });

        router.use((err, req, res, next) => {
          assert.equal(err.message, "oops");
          resolve();
        });

        router.handle({ url: "/", method: "GET" }, {}, (err) => {
          if (err != null) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });

  describe("FQDN", () => {
    it("should not obscure FQDNs", async () => {
      await new Promise((resolve, reject) => {
        const request = { hit: 0, url: "http://example.com/foo", method: "GET" };
        const router = new Router();

        router.use((req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "http://example.com/foo");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 1);
          resolve();
        });
      });
    });

    it("should ignore FQDN in search", async () => {
      await new Promise((resolve, reject) => {
        const request = {
          hit: 0,
          url: "/proxy?url=http://example.com/blog/post/1",
          method: "GET",
        };
        const router = new Router();

        router.use("/proxy", (req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "/?url=http://example.com/blog/post/1");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 1);
          resolve();
        });
      });
    });

    it("should ignore FQDN in path", async () => {
      await new Promise((resolve, reject) => {
        const request = {
          hit: 0,
          url: "/proxy/http://example.com/blog/post/1",
          method: "GET",
        };
        const router = new Router();

        router.use("/proxy", (req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "/http://example.com/blog/post/1");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 1);
          resolve();
        });
      });
    });

    it("should adjust FQDN req.url", async () => {
      await new Promise((resolve, reject) => {
        const request = {
          hit: 0,
          url: "http://example.com/blog/post/1",
          method: "GET",
        };
        const router = new Router();

        router.use("/blog", (req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "http://example.com/post/1");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 1);
          resolve();
        });
      });
    });

    it("should adjust FQDN req.url with multiple handlers", async () => {
      await new Promise((resolve, reject) => {
        const request = {
          hit: 0,
          url: "http://example.com/blog/post/1",
          method: "GET",
        };
        const router = new Router();

        router.use((req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "http://example.com/blog/post/1");
          next();
        });

        router.use("/blog", (req, res, next) => {
          assert.equal(req.hit++, 1);
          assert.equal(req.url, "http://example.com/post/1");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 2);
          resolve();
        });
      });
    });

    it("should adjust FQDN req.url with multiple routed handlers", async () => {
      await new Promise((resolve, reject) => {
        const request = {
          hit: 0,
          url: "http://example.com/blog/post/1",
          method: "GET",
        };
        const router = new Router();

        router.use("/blog", (req, res, next) => {
          assert.equal(req.hit++, 0);
          assert.equal(req.url, "http://example.com/post/1");
          next();
        });

        router.use("/blog", (req, res, next) => {
          assert.equal(req.hit++, 1);
          assert.equal(req.url, "http://example.com/post/1");
          next();
        });

        router.use((req, res, next) => {
          assert.equal(req.hit++, 2);
          assert.equal(req.url, "http://example.com/blog/post/1");
          next();
        });

        router.handle(request, {}, err => {
          if (err) return reject(err);
          assert.equal(request.hit, 3);
          resolve();
        });
      });
    });
  });

  describe(".all", () => {
    it("should support using .all to capture all http verbs", async () => {
      await new Promise((resolve, reject) => {
        const router = new Router();

        let count = 0;
        router.all("/foo", () => {
          count++;
        });

        const url = "/foo?bar=baz";

        httpMethods.forEach(function testMethod(method) {
          router.handle({ url: url, method: method }, {}, () => {});
        });

        assert.equal(count, httpMethods.length);
        resolve();
      });
    });
  });

  describe(".use", () => {
    it("should require middleware", () => {
      const router = new Router();
      assert.throws(() => {
        router.use("/");
      }, /argument handler is required/);
    });

    it("should reject string as middleware", () => {
      const router = new Router();
      assert.throws(() => {
        router.use("/", "foo");
      }, /argument handler must be a function/);
    });

    it("should reject number as middleware", () => {
      const router = new Router();
      assert.throws(() => {
        router.use("/", 42);
      }, /argument handler must be a function/);
    });

    it("should reject null as middleware", () => {
      const router = new Router();
      assert.throws(() => {
        router.use("/", null);
      }, /argument handler must be a function/);
    });

    it("should reject Date as middleware", () => {
      const router = new Router();
      assert.throws(() => {
        router.use("/", new Date());
      }, /argument handler must be a function/);
    });

    it("should be called for any URL", async () => {
      await new Promise((resolve, reject) => {
        const cb = after(4, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const router = new Router();

        function no() {
          throw new Error("should not be called");
        }

        router.use((req, res) => {
          res.end();
        });

        router.handle({ url: "/", method: "GET" }, { end: cb }, no);
        router.handle({ url: "/foo", method: "GET" }, { end: cb }, no);
        router.handle({ url: "foo", method: "GET" }, { end: cb }, no);
        router.handle({ url: "*", method: "GET" }, { end: cb }, no);
      });
    });

    it("should accept array of middleware", async () => {
      await new Promise((resolve, reject) => {
        let count = 0;
        const router = new Router();

        function fn1(req, res, next) {
          assert.equal(++count, 1);
          next();
        }

        function fn2(req, res, next) {
          assert.equal(++count, 2);
          next();
        }

        router.use([fn1, fn2], (req, res) => {
          assert.equal(++count, 3);
          resolve();
        });

        router.handle({ url: "/foo", method: "GET" }, {}, () => {});
      });
    });
  });

  describe(".param", () => {
    it("should require function", () => {
      const router = new Router();
      assert.throws(router.param.bind(router, "id"), /argument fn is required/);
    });

    it("should reject non-function", () => {
      const router = new Router();
      assert.throws(
        router.param.bind(router, "id", 42),
        /argument fn must be a function/,
      );
    });

    it("should call param function when routing VERBS", async () => {
      const router = new Router();

      router.param("id", (req, res, next, id) => {
        assert.equal(id, "123");
        next();
      });

      router.get("/foo/:id/bar", (req, res, next) => {
        assert.equal(req.params.id, "123");
        next();
      });

      await new Promise((resolve, reject) => {
        router.handle(
          { url: "/foo/123/bar", method: "get" },
          {},
          err => {
            if (err) return reject(err);
            resolve();
          },
        );
      });
    });

    it("should call param function when routing middleware", async () => {
      const router = new Router();

      router.param("id", (req, res, next, id) => {
        assert.equal(id, "123");
        next();
      });

      router.use("/foo/:id/bar", (req, res, next) => {
        assert.equal(req.params.id, "123");
        assert.equal(req.url, "/baz");
        next();
      });

      await new Promise((resolve, reject) => {
        router.handle(
          { url: "/foo/123/bar/baz", method: "get" },
          {},
          err => {
            if (err) return reject(err);
            resolve();
          },
        );
      });
    });

    it("should only call once per request", async () => {
      await new Promise((resolve, reject) => {
        let count = 0;
        const req = { url: "/foo/bob/bar", method: "get" };
        const router = new Router();
        const sub = new Router();

        sub.get("/bar", (req, res, next) => {
          next();
        });

        router.param("user", (req, res, next, user) => {
          count++;
          req.user = user;
          next();
        });

        router.use("/foo/:user/", new Router());
        router.use("/foo/:user/", sub);

        router.handle(req, {}, err => {
          if (err) return reject(err);
          assert.equal(count, 1);
          assert.equal(req.user, "bob");
          resolve();
        });
      });
    });

    it("should call when values differ", async () => {
      await new Promise((resolve, reject) => {
        let count = 0;
        const req = { url: "/foo/bob/bar", method: "get" };
        const router = new Router();
        const sub = new Router();

        sub.get("/bar", (req, res, next) => {
          next();
        });

        router.param("user", (req, res, next, user) => {
          count++;
          req.user = user;
          next();
        });

        router.use("/foo/:user/", new Router());
        router.use("/:user/bob/", sub);

        router.handle(req, {}, err => {
          if (err) return reject(err);
          assert.equal(count, 2);
          assert.equal(req.user, "foo");
          resolve();
        });
      });
    });
  });

  describe("parallel requests", () => {
    it("should not mix requests", async () => {
      await new Promise((resolve, reject) => {
        const req1 = { url: "/foo/50/bar", method: "get" };
        const req2 = { url: "/foo/10/bar", method: "get" };
        const router = new Router();
        const sub = new Router();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        sub.get("/bar", (req, res, next) => {
          next();
        });

        router.param("ms", (req, res, next, ms) => {
          ms = parseInt(ms, 10);
          req.ms = ms;
          setTimeout(next, ms);
        });

        router.use("/foo/:ms/", new Router());
        router.use("/foo/:ms/", sub);

        router.handle(req1, {}, err => {
          assert.ifError(err);
          assert.equal(req1.ms, 50);
          assert.equal(req1.originalUrl, "/foo/50/bar");
          cb();
        });

        router.handle(req2, {}, err => {
          assert.ifError(err);
          assert.equal(req2.ms, 10);
          assert.equal(req2.originalUrl, "/foo/10/bar");
          cb();
        });
      });
    });
  });
});
