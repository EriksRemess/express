"use strict";

import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
describe("req", () => {
  describe(".ip", () => {
    describe("when X-Forwarded-For is present", () => {
      describe('when "trust proxy" is enabled', () => {
        it("should return the client addr", async () => {
          const app = express();
          app.enable("trust proxy");
          app.use((req, res, next) => {
            res.send(req.ip);
          });
          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect("client");
        });
        it("should return the addr after trusted proxy based on count", async () => {
          const app = express();
          app.set("trust proxy", 2);
          app.use((req, res, next) => {
            res.send(req.ip);
          });
          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect("p1");
        });
        it("should return the addr after trusted proxy based on list", async () => {
          const app = express();
          app.set("trust proxy", "10.0.0.1, 10.0.0.2, 127.0.0.1, ::1");
          app.get("/", (req, res) => {
            res.send(req.ip);
          });
          await request(app)
            .get("/")
            .set("X-Forwarded-For", "10.0.0.2, 10.0.0.3, 10.0.0.1", "10.0.0.4")
            .expect("10.0.0.3");
        });
        it("should return the addr after trusted proxy, from sub app", async () => {
          const app = express();
          const sub = express();
          app.set("trust proxy", 2);
          app.use(sub);
          sub.use((req, res, next) => {
            res.send(req.ip);
          });
          await request(app)
            .get("/")
            .set("X-Forwarded-For", "client, p1, p2")
            .expect(200, "p1");
        });
      });
      describe('when "trust proxy" is disabled', () => {
        it("should return the remote address", async () => {
          const app = express();
          app.use((req, res, next) => {
            res.send(req.ip);
          });
          const test = request(app).get("/");
          test.set("X-Forwarded-For", "client, p1, p2");
          await test.expect(200, getExpectedClientAddress(test._server));
        });
      });
    });
    describe("when X-Forwarded-For is not present", () => {
      it("should return the remote address", async () => {
        const app = express();
        app.enable("trust proxy");
        app.use((req, res, next) => {
          res.send(req.ip);
        });
        const test = request(app).get("/");
        await test.expect(200, getExpectedClientAddress(test._server));
      });
    });
  });
});

/**
 * Get the local client address depending on AF_NET of server
 */

function getExpectedClientAddress(server) {
  return server.address().address === "::" ? "::ffff:127.0.0.1" : "127.0.0.1";
}
