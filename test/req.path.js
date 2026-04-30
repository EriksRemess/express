"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("req", () => {
  describe(".path", () => {
    it("should return the parsed pathname", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.path);
      });

      await request(app)
        .get("/login?redirect=/post/1/comments")
        .expect("/login");
    });

    it("should ignore inherited parsed URL cache", async () => {
      const app = express();

      app.use((req, res) => {
        res.send({
          path: req.path,
          ownCache: Object.hasOwn(req, "_parsedUrl"),
        });
      });

      await withObjectPrototypeProperties({
        _parsedUrl: {
          _raw: "/login?redirect=/post/1/comments",
          path: "/polluted",
          pathname: "/polluted",
          query: null,
          search: null,
        },
      }, async () => {
        await request(app)
          .get("/login?redirect=/post/1/comments")
          .expect(200, {
            path: "/login",
            ownCache: true,
          });
      });
    });
  });
});
