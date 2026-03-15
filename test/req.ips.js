"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".ips", () => {
    describe("when X-Forwarded-For is present", () => {
      describe('when "trust proxy" is enabled', () => {
        it("should return an array of the specified addresses", async () => {
          const app = express();

          app.enable("trust proxy");

          app.use((req, res, next) => {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect('["client","p1","p2"]');
        });

        it("should stop at first untrusted", async () => {
          const app = express();

          app.set("trust proxy", 2);

          app.use((req, res, next) => {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect('["p1","p2"]');
        });
      });

      describe('when "trust proxy" is disabled', () => {
        it("should return an empty array", async () => {
          const app = express();

          app.use((req, res, next) => {
            res.send(req.ips);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect("[]");
        });
      });
    });

    describe("when X-Forwarded-For is not present", () => {
      it("should return []", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.send(req.ips);
        });

        await request(app).get("/").expect("[]");
      });
    });
  });
});
