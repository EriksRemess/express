"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".subdomains", () => {
    describe("when present", () => {
      it("should return an array", async () => {
        const app = express();

        app.use((req, res) => {
          res.send(req.subdomains);
        });

        await request(app)
          .get("/")
          .set("Host", "tobi.ferrets.example.com")
          .expect(200, ["ferrets", "tobi"]);
      });

      it("should work with IPv4 address", async () => {
        const app = express();

        app.use((req, res) => {
          res.send(req.subdomains);
        });

        await request(app).get("/").set("Host", "127.0.0.1").expect(200, []);
      });

      it("should work with IPv6 address", async () => {
        const app = express();

        app.use((req, res) => {
          res.send(req.subdomains);
        });

        await request(app).get("/").set("Host", "[::1]").expect(200, []);
      });
    });

    describe("otherwise", () => {
      it("should return an empty array", async () => {
        const app = express();

        app.use((req, res) => {
          res.send(req.subdomains);
        });

        await request(app).get("/").set("Host", "example.com").expect(200, []);
      });
    });

    describe("with no host", () => {
      it("should return an empty array", async () => {
        const app = express();

        app.use((req, res) => {
          req.headers.host = null;
          res.send(req.subdomains);
        });

        await request(app).get("/").expect(200, []);
      });
    });

    describe("with trusted X-Forwarded-Host", () => {
      it("should return an array", async () => {
        const app = express();

        app.set("trust proxy", true);
        app.use((req, res) => {
          res.send(req.subdomains);
        });

        await request(app)
          .get("/")
          .set("X-Forwarded-Host", "tobi.ferrets.example.com")
          .expect(200, ["ferrets", "tobi"]);
      });
    });

    describe("when subdomain offset is set", () => {
      describe("when subdomain offset is zero", () => {
        it("should return an array with the whole domain", async () => {
          const app = express();
          app.set("subdomain offset", 0);

          app.use((req, res) => {
            res.send(req.subdomains);
          });

          await request(app)
            .get("/")
            .set("Host", "tobi.ferrets.sub.example.com")
            .expect(200, ["com", "example", "sub", "ferrets", "tobi"]);
        });

        it("should return an array with the whole IPv4", async () => {
          const app = express();
          app.set("subdomain offset", 0);

          app.use((req, res) => {
            res.send(req.subdomains);
          });

          await request(app)
            .get("/")
            .set("Host", "127.0.0.1")
            .expect(200, ["127.0.0.1"]);
        });

        it("should return an array with the whole IPv6", async () => {
          const app = express();
          app.set("subdomain offset", 0);

          app.use((req, res) => {
            res.send(req.subdomains);
          });

          await request(app)
            .get("/")
            .set("Host", "[::1]")
            .expect(200, ["[::1]"]);
        });
      });

      describe("when present", () => {
        it("should return an array", async () => {
          const app = express();
          app.set("subdomain offset", 3);

          app.use((req, res) => {
            res.send(req.subdomains);
          });

          await request(app)
            .get("/")
            .set("Host", "tobi.ferrets.sub.example.com")
            .expect(200, ["ferrets", "tobi"]);
        });
      });

      describe("otherwise", () => {
        it("should return an empty array", async () => {
          const app = express();
          app.set("subdomain offset", 3);

          app.use((req, res) => {
            res.send(req.subdomains);
          });

          await request(app)
            .get("/")
            .set("Host", "sub.example.com")
            .expect(200, []);
        });
      });
    });
  });
});
