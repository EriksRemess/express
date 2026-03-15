"use strict";
import {describe, it} from "node:test";
import after from "#test/support/after";
import assert from "node:assert";
import express from "#express";
import request from "supertest";

describe("app", () => {
  it('should emit "mount" when mounted', async () => {
    await new Promise((resolve, reject) => {
      const blog = express(), app = express();

      blog.on("mount", arg => {
        assert.strictEqual(arg, app);
        resolve();
      });

      app.use(blog);
    });
  });

  describe(".use(app)", () => {
    it("should mount the app", async () => {
      const blog = express(), app = express();

      blog.get("/blog", (req, res) => {
        res.end("blog");
      });

      app.use(blog);

      await request(app).get("/blog").expect("blog");
    });

    it("should support mount-points", async () => {
      await new Promise((resolve, reject) => {
        const blog = express(), forum = express(), app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        blog.get("/", (req, res) => {
          res.end("blog");
        });

        forum.get("/", (req, res) => {
          res.end("forum");
        });

        app.use("/blog", blog);
        app.use("/forum", forum);

        request(app).get("/blog").expect(200, "blog", cb);

        request(app).get("/forum").expect(200, "forum", cb);
      });
    });

    it("should set the child's .parent", () => {
      const blog = express(), app = express();

      app.use("/blog", blog);
      assert.strictEqual(blog.parent, app);
    });

    it("should support dynamic routes", async () => {
      const blog = express(), app = express();

      blog.get("/", (req, res) => {
        res.end("success");
      });

      app.use("/post/:article", blog);

      await request(app).get("/post/once-upon-a-time").expect("success");
    });

    it("should support mounted app anywhere", async () => {
      await new Promise((resolve, reject) => {
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const blog = express(), other = express(), app = express();

        function fn1(req, res, next) {
          res.setHeader("x-fn-1", "hit");
          next();
        }

        function fn2(req, res, next) {
          res.setHeader("x-fn-2", "hit");
          next();
        }

        blog.get("/", (req, res) => {
          res.end("success");
        });

        blog.once("mount", parent => {
          assert.strictEqual(parent, app);
          cb();
        });
        other.once("mount", parent => {
          assert.strictEqual(parent, app);
          cb();
        });

        app.use("/post/:article", fn1, other, fn2, blog);

        request(app)
          .get("/post/once-upon-a-time")
          .expect("x-fn-1", "hit")
          .expect("x-fn-2", "hit")
          .expect("success", cb);
      });
    });
  });

  describe(".use(middleware)", () => {
    it("should accept multiple arguments", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      app.use(fn1, fn2, function fn3(req, res) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      });

      await request(app)
        .get("/")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should invoke middleware for all requests", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use((req, res) => {
          res.send("saw " + req.method + " " + req.url);
        });

        request(app).get("/").expect(200, "saw GET /", cb);

        request(app).options("/").expect(200, "saw OPTIONS /", cb);

        request(app).post("/foo").expect(200, "saw POST /foo", cb);
      });
    });

    it("should accept array of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use([fn1, fn2, fn3]);

      await request(app)
        .get("/")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should accept multiple arrays of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use([fn1, fn2], [fn3]);

      await request(app)
        .get("/")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should accept nested arrays of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use([[fn1], fn2], [fn3]);

      await request(app)
        .get("/")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });
  });

  describe(".use(path, middleware)", () => {
    it("should require middleware", () => {
      const app = express();
      assert.throws(() => {
        app.use("/");
      }, "TypeError: app.use() requires a middleware function");
    });

    it("should reject string as middleware", () => {
      const app = express();
      assert.throws(() => {
        app.use("/", "foo");
      }, /argument handler must be a function/);
    });

    it("should reject number as middleware", () => {
      const app = express();
      assert.throws(() => {
        app.use("/", 42);
      }, /argument handler must be a function/);
    });

    it("should reject null as middleware", () => {
      const app = express();
      assert.throws(() => {
        app.use("/", null);
      }, /argument handler must be a function/);
    });

    it("should reject Date as middleware", () => {
      const app = express();
      assert.throws(() => {
        app.use("/", new Date());
      }, /argument handler must be a function/);
    });

    it("should strip path from req.url", async () => {
      const app = express();

      app.use("/foo", (req, res) => {
        res.send("saw " + req.method + " " + req.url);
      });

      await request(app).get("/foo/bar").expect(200, "saw GET /bar");
    });

    it("should accept multiple arguments", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      app.use("/foo", fn1, fn2, function fn3(req, res) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      });

      await request(app)
        .get("/foo")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should invoke middleware for all requests starting with path", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use("/foo", (req, res) => {
          res.send("saw " + req.method + " " + req.url);
        });

        request(app).get("/").expect(404, cb);

        request(app).post("/foo").expect(200, "saw POST /", cb);

        request(app).post("/foo/bar").expect(200, "saw POST /bar", cb);
      });
    });

    it("should work if path has trailing slash", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use("/foo/", (req, res) => {
          res.send("saw " + req.method + " " + req.url);
        });

        request(app).get("/").expect(404, cb);

        request(app).post("/foo").expect(200, "saw POST /", cb);

        request(app).post("/foo/bar").expect(200, "saw POST /bar", cb);
      });
    });

    it("should accept array of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use("/foo", [fn1, fn2, fn3]);

      await request(app)
        .get("/foo")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should accept multiple arrays of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use("/foo", [fn1, fn2], [fn3]);

      await request(app)
        .get("/foo")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should accept nested arrays of middleware", async () => {
      const app = express();

      function fn1(req, res, next) {
        res.setHeader("x-fn-1", "hit");
        next();
      }

      function fn2(req, res, next) {
        res.setHeader("x-fn-2", "hit");
        next();
      }

      function fn3(req, res, next) {
        res.setHeader("x-fn-3", "hit");
        res.end();
      }

      app.use("/foo", [fn1, [fn2]], [fn3]);

      await request(app)
        .get("/foo")
        .expect("x-fn-1", "hit")
        .expect("x-fn-2", "hit")
        .expect("x-fn-3", "hit")
        .expect(200);
    });

    it("should support array of paths", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use(["/foo/", "/bar"], (req, res) => {
          res.send(
            "saw " + req.method + " " + req.url + " through " + req.originalUrl,
          );
        });

        request(app).get("/").expect(404, cb);

        request(app).get("/foo").expect(200, "saw GET / through /foo", cb);

        request(app).get("/bar").expect(200, "saw GET / through /bar", cb);
      });
    });

    it("should support array of paths with middleware array", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        function fn1(req, res, next) {
          res.setHeader("x-fn-1", "hit");
          next();
        }

        function fn2(req, res, next) {
          res.setHeader("x-fn-2", "hit");
          next();
        }

        function fn3(req, res, next) {
          res.setHeader("x-fn-3", "hit");
          res.send(
            "saw " + req.method + " " + req.url + " through " + req.originalUrl,
          );
        }

        app.use(["/foo/", "/bar"], [[fn1], fn2], [fn3]);

        request(app)
          .get("/foo")
          .expect("x-fn-1", "hit")
          .expect("x-fn-2", "hit")
          .expect("x-fn-3", "hit")
          .expect(200, "saw GET / through /foo", cb);

        request(app)
          .get("/bar")
          .expect("x-fn-1", "hit")
          .expect("x-fn-2", "hit")
          .expect("x-fn-3", "hit")
          .expect(200, "saw GET / through /bar", cb);
      });
    });

    it("should support regexp path", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(4, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app.use(/^\/[a-z]oo/, (req, res) => {
          res.send(
            "saw " + req.method + " " + req.url + " through " + req.originalUrl,
          );
        });

        request(app).get("/").expect(404, cb);

        request(app).get("/foo").expect(200, "saw GET / through /foo", cb);

        request(app)
          .get("/zoo/bear")
          .expect(200, "saw GET /bear through /zoo/bear", cb);

        request(app).get("/get/zoo").expect(404, cb);
      });
    });

    it("should support empty string path", async () => {
      const app = express();

      app.use("", (req, res) => {
        res.send(
          "saw " + req.method + " " + req.url + " through " + req.originalUrl,
        );
      });

      await request(app).get("/").expect(200, "saw GET / through /");
    });
  });
});
