"use strict";

var { describe, it } = require("node:test");
var express = require("../"),
  request = require("supertest");
describe("res", function () {
  describe(".type(str)", function () {
    it("should set the Content-Type based on a filename", async function () {
      var app = express();
      app.use(function (req, res) {
        res.type("foo.js").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/javascript; charset=utf-8");
    });
    it("should default to application/octet-stream", async function () {
      var app = express();
      app.use(function (req, res) {
        res.type("rawr").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/octet-stream");
    });
    it("should set the Content-Type with type/subtype", async function () {
      var app = express();
      app.use(function (req, res) {
        res.type("application/vnd.amazon.ebook").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/vnd.amazon.ebook");
    });
    describe("edge cases", function () {
      it("should handle empty string gracefully", async function () {
        var app = express();
        app.use(function (req, res) {
          res.type("").end("test");
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/octet-stream");
      });
      it("should handle file extension with dots", async function () {
        var app = express();
        app.use(function (req, res) {
          res.type(".json").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
      it("should handle multiple file extensions", async function () {
        var app = express();
        app.use(function (req, res) {
          res.type("file.tar.gz").end("compressed");
        });
        await request(app).get("/").expect("Content-Type", "application/gzip");
      });
      it("should handle uppercase extensions", async function () {
        var app = express();
        app.use(function (req, res) {
          res.type("FILE.JSON").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
      it("should handle extension with special characters", async function () {
        var app = express();
        app.use(function (req, res) {
          res.type("file@test.json").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
    });
  });
});
