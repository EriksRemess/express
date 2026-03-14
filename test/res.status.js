"use strict";
var { describe, it } = require("node:test");
const express = require("../.");
const request = require("supertest");

describe("res", function () {
  describe(".status(code)", function () {
    it("should set the status code when valid", async function () {
      var app = express();

      app.use(function (req, res) {
        res.status(200).end();
      });

      await request(app).get("/").expect(200);
    });

    describe("accept valid ranges", function () {
      // not testing w/ 100, because that has specific meaning and behavior in Node as Expect: 100-continue
      it("should set the response status code to 101", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(101).end();
        });

        await request(app).get("/").expect(101);
      });

      it("should set the response status code to 201", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(201).end();
        });

        await request(app).get("/").expect(201);
      });

      it("should set the response status code to 302", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(302).end();
        });

        await request(app).get("/").expect(302);
      });

      it("should set the response status code to 403", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(403).end();
        });

        await request(app).get("/").expect(403);
      });

      it("should set the response status code to 501", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(501).end();
        });

        await request(app).get("/").expect(501);
      });

      it("should set the response status code to 700", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(700).end();
        });

        await request(app).get("/").expect(700);
      });

      it("should set the response status code to 800", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(800).end();
        });

        await request(app).get("/").expect(800);
      });

      it("should set the response status code to 900", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(900).end();
        });

        await request(app).get("/").expect(900);
      });
    });

    describe("invalid status codes", function () {
      it("should raise error for status code below 100", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(99).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for status code above 999", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(1000).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for non-integer status codes", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(200.1).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for undefined status code", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(undefined).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for null status code", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(null).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for string status code", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status("200").end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for NaN status code", async function () {
        var app = express();

        app.use(function (req, res) {
          res.status(NaN).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });
    });
  });
});
