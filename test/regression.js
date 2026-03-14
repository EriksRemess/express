"use strict";
var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");

describe("throw after .end()", function () {
  it("should fail gracefully", async function () {
    var app = express();

    app.get("/", function (req, res) {
      res.end("yay");
      throw new Error("boom");
    });

    await request(app).get("/").expect("yay").expect(200);
  });
});
