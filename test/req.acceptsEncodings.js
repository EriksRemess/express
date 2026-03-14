"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".acceptsEncodings", function () {
    it("should return encoding if accepted", async function () {
      var app = express();

      app.get("/", function (req, res) {
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

    it("should be false if encoding not accepted", async function () {
      var app = express();

      app.get("/", function (req, res) {
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
