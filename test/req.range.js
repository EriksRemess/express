"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var request = require("supertest");

describe("req", function () {
  describe(".range(size)", function () {
    it("should return parsed ranges", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.range(120));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-50,51-100")
        .expect(200, '[{"start":0,"end":50},{"start":51,"end":100}]');
    });

    it("should cap to the given size", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.range(75));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-100")
        .expect(200, '[{"start":0,"end":74}]');
    });

    it("should cap to the given size when open-ended", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.range(75));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-")
        .expect(200, '[{"start":0,"end":74}]');
    });

    it("should have a .type", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.range(120).type);
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-100")
        .expect(200, '"bytes"');
    });

    it("should accept any type", async function () {
      var app = express();

      app.use(function (req, res) {
        res.json(req.range(120).type);
      });

      await request(app)
        .get("/")
        .set("Range", "users=0-2")
        .expect(200, '"users"');
    });

    it("should return undefined if no range", async function () {
      var app = express();

      app.use(function (req, res) {
        res.send(String(req.range(120)));
      });

      await request(app).get("/").expect(200, "undefined");
    });
  });

  describe(".range(size, options)", function () {
    describe('with "combine: true" option', function () {
      it("should return combined ranges", async function () {
        var app = express();

        app.use(function (req, res) {
          res.json(
            req.range(120, {
              combine: true,
            }),
          );
        });

        await request(app)
          .get("/")
          .set("Range", "bytes=0-50,51-100")
          .expect(200, '[{"start":0,"end":100}]');
      });
    });
  });
});
