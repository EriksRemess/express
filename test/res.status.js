"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".status(code)", () => {
    it("should set the status code when valid", async () => {
      const app = express();

      app.use((req, res) => {
        res.status(200).end();
      });

      await request(app).get("/").expect(200);
    });

    describe("accept valid ranges", () => {
      // not testing w/ 100, because that has specific meaning and behavior in Node as Expect: 100-continue
      it("should set the response status code to 101", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(101).end();
        });

        await request(app).get("/").expect(101);
      });

      it("should set the response status code to 201", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(201).end();
        });

        await request(app).get("/").expect(201);
      });

      it("should set the response status code to 302", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(302).end();
        });

        await request(app).get("/").expect(302);
      });

      it("should set the response status code to 403", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(403).end();
        });

        await request(app).get("/").expect(403);
      });

      it("should set the response status code to 501", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(501).end();
        });

        await request(app).get("/").expect(501);
      });

      it("should set the response status code to 700", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(700).end();
        });

        await request(app).get("/").expect(700);
      });

      it("should set the response status code to 800", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(800).end();
        });

        await request(app).get("/").expect(800);
      });

      it("should set the response status code to 900", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(900).end();
        });

        await request(app).get("/").expect(900);
      });
    });

    describe("invalid status codes", () => {
      it("should raise error for status code below 100", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(99).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for status code above 999", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(1000).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for non-integer status codes", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(200.1).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for undefined status code", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(undefined).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for null status code", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(null).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for string status code", async () => {
        const app = express();

        app.use((req, res) => {
          res.status("200").end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });

      it("should raise error for NaN status code", async () => {
        const app = express();

        app.use((req, res) => {
          res.status(NaN).end();
        });

        await request(app)
          .get("/")
          .expect(500, /Invalid status code/);
      });
    });
  });
});
