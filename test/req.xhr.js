"use strict";
import {describe, it, before} from "node:test";
let __testApp;
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".xhr", () => {
    before(() => {
      __testApp = express();
      __testApp.get("/", (req, res) => {
        res.send(req.xhr);
      });
    });

    it("should return true when X-Requested-With is xmlhttprequest", async () => {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "xmlhttprequest")
        .expect(200, "true");
    });

    it("should case-insensitive", async () => {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "XMLHttpRequest")
        .expect(200, "true");
    });

    it("should return false otherwise", async () => {
      await request(__testApp)
        .get("/")
        .set("X-Requested-With", "blahblah")
        .expect(200, "false");
    });

    it("should return false when not present", async () => {
      await request(__testApp).get("/").expect(200, "false");
    });
  });
});
