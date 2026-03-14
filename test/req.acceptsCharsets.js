"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".acceptsCharsets(type)", function () {
    describe("when Accept-Charset is not present", function () {
      it("should return true", async function () {
        var app = express();

        app.use(function (req, res, next) {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app).get("/").expect("yes");
      });
    });

    describe("when Accept-Charset is present", function () {
      it("should return true", async function () {
        var app = express();

        app.use(function (req, res, next) {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "foo, bar, utf-8")
          .expect("yes");
      });

      it("should return false otherwise", async function () {
        var app = express();

        app.use(function (req, res, next) {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "foo, bar")
          .expect("no");
      });

      it("should return the best matching charset from multiple inputs", async function () {
        var app = express();

        app.use(function (req, res, next) {
          res.end(req.acceptsCharsets("utf-8", "iso-8859-1"));
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "iso-8859-1, utf-8")
          .expect("iso-8859-1");
      });
    });
  });
});
