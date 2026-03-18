"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import utils from "#test/support/utils";

describe("res.vary()", () => {
  describe("with no arguments", () => {
    it("should throw error", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary();
        res.end();
      });

      await request(app)
        .get("/")
        .expect(500, /field.*required/);
    });
  });

  describe("with an empty array", () => {
    it("should not set Vary", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary([]);
        res.end();
      });

      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Vary"))
        .expect(200);
    });
  });

  describe("with an array", () => {
    it("should set the values", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary(["Accept", "Accept-Language", "Accept-Encoding"]);
        res.end();
      });

      await request(app)
        .get("/")
        .expect("Vary", "Accept, Accept-Language, Accept-Encoding")
        .expect(200);
    });

    it("should trim whitespace in array values", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary(["Accept", " Accept-Encoding "]);
        res.end();
      });

      await request(app)
        .get("/")
        .expect("Vary", "Accept, Accept-Encoding")
        .expect(200);
    });
  });

  describe("with a string", () => {
    it("should set the value", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary("Accept");
        res.end();
      });

      await request(app).get("/").expect("Vary", "Accept").expect(200);
    });
  });

  describe("when the value is present", () => {
    it("should not add it again", async () => {
      const app = express();

      app.use((req, res) => {
        res.vary("Accept");
        res.vary("Accept-Encoding");
        res.vary("Accept-Encoding");
        res.vary("Accept-Encoding");
        res.vary("Accept");
        res.end();
      });

      await request(app)
        .get("/")
        .expect("Vary", "Accept, Accept-Encoding")
        .expect(200);
    });
  });
});
