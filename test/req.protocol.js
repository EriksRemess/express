"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".protocol", () => {
    it("should return the protocol string", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.protocol);
      });

      await request(app).get("/").expect("http");
    });

    describe('when "trust proxy" is enabled', () => {
      it("should respect X-Forwarded-Proto", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("https");
      });

      it("should default to the socket addr if X-Forwarded-Proto not present", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          req.socket.encrypted = true;
          res.end(req.protocol);
        });

        await request(app).get("/").expect("https");
      });

      it("should ignore X-Forwarded-Proto if socket addr not trusted", async () => {
        const app = express();

        app.set("trust proxy", "10.0.0.1");

        app.use((req, res) => {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("http");
      });

      it("should default to http", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          res.end(req.protocol);
        });

        await request(app).get("/").expect("http");
      });

      it("should ignore unknown X-Forwarded-Proto values", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "javascript")
          .expect("http");
      });

      describe("when trusting hop count", () => {
        it("should respect X-Forwarded-Proto", async () => {
          const app = express();

          app.set("trust proxy", 1);

          app.use((req, res) => {
            res.end(req.protocol);
          });

          await request(app)
            .get("/")
            .set("X-Forwarded-Proto", "https")
            .expect("https");
        });
      });
    });

    describe('when "trust proxy" is disabled', () => {
      it("should ignore X-Forwarded-Proto", async () => {
        const app = express();

        app.use((req, res) => {
          res.end(req.protocol);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Proto", "https")
          .expect("http");
      });
    });
  });
});
