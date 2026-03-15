"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".host", () => {
    it("should return the Host when present", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com")
        .expect("example.com");
    });

    it("should strip port number", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "example.com:3000")
        .expect(200, "example.com:3000");
    });

    it("should return undefined otherwise", async () => {
      const app = express();

      app.use((req, res) => {
        req.headers.host = null;
        res.end(String(req.host));
      });

      await request(app).post("/").expect("undefined");
    });

    it("should work with IPv6 Host", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.host);
      });

      await request(app).post("/").set("Host", "[::1]").expect("[::1]");
    });

    it("should work with IPv6 Host and port", async () => {
      const app = express();

      app.use((req, res) => {
        res.end(req.host);
      });

      await request(app)
        .post("/")
        .set("Host", "[::1]:3000")
        .expect(200, "[::1]:3000");
    });

    describe('when "trust proxy" is enabled', () => {
      it("should respect X-Forwarded-Host", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "example.com")
          .expect("example.com");
      });

      it("should ignore X-Forwarded-Host if socket addr not trusted", async () => {
        const app = express();

        app.set("trust proxy", "10.0.0.1");

        app.use((req, res) => {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "example.com")
          .expect("localhost");
      });

      it("should default to Host", async () => {
        const app = express();

        app.enable("trust proxy");

        app.use((req, res) => {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "example.com")
          .expect("example.com");
      });

      describe("when trusting hop count", () => {
        it("should respect X-Forwarded-Host", async () => {
          const app = express();

          app.set("trust proxy", 1);

          app.use((req, res) => {
            res.end(req.host);
          });

          await request(app)
            .get("/")
            .set("Host", "localhost")
            .set("X-Forwarded-Host", "example.com")
            .expect("example.com");
        });
      });
    });

    describe('when "trust proxy" is disabled', () => {
      it("should ignore X-Forwarded-Host", async () => {
        const app = express();

        app.use((req, res) => {
          res.end(req.host);
        });

        await request(app)
          .get("/")
          .set("Host", "localhost")
          .set("X-Forwarded-Host", "evil")
          .expect("localhost");
      });
    });
  });
});
