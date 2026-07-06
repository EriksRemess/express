"use strict";
import {describe, it} from "node:test";
import {Buffer} from "node:buffer";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".attachment()", () => {
    it("should Content-Disposition to attachment", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment().send("foo");
      });

      await request(app).get("/").expect("Content-Disposition", "attachment");
    });
  });

  describe(".attachment(filename)", () => {
    it("should add the filename param", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/path/to/image.png");
        res.send("foo");
      });

      await request(app)
        .get("/")
        .expect("Content-Disposition", "attachment; filename=image.png");
    });

    it("should quote file names that are not a valid token", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/path/to/my report.png");
        res.send("foo");
      });

      await request(app)
        .get("/")
        .expect("Content-Disposition", 'attachment; filename="my report.png"');
    });

    it("should handle an empty file name", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("");
        res.send("foo");
      });

      await request(app)
        .get("/")
        .expect("Content-Disposition", 'attachment; filename=""');
    });

    it("should set the Content-Type", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/path/to/image.png");
        res.send(Buffer.alloc(4, "."));
      });

      await request(app).get("/").expect("Content-Type", "image/png");
    });
  });

  describe(".attachment(utf8filename)", () => {
    it("should add the filename and filename* params", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/locales/日本語.txt");
        res.send("japanese");
      });

      await request(app)
        .get("/")
        .expect(
          "Content-Disposition",
          "attachment; filename=\"???.txt\"; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.txt",
        )
        .expect(200);
    });

    it("should encode latin1 file names with an ASCII fallback and filename* param", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/locales/café.txt");
        res.send("coffee");
      });

      await request(app)
        .get("/")
        .expect(
          "Content-Disposition",
          "attachment; filename=\"caf?.txt\"; filename*=UTF-8''caf%C3%A9.txt",
        )
        .expect(200);
    });

    it("should set the Content-Type", async () => {
      const app = express();

      app.use((req, res) => {
        res.attachment("/locales/日本語.txt");
        res.send("japanese");
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "text/plain; charset=utf-8");
    });
  });
});
