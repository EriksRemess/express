"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("app", () => {
  describe(".param(names, fn)", () => {
    it("should map the array", async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.param(["id", "uid"], (req, res, next, id) => {
          id = Number(id);
          if (isNaN(id)) return next("route");
          req.params.id = id;
          next();
        });

        app.get("/post/:id", (req, res) => {
          const id = req.params.id;
          res.send(typeof id + ":" + id);
        });

        app.get("/user/:uid", (req, res) => {
          const id = req.params.id;
          res.send(typeof id + ":" + id);
        });

        request(app)
          .get("/user/123")
          .expect(200, "number:123", err => {
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

  describe(".param(name, fn)", () => {
    it("should map logic for a single param", async () => {
      const app = express();

      app.param("id", (req, res, next, id) => {
        id = Number(id);
        if (isNaN(id)) return next("route");
        req.params.id = id;
        next();
      });

      app.get("/user/:id", (req, res) => {
        const id = req.params.id;
        res.send(typeof id + ":" + id);
      });

      await request(app).get("/user/123").expect(200, "number:123");
    });

    it("should map prototype-named params", async () => {
      const app = express();
      const seen = [];

      app.param("__proto__", (req, res, next, value, name) => {
        seen.push([name, value]);
        next();
      });

      app.param("constructor", (req, res, next, value, name) => {
        seen.push([name, value]);
        next();
      });

      app.get("/:constructor/:__proto__", (req, res) => {
        res.send(seen);
      });

      await request(app)
        .get("/thing/value")
        .expect(200, '[["constructor","thing"],["__proto__","value"]]');
    });

    it("should only call once per request", async () => {
      const app = express();
      let called = 0;
      let count = 0;

      app.param("user", (req, res, next, user) => {
        called++;
        req.user = user;
        next();
      });

      app.get("/foo/:user", (req, res, next) => {
        count++;
        next();
      });
      app.get("/foo/:user", (req, res, next) => {
        count++;
        next();
      });
      app.use((req, res) => {
        res.end([count, called, req.user].join(" "));
      });

      await request(app).get("/foo/bob").expect("2 1 bob");
    });

    it("should call when values differ", async () => {
      const app = express();
      let called = 0;
      let count = 0;

      app.param("user", (req, res, next, user) => {
        called++;
        req.users = (req.users || []).concat(user);
        next();
      });

      app.get("/:user/bob", (req, res, next) => {
        count++;
        next();
      });
      app.get("/foo/:user", (req, res, next) => {
        count++;
        next();
      });
      app.use((req, res) => {
        res.end([count, called, req.users.join(",")].join(" "));
      });

      await request(app).get("/foo/bob").expect("2 2 foo,bob");
    });

    it("should support altering req.params across routes", async () => {
      const app = express();

      app.param("user", (req, res, next, user) => {
        req.params.user = "loki";
        next();
      });

      app.get("/:user", (req, res, next) => {
        next("route");
      });
      app.get("/:user", (req, res) => {
        res.send(req.params.user);
      });

      await request(app).get("/bob").expect("loki");
    });

    it("should not invoke without route handler", async () => {
      const app = express();

      app.param("thing", (req, res, next, thing) => {
        req.thing = thing;
        next();
      });

      app.param("user", (req, res, next, user) => {
        next(new Error("invalid invocation"));
      });

      app.post("/:user", (req, res) => {
        res.send(req.params.user);
      });

      app.get("/:thing", (req, res) => {
        res.send(req.thing);
      });

      await request(app).get("/bob").expect(200, "bob");
    });

    it("should work with encoded values", async () => {
      const app = express();

      app.param("name", (req, res, next, name) => {
        req.params.name = name;
        next();
      });

      app.get("/user/:name", (req, res) => {
        const name = req.params.name;
        res.send("" + name);
      });

      await request(app).get("/user/foo%25bar").expect("foo%bar");
    });

    it("should catch thrown error", async () => {
      const app = express();

      app.param("id", (req, res, next, id) => {
        throw new Error("err!");
      });

      app.get("/user/:id", (req, res) => {
        const id = req.params.id;
        res.send("" + id);
      });

      await request(app).get("/user/123").expect(500);
    });

    it("should catch thrown secondary error", async () => {
      const app = express();

      app.param("id", (req, res, next, val) => {
        process.nextTick(next);
      });

      app.param("id", (req, res, next, id) => {
        throw new Error("err!");
      });

      app.get("/user/:id", (req, res) => {
        const id = req.params.id;
        res.send("" + id);
      });

      await request(app).get("/user/123").expect(500);
    });

    it("should defer to next route", async () => {
      const app = express();

      app.param("id", (req, res, next, id) => {
        next("route");
      });

      app.get("/user/:id", (req, res) => {
        const id = req.params.id;
        res.send("" + id);
      });

      app.get("/:name/123", (req, res) => {
        res.send("name");
      });

      await request(app).get("/user/123").expect("name");
    });

    it("should defer all the param routes", async () => {
      const app = express();

      app.param("id", (req, res, next, val) => {
        if (val === "new") return next("route");
        return next();
      });

      app.all("/user/:id", (req, res) => {
        res.send("all.id");
      });

      app.get("/user/:id", (req, res) => {
        res.send("get.id");
      });

      app.get("/user/new", (req, res) => {
        res.send("get.new");
      });

      await request(app).get("/user/new").expect("get.new");
    });

    it("should not call when values differ on error", async () => {
      const app = express();
      let called = 0;
      let count = 0;

      app.param("user", (req, res, next, user) => {
        called++;
        if (user === "foo") throw new Error("err!");
        req.user = user;
        next();
      });

      app.get("/:user/bob", (req, res, next) => {
        count++;
        next();
      });
      app.get("/foo/:user", (req, res, next) => {
        count++;
        next();
      });

      app.use((err, req, res, next) => {
        res.status(500);
        res.send([count, called, err.message].join(" "));
      });

      await request(app).get("/foo/bob").expect(500, "0 1 err!");
    });

    it('should call when values differ when using "next"', async () => {
      const app = express();
      let called = 0;
      let count = 0;

      app.param("user", (req, res, next, user) => {
        called++;
        if (user === "foo") return next("route");
        req.user = user;
        next();
      });

      app.get("/:user/bob", (req, res, next) => {
        count++;
        next();
      });
      app.get("/foo/:user", (req, res, next) => {
        count++;
        next();
      });
      app.use((req, res) => {
        res.end([count, called, req.user].join(" "));
      });

      await request(app).get("/foo/bob").expect("1 2 bob");
    });
  });
});
