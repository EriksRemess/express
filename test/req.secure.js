"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".secure", () => {
    describe("when X-Forwarded-Proto is missing", () => {
      it("should return false when http", async () => {
        const app = express();

        app.get("/", (req, res) => {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app).get("/").expect("no");
      });
    });
  });

  describe(".secure", () => {
    describe("when X-Forwarded-Proto is present", () => {
      it("should return false when http", async () => {
        const app = express();

        app.get("/", (req, res) => {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("no");
      });

      it('should return true when "trust proxy" is enabled', async () => {
        const app = express();

        app.enable("trust proxy");

        app.get("/", (req, res) => {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("yes");
      });

      it("should return false when initial proxy is http", async () => {
        const app = express();

        app.enable("trust proxy");

        app.get("/", (req, res) => {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "http, https")
          .expect("no");
      });

      it("should return true when initial proxy is https", async () => {
        const app = express();

        app.enable("trust proxy");

        app.get("/", (req, res) => {
          res.send(req.secure ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https, http")
          .expect("yes");
      });

      describe('when "trust proxy" trusting hop count', () => {
        it("should respect X-Forwarded-Proto", async () => {
          const app = express();

          app.set("trust proxy", 1);

          app.get("/", (req, res) => {
            res.send(req.secure ? "yes" : "no");
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-Proto", "https")
            .expect("yes");
        });
      });
    });
  });
});
