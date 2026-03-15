"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".locals", () => {
    it("should be empty by default", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(res.locals);
      });

      await request(app).get("/").expect(200, {});
    });
  });

  it("should work when mounted", async () => {
    const app = express();
    const blog = express();

    app.use(blog);

    blog.use((req, res, next) => {
      res.locals.foo = "bar";
      next();
    });

    app.use((req, res) => {
      res.json(res.locals);
    });

    await request(app).get("/").expect(200, { foo: "bar" });
  });
});
