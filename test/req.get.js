"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import assert from "node:assert";

describe("req", () => {
  describe(".get(field)", () => {
    it("should return the header field value", async () => {
      const app = express();

      app.use((req, res) => {
        assert(req.get("Something-Else") === undefined);
        res.end(req.get("Content-Type"));
      });

      await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .expect("application/json");
    });

    it("should special-case Referer", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.get("Referer"));
      });

      await request(app)
        .post("/")
        .set("Referrer", "http://foobar.com")
        .expect("http://foobar.com");
    });

    it("should throw missing header name", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.get());
      });

      await request(app)
        .get("/")
        .expect(500, /TypeError: name argument is required to req.get/);
    });

    it("should throw for non-string header name", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.get(42));
      });

      await request(app)
        .get("/")
        .expect(500, /TypeError: name must be a string to req.get/);
    });
  });
});
