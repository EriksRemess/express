"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req.is()", () => {
  describe("when given a mime type", () => {
    it("should return the type when matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("application/json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("image/jpeg"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("application/json"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });

  describe("when content-type is not present", () => {
    it("should return false", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("application/json"));
      });

      await request(app).post("/").send("{}").expect(200, "false");
    });
  });

  describe("when given an extension", () => {
    it("should lookup the mime type", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"json"');
    });
  });

  describe("when given */subtype", () => {
    it("should return the full type when matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("*/json"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("*/html"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("*/json"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });

  describe("when given type/*", () => {
    it("should return the full type when matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("application/*"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, '"application/json"');
    });

    it("should return false when not matching", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("text/*"));
      });

      await request(app)
        .post("/")
        .type("application/json")
        .send("{}")
        .expect(200, "false");
    });

    it("should ignore charset", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.is("application/*"));
      });

      await request(app)
        .post("/")
        .type("application/json; charset=UTF-8")
        .send("{}")
        .expect(200, '"application/json"');
    });
  });
});
