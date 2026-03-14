"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");

describe("res", function () {
  describe(".sendStatus(statusCode)", function () {
    it("should send the status code and message as body", async function () {
      var app = express();

      app.use(function (req, res) {
        res.sendStatus(201);
      });

      await request(app).get("/").expect(201, "Created");
    });

    it("should work with unknown code", async function () {
      var app = express();

      app.use(function (req, res) {
        res.sendStatus(599);
      });

      await request(app).get("/").expect(599, "599");
    });

    it("should raise error for invalid status code", async function () {
      var app = express();

      app.use(function (req, res) {
        res.sendStatus(undefined).end();
      });

      await request(app)
        .get("/")
        .expect(500, /TypeError: Invalid status code/);
    });
  });
});
