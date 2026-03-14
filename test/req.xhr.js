"use strict";
var { describe, it, before } = require("node:test");
var __testApp;
var express = require("../"),
  request = require("supertest");

describe("req", function () {
  describe(".xhr", function () {
    before(function () {
      __testApp = express();
      __testApp.get("/", function (req, res) {
        res.send(req.xhr);
      });
    });

    it("should return true when X-Requested-With is xmlhttprequest", async function () {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "xmlhttprequest")
        .expect(200, "true");
    });

    it("should case-insensitive", async function () {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "XMLHttpRequest")
        .expect(200, "true");
    });

    it("should return false otherwise", async function () {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "blahblah")
        .expect(200, "false");
    });

    it("should return false when not present", async function () {
      await request(__testApp).get("/").expect(200, "false");
    });
  });
});
