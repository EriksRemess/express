"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".secure", function () {
    describe("when X-Forwarded-Proto is missing", function () {
      it("should return false when http", async function () {
        var app = express();

        app.get("/", function (req, res) {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app).get("/").expect("no");
      });
    });
  });

  describe(".secure", function () {
    describe("when X-Forwarded-Proto is present", function () {
      it("should return false when http", async function () {
        var app = express();

        app.get("/", function (req, res) {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("no");
      });

      it('should return true when "trust proxy" is enabled', async function () {
        var app = express();

        app.enable("trust proxy");

        app.get("/", function (req, res) {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("yes");
      });

      it("should return false when initial proxy is http", async function () {
        var app = express();

        app.enable("trust proxy");

        app.get("/", function (req, res) {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "http, https")
          .expect("no");
      });

      it("should return true when initial proxy is https", async function () {
        var app = express();

        app.enable("trust proxy");

        app.get("/", function (req, res) {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https, http")
          .expect("yes");
      });

      describe('when "trust proxy" trusting hop count', function () {
        it("should respect X-Forwarded-Proto", async function () {
          var app = express();

          app.set("trust proxy", 1);

          app.get("/", function (req, res) {
            res.send(req.secure ? "yes" : "no");
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-Proto", "https")
            .expect("yes");
        });
      });
    });
  });
});
