"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".stale", function () {
    it("should return false when the resource is not modified", async function () {
      var app = express();
      var etag = '"12345"';

      app.use(function (req, res) {
        res.set("ETag", etag);
        res.send(req.stale);
      });

      await request(app).get("/").set("If-None-Match", etag).expect(304);
    });

    it("should return true when the resource is modified", async function () {
      var app = express();

      app.use(function (req, res) {
        res.set("ETag", '"123"');
        res.send(req.stale);
      });

      await request(app)
        .get("/")
        .set("If-None-Match", '"12345"')
        .expect(200, "true");
    });

    it("should return true without response headers", async function () {
      var app = express();

      app.disable("x-powered-by");
      app.use(function (req, res) {
        res.send(req.stale);
      });

      await request(app).get("/").expect(200, "true");
    });
  });
});
