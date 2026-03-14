"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");

describe("req.is()", function () {
  describe("when given a mime type", function () {
    it("should return the type when matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("application/json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("image/jpeg"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("application/json"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });

  describe("when content-type is not present", function () {
    it("should return false", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("application/json"));
      });

      await request(app).post("/").send("{}").expect(200, "false");
    });
  });

  describe("when given an extension", function () {
    it("should lookup the mime type", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"json"');
    });
  });

  describe("when given */subtype", function () {
    it("should return the full type when matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("*/json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("*/html"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("*/json"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });

  describe("when given type/*", function () {
    it("should return the full type when matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("application/*"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("text/*"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.is("application/*"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });
});
