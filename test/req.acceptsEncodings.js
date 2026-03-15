"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".acceptsEncodings", () => {
    it("should return encoding if accepted", async () => {
      const app = express();

      app.get("/", (req, res) => {
        res.send({
          gzip: req.acceptsEncodings("gzip"),
          deflate: req.acceptsEncodings("deflate"),
        });
      });

      await request(app)
        .get("/")
        .set("Accept-Encoding", " gzip, deflate")
        .expect(200, { gzip: "gzip", deflate: "deflate" });
    });

    it("should be false if encoding not accepted", async () => {
      const app = express();

      app.get("/", (req, res) => {
        res.send({
          bogus: req.acceptsEncodings("bogus"),
        });
      });

      await request(app)
        .get("/")
        .set("Accept-Encoding", " gzip, deflate")
        .expect(200, { bogus: false });
    });
  });
});
