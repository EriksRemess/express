"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".protocol", function () {
    it("should return the protocol string", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.protocol);
      });

      await request(app).get("/").expect("http");
    });

    describe('when "trust proxy" is enabled', function () {
      it("should respect X-Forwarded-Proto", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("https");
      });

      it("should default to the socket addr if X-Forwarded-Proto not present", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          req.socket.encrypted = true;
          res.end(req.protocol);
        });

        await request(app).get("/").expect("https");
      });

      it("should ignore X-Forwarded-Proto if socket addr not trusted", async function () {
        var app = express();

        app.set("trust proxy", "10.0.0.1");

        app.use(function (req, res) {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("http");
      });

      it("should default to http", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          res.end(req.protocol);
        });

        await request(app).get("/").expect("http");
      });

      describe("when trusting hop count", function () {
        it("should respect X-Forwarded-Proto", async function () {
          var app = express();

          app.set("trust proxy", 1);

          app.use(function (req, res) {
            res.end(req.protocol);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-Proto", "https")
            .expect("https");
        });
      });
    });

    describe('when "trust proxy" is disabled', function () {
      it("should ignore X-Forwarded-Proto", async function () {
        var app = express();

        app.use(function (req, res) {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("http");
      });
    });
  });
});
