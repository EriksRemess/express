"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");

describe("res", function () {
  describe(".get(field)", function () {
    it("should get the response header field", async function () {
      var app = express();

      app.use(function (req, res) {
        res.setHeader("Content-Type", "text/x-foo");
        res.send(res.get("Content-Type"));
      });

      await request(app).get("/").expect(200, "text/x-foo");
    });
  });
});
