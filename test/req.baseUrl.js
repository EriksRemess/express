"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");

describe("req", function () {
  describe(".baseUrl", function () {
    it("should be empty for top-level route", async function () {
      var app = express();

      app.get("/:a", function (req, res) {
        res.end(req.baseUrl);
      });

      await request(app).get("/foo").expect(200, "");
    });

    it("should contain lower path", async function () {
      var app = express();
      var sub = express.Router();

      sub.get("/:b", function (req, res) {
        res.end(req.baseUrl);
      });
      app.use("/:a", sub);

      await request(app).get("/foo/bar").expect(200, "/foo");
    });

    it("should contain full lower path", async function () {
      var app = express();
      var sub1 = express.Router();
      var sub2 = express.Router();
      var sub3 = express.Router();

      sub3.get("/:d", function (req, res) {
        res.end(req.baseUrl);
      });
      sub2.use("/:c", sub3);
      sub1.use("/:b", sub2);
      app.use("/:a", sub1);

      await request(app).get("/foo/bar/baz/zed").expect(200, "/foo/bar/baz");
    });

    it("should travel through routers correctly", async function () {
      var urls = [];
      var app = express();
      var sub1 = express.Router();
      var sub2 = express.Router();
      var sub3 = express.Router();

      sub3.get("/:d", function (req, res, next) {
        urls.push("0@" + req.baseUrl);
        next();
      });
      sub2.use("/:c", sub3);
      sub1.use("/", function (req, res, next) {
        urls.push("1@" + req.baseUrl);
        next();
      });
      sub1.use("/bar", sub2);
      sub1.use("/bar", function (req, res, next) {
        urls.push("2@" + req.baseUrl);
        next();
      });
      app.use(function (req, res, next) {
        urls.push("3@" + req.baseUrl);
        next();
      });
      app.use("/:a", sub1);
      app.use(function (req, res, next) {
        urls.push("4@" + req.baseUrl);
        res.end(urls.join(","));
      });

      await request(app)
        .get("/foo/bar/baz/zed")
        .expect(200, "3@,1@/foo,0@/foo/bar/baz,2@/foo/bar,4@");
    });
  });
});
