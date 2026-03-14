"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".acceptsLanguages", function () {
    it("should return language if accepted", async function () {
      var app = express();

      app.get("/", function (req, res) {
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

    it("should be false if language not accepted", async function () {
      var app = express();

      app.get("/", function (req, res) {
        res.send({
          es: req.acceptsLanguages("es"),
        });
      });

      await request(app)
        .get("/")
        .set("Accept-Language", "en;q=.5, en-us")
        .expect(200, { es: false });
    });

    describe("when Accept-Language is not present", function () {
      it("should always return language", async function () {
        var app = express();

        app.get("/", function (req, res) {
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
