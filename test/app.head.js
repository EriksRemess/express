"use strict";
var { describe, it } = require("node:test");
var express = require("../");
var request = require("supertest");
var assert = require("node:assert");

describe("HEAD", function () {
  it("should default to GET", async function () {
    var app = express();

    app.get("/tobi", function (req, res) {
      // send() detects HEAD
      res.send("tobi");
    });

    await request(app).head("/tobi").expect(200);
  });

  it("should output the same headers as GET requests", async function () {
    await new Promise((resolve, reject) => {
      var app = express();

      app.get("/tobi", function (req, res) {
        // send() detects HEAD
        res.send("tobi");
      });

      request(app)
        .head("/tobi")
        .expect(200, function (err, res) {
          if (err) return reject(err);
          var headers = res.headers;
          request(app)
            .get("/tobi")
            .expect(200, function (err, res) {
              if (err) return reject(err);
              delete headers.date;
              delete res.headers.date;
              assert.deepEqual(res.headers, headers);
              resolve();
            });
        });
    });
  });
});

describe("app.head()", function () {
  it("should override", async function () {
    var app = express();

    app.head("/tobi", function (req, res) {
      res.header("x-method", "head");
      res.end();
    });

    app.get("/tobi", function (req, res) {
      res.header("x-method", "get");
      res.send("tobi");
    });

    await request(app).head("/tobi").expect("x-method", "head").expect(200);
  });
});
