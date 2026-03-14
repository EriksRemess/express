"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".path", function () {
    it("should return the parsed pathname", async function () {
      var app = express();

      app.use(function (req, res) {
        res.end(req.path);
      });

      await request(app)
        .get("/login?redirect=/post/1/comments")
        .expect("/login");
    });
  });
});
