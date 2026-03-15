"use strict";

import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
describe("res", () => {
  describe(".type(str)", () => {
    it("should set the Content-Type based on a filename", async () => {
      const app = express();
      app.use((req, res) => {
        res.type("foo.js").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/javascript; charset=utf-8");
    });
    it("should default to application/octet-stream", async () => {
      const app = express();
      app.use((req, res) => {
        res.type("rawr").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/octet-stream");
    });
    it("should set the Content-Type with type/subtype", async () => {
      const app = express();
      app.use((req, res) => {
        res.type("application/vnd.amazon.ebook").end('var name = "tj";');
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "application/vnd.amazon.ebook");
    });
    describe("edge cases", () => {
      it("should handle empty string gracefully", async () => {
        const app = express();
        app.use((req, res) => {
          res.type("").end("test");
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/octet-stream");
      });
      it("should handle file extension with dots", async () => {
        const app = express();
        app.use((req, res) => {
          res.type(".json").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
      it("should handle multiple file extensions", async () => {
        const app = express();
        app.use((req, res) => {
          res.type("file.tar.gz").end("compressed");
        });
        await request(app).get("/").expect("Content-Type", "application/gzip");
      });
      it("should handle uppercase extensions", async () => {
        const app = express();
        app.use((req, res) => {
          res.type("FILE.JSON").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
      it("should handle extension with special characters", async () => {
        const app = express();
        app.use((req, res) => {
          res.type("file@test.json").end('{"test": true}');
        });
        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8");
      });
    });
  });
});
