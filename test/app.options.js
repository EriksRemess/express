"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("OPTIONS", () => {
  it("should default to the routes defined", async () => {
    const app = express();

    app.post("/", () => {});
    app.get("/users", (req, res) => {});
    app.put("/users", (req, res) => {});

    await request(app)
      .options("/users")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should only include each method once", async () => {
    const app = express();

    app.delete("/", () => {});
    app.get("/users", (req, res) => {});
    app.put("/users", (req, res) => {});
    app.get("/users", (req, res) => {});

    await request(app)
      .options("/users")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should not be affected by app.all", async () => {
    const app = express();

    app.get("/", () => {});
    app.get("/users", (req, res) => {});
    app.put("/users", (req, res) => {});
    app.all("/users", (req, res, next) => {
      res.setHeader("x-hit", "1");
      next();
    });

    await request(app)
      .options("/users")
      .expect("x-hit", "1")
      .expect("Allow", "GET, HEAD, PUT")
      .expect(200, "GET, HEAD, PUT");
  });

  it("should not respond if the path is not defined", async () => {
    const app = express();

    app.get("/users", (req, res) => {});

    await request(app).options("/other").expect(404);
  });

  it("should forward requests down the middleware chain", async () => {
    const app = express();
    const router = new express.Router();

    router.get("/users", (req, res) => {});
    app.use(router);
    app.get("/other", (req, res) => {});

    await request(app)
      .options("/other")
      .expect("Allow", "GET, HEAD")
      .expect(200, "GET, HEAD");
  });

  describe("when error occurs in response handler", () => {
    it("should pass error to callback", async () => {
      const app = express();
      const router = express.Router();

      router.get("/users", (req, res) => {});

      app.use((req, res, next) => {
        res.writeHead(200);
        next();
      });
      app.use(router);
      app.use((err, req, res, next) => {
        res.end("true");
      });

      await request(app).options("/users").expect(200, "true");
    });
  });
});

describe("app.options()", () => {
  it("should override the default behavior", async () => {
    const app = express();

    app.options("/users", (req, res) => {
      res.set("Allow", "GET");
      res.send("GET");
    });

    app.get("/users", (req, res) => {});
    app.put("/users", (req, res) => {});

    await request(app).options("/users").expect("GET").expect("Allow", "GET");
  });
});
