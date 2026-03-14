"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");
var utils = require("./support/utils");

describe("res.vary()", function () {
  describe("with no arguments", function () {
    it("should throw error", async function () {
      var app = express();

      app.use(function (req, res) {
        res.vary();
        res.end();
      });

      await request(app)
        .get("/")
        .expect(500, /field.*required/);
    });
  });

  describe("with an empty array", function () {
    it("should not set Vary", async function () {
      var app = express();

      app.use(function (req, res) {
        res.vary([]);
        res.end();
      });

      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Vary"))
        .expect(200);
    });
  });

  describe("with an array", function () {
    it("should set the values", async function () {
      var app = express();

      app.use(function (req, res) {
        res.vary(["Accept", "Accept-Language", "Accept-Encoding"]);
        res.end();
      });

      await request(app)
        .get("/")
        .expect("Vary", "Accept, Accept-Language, Accept-Encoding")
        .expect(200);
    });
  });

  describe("with a string", function () {
    it("should set the value", async function () {
      var app = express();

      app.use(function (req, res) {
        res.vary("Accept");
        res.end();
      });

      await request(app).get("/").expect("Vary", "Accept").expect(200);
    });
  });

  describe("when the value is present", function () {
    it("should not add it again", async function () {
      var app = express();

      app.use(function (req, res) {
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
