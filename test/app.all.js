"use strict";
var { describe, it } = require("node:test");
var after = require("after");
var express = require("../"),
  request = require("supertest");

describe("app.all()", function () {
  it("should add a router per method", async function () {
    await new Promise((resolve, reject) => {
      var app = express();
      var cb = after(2, function (err) {
        if (err) {
          return reject(err);
        }
        resolve();
      });

      app.all("/tobi", function (req, res) {
        res.end(req.method);
      });

      request(app).put("/tobi").expect(200, "PUT", cb);

      request(app).get("/tobi").expect(200, "GET", cb);
    });
  });

  it("should run the callback for a method just once", async function () {
    await new Promise((resolve, reject) => {
      var app = express(),
        n = 0;

      app.all("/*splat", function (req, res, next) {
        if (n++) return reject(new Error("DELETE called several times"));
        next();
      });

      request(app)
        .del("/tobi")
        .expect(404, (err) => {
          if (err != null) {
            reject(err);
            return;
          }
          resolve();
        });
    });
  });
});
