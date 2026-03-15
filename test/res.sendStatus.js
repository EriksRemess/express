"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".sendStatus(statusCode)", () => {
    it("should send the status code and message as body", async () => {
      const app = express();

      app.use((req, res) => {
        res.sendStatus(201);
      });

      await request(app).get("/").expect(201, "Created");
    });

    it("should work with unknown code", async () => {
      const app = express();

      app.use((req, res) => {
        res.sendStatus(599);
      });

      await request(app).get("/").expect(599, "599");
    });

    it("should raise error for invalid status code", async () => {
      const app = express();

      app.use((req, res) => {
        res.sendStatus(undefined).end();
      });

      await request(app)
        .get("/")
        .expect(500, /TypeError: Invalid status code/);
    });
  });
});
