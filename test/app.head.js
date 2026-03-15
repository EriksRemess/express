"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import assert from "node:assert";

describe("HEAD", () => {
  it("should default to GET", async () => {
    const app = express();

    app.get("/tobi", (req, res) => {
      // send() detects HEAD
      res.send("tobi");
    });

    await request(app).head("/tobi").expect(200);
  });

  it("should output the same headers as GET requests", async () => {
    await new Promise((resolve, reject) => {
      const app = express();

      app.get("/tobi", (req, res) => {
        // send() detects HEAD
        res.send("tobi");
      });

      request(app)
        .head("/tobi")
        .expect(200, (err, res) => {
          if (err) return reject(err);
          const headers = res.headers;
          request(app)
            .get("/tobi")
            .expect(200, (err, res) => {
              if (err) return reject(err);
              delete headers.date;
              delete res.headers.date;
              assert.deepEqual(res.headers, headers);
              resolve();
            });
        });
    });
  });
});

describe("app.head()", () => {
  it("should override", async () => {
    const app = express();

    app.head("/tobi", (req, res) => {
      res.header("x-method", "head");
      res.end();
    });

    app.get("/tobi", (req, res) => {
      res.header("x-method", "get");
      res.send("tobi");
    });

    await request(app).head("/tobi").expect("x-method", "head").expect(200);
  });
});
