"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".acceptsCharsets(type)", () => {
    describe("when Accept-Charset is not present", () => {
      it("should return true", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app).get("/").expect("yes");
      });
    });

    describe("when Accept-Charset is present", () => {
      it("should return true", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "foo, bar, utf-8")
          .expect("yes");
      });

      it("should return false otherwise", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.end(req.acceptsCharsets("utf-8") ? "yes" : "no");
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "foo, bar")
          .expect("no");
      });

      it("should return the best matching charset from multiple inputs", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.end(req.acceptsCharsets("utf-8", "iso-8859-1"));
        });

        await request(app)
          .get("/")
          .set("Accept-Charset", "iso-8859-1, utf-8")
          .expect("iso-8859-1");
      });
    });
  });
});
