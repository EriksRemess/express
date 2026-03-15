"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".acceptsLanguages", () => {
    it("should return language if accepted", async () => {
      const app = express();

      app.get("/", (req, res) => {
        res.send({
          "en-us": req.acceptsLanguages("en-us"),
          en: req.acceptsLanguages("en"),
        });
      });

      await request(app)
        .get("/")
        .set("Accept-Language", "en;q=.5, en-us")
        .expect(200, { "en-us": "en-us", en: "en" });
    });

    it("should be false if language not accepted", async () => {
      const app = express();

      app.get("/", (req, res) => {
        res.send({
          es: req.acceptsLanguages("es"),
        });
      });

      await request(app)
        .get("/")
        .set("Accept-Language", "en;q=.5, en-us")
        .expect(200, { es: false });
    });

    describe("when Accept-Language is not present", () => {
      it("should always return language", async () => {
        const app = express();

        app.get("/", (req, res) => {
          res.send({
            en: req.acceptsLanguages("en"),
            es: req.acceptsLanguages("es"),
            jp: req.acceptsLanguages("jp"),
          });
        });

        await request(app)
          .get("/")
          .expect(200, { en: "en", es: "es", jp: "jp" });
      });
    });
  });
});
