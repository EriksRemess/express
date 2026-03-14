"use strict";
var { describe, it } = require("node:test");
const { Buffer } = require("node:buffer");
var express = require("../"),
  request = require("supertest");

describe("res", function () {
  describe(".attachment()", function () {
    it("should Content-Disposition to attachment", async function () {
      var app = express();

      app.use(function (req, res) {
        res.attachment().send("foo");
      });

      await request(app).get("/").expect("Content-Disposition", "attachment");
    });
  });

  describe(".attachment(filename)", function () {
    it("should add the filename param", async function () {
      var app = express();

      app.use(function (req, res) {
        res.attachment("/path/to/image.png");
        res.send("foo");
      });

      await request(app)
        .get("/")
        .expect("Content-Disposition", 'attachment; filename="image.png"');
    });

    it("should set the Content-Type", async function () {
      var app = express();

      app.use(function (req, res) {
        res.attachment("/path/to/image.png");
        res.send(Buffer.alloc(4, "."));
      });

      await request(app).get("/").expect("Content-Type", "image/png");
    });
  });

  describe(".attachment(utf8filename)", function () {
    it("should add the filename and filename* params", async function () {
      var app = express();

      app.use(function (req, res) {
        res.attachment("/locales/日本語.txt");
        res.send("japanese");
      });

      await request(app)
        .get("/")
        .expect(
          "Content-Disposition",
          "attachment; filename=\"???.txt\"; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.txt",
        )
        .expect(200);
    });

    it("should set the Content-Type", async function () {
      var app = express();

      app.use(function (req, res) {
        res.attachment("/locales/日本語.txt");
        res.send("japanese");
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8");
    });
  });
});
