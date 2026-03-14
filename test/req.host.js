"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".host", function () {
    it("should return the Host when present", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com")
        .expect("example.com");
    });

    it("should strip port number", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com:3000")
        .expect(200, "example.com:3000");
    });

    it("should return undefined otherwise", async function () {
      var app = express();

      app.use(function (req, res) {
        req.headers.host = null;
        res.end(String(req.host));
      });

      await request(app).post("/").expect("undefined");
    });

    it("should work with IPv6 Host", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.host);
      });

      await request(app).post("/").set("Host", "[::1]").expect("[::1]");
    });

    it("should work with IPv6 Host and port", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "[::1]:3000")
        .expect(200, "[::1]:3000");
    });

    describe('when "trust proxy" is enabled', function () {
      it("should respect X-Forwarded-Host", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "example.com")
          .expect("example.com");
      });

      it("should ignore X-Forwarded-Host if socket addr not trusted", async function () {
        var app = express();

        app.set("trust proxy", "10.0.0.1");

        app.use(function (req, res) {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "example.com")
          .expect("localhost");
      });

      it("should default to Host", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "example.com")
          .expect("example.com");
      });

      describe("when trusting hop count", function () {
        it("should respect X-Forwarded-Host", async function () {
          var app = express();

          app.set("trust proxy", 1);

          app.use(function (req, res) {
            res.end(req.host);
          });

          await request(app)
            .get("/")
            .set("Host", "localhost")
            .set("X-Forwarded-Host", "example.com")
            .expect("example.com");
        });
      });
    });

    describe('when "trust proxy" is disabled', function () {
      it("should ignore X-Forwarded-Host", async function () {
        var app = express();

        app.use(function (req, res) {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "evil")
          .expect("localhost");
      });
    });
  });
});
