"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".hostname", function () {
    it("should return the Host when present", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.hostname);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com")
        .expect("example.com");
    });

    it("should strip port number", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.hostname);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com:3000")
        .expect("example.com");
    });

    it("should return undefined otherwise", async function () {
      var app = express();

      app.use(function (req, res) {
        req.headers.host = null;
        res.end(String(req.hostname));
      });

      await request(app).post("/").expect("undefined");
    });

    it("should work with IPv6 Host", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.hostname);
      });

      await request(app).post("/").set("Host", "[::1]").expect("[::1]");
    });

    it("should work with IPv6 Host and port", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.hostname);
      });

      await request(app).post("/").set("Host", "[::1]:3000").expect("[::1]");
    });

    describe('when "trust proxy" is enabled', function () {
      it("should respect X-Forwarded-Host", async function () {
        var app = express();

        app.enable("trust proxy");

        app.use(function (req, res) {
          res.end(req.hostname);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "example.com:3000")
          .expect("example.com");
      });

      it("should ignore X-Forwarded-Host if socket addr not trusted", async function () {
        var app = express();

        app.set("trust proxy", "10.0.0.1");

        app.use(function (req, res) {
          res.end(req.hostname);
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
          res.end(req.hostname);
        });

        await request(app)
          .get("/")
          .set("Host", "example.com")
          .expect("example.com");
      });

      describe("when multiple X-Forwarded-Host", function () {
        it("should use the first value", async function () {
          var app = express();

          app.enable("trust proxy");

          app.use(function (req, res) {
            res.send(req.hostname);
          });

          await request(app)
            .get("/")
            .set("Host", "localhost")
            .set("X-Forwarded-Host", "example.com, foobar.com")
            .expect(200, "example.com");
        });

        it("should remove OWS around comma", async function () {
          var app = express();

          app.enable("trust proxy");

          app.use(function (req, res) {
            res.send(req.hostname);
          });

          await request(app)
            .get("/")
            .set("Host", "localhost")
            .set("X-Forwarded-Host", "example.com , foobar.com")
            .expect(200, "example.com");
        });

        it("should strip port number", async function () {
          var app = express();

          app.enable("trust proxy");

          app.use(function (req, res) {
            res.send(req.hostname);
          });

          await request(app)
            .get("/")
            .set("Host", "localhost")
            .set("X-Forwarded-Host", "example.com:8080 , foobar.com:8888")
            .expect(200, "example.com");
        });
      });
    });

    describe('when "trust proxy" is disabled', function () {
      it("should ignore X-Forwarded-Host", async function () {
        var app = express();

        app.use(function (req, res) {
          res.end(req.hostname);
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
