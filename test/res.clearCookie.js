"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".clearCookie(name)", () => {
    it("should set a cookie passed expiry", async () => {
      const app = express();

      app.use((req, res) => {
        res.clearCookie("sid").end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });
  });

  describe(".clearCookie(name, options)", () => {
    it("should set the given params", async () => {
      const app = express();

      app.use((req, res) => {
        res.clearCookie("sid", { path: "/admin" }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });

    it("should ignore maxAge", async () => {
      const app = express();

      app.use((req, res) => {
        res.clearCookie("sid", { path: "/admin", maxAge: 1000 }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });

    it("should ignore user supplied expires param", async () => {
      const app = express();

      app.use((req, res) => {
        res.clearCookie("sid", { path: "/admin", expires: new Date() }).end();
      });

      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "sid=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )
        .expect(200);
    });
  });
});
