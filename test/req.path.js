"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

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
  });
});
