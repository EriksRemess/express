"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".baseUrl", () => {
    it("should be empty for top-level route", async () => {
      const app = express();

      app.get("/:a", (req, res) => {
        res.end(req.baseUrl);
      });

      await request(app).get("/foo").expect(200, "");
    });

    it("should contain lower path", async () => {
      const app = express();
      const sub = express.Router();

      sub.get("/:b", (req, res) => {
        res.end(req.baseUrl);
      });
      app.use("/:a", sub);

      await request(app).get("/foo/bar").expect(200, "/foo");
    });

    it("should contain full lower path", async () => {
      const app = express();
      const sub1 = express.Router();
      const sub2 = express.Router();
      const sub3 = express.Router();

      sub3.get("/:d", (req, res) => {
        res.end(req.baseUrl);
      });
      sub2.use("/:c", sub3);
      sub1.use("/:b", sub2);
      app.use("/:a", sub1);

      await request(app).get("/foo/bar/baz/zed").expect(200, "/foo/bar/baz");
    });

    it("should travel through routers correctly", async () => {
      const urls = [];
      const app = express();
      const sub1 = express.Router();
      const sub2 = express.Router();
      const sub3 = express.Router();

      sub3.get("/:d", (req, res, next) => {
        urls.push("0@" + req.baseUrl);
        next();
      });
      sub2.use("/:c", sub3);
      sub1.use("/", (req, res, next) => {
        urls.push("1@" + req.baseUrl);
        next();
      });
      sub1.use("/bar", sub2);
      sub1.use("/bar", (req, res, next) => {
        urls.push("2@" + req.baseUrl);
        next();
      });
      app.use((req, res, next) => {
        urls.push("3@" + req.baseUrl);
        next();
      });
      app.use("/:a", sub1);
      app.use((req, res, next) => {
        urls.push("4@" + req.baseUrl);
        res.end(urls.join(","));
      });

      await request(app)
        .get("/foo/bar/baz/zed")
        .expect(200, "3@,1@/foo,0@/foo/bar/baz,2@/foo/bar,4@");
    });
  });
});
