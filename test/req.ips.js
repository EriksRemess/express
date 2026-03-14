"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".ips", function () {
    describe("when X-Forwarded-For is present", function () {
      describe('when "trust proxy" is enabled', function () {
        it("should return an array of the specified addresses", async function () {
          var app = express();

          app.enable("trust proxy");

          app.use(function (req, res, next) {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect('["client","p1","p2"]');
        });

        it("should stop at first untrusted", async function () {
          var app = express();

          app.set("trust proxy", 2);

          app.use(function (req, res, next) {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect('["p1","p2"]');
        });
      });

      describe('when "trust proxy" is disabled', function () {
        it("should return an empty array", async function () {
          var app = express();

          app.use(function (req, res, next) {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect("[]");
        });
      });
    });

    describe("when X-Forwarded-For is not present", function () {
      it("should return []", async function () {
        var app = express();

        app.use(function (req, res, next) {
          res.send(req.ips);
        });

        await request(app).get("/").expect("[]");
      });
    });
  });
});
