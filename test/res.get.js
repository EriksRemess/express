"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".get(field)", () => {
    it("should get the response header field", async () => {
      const app = express();

      app.use((req, res) => {
        res.setHeader("Content-Type", "text/x-foo");
        res.send(res.get("Content-Type"));
      });

      await request(app).get("/").expect(200, "text/x-foo");
    });
  });
});
