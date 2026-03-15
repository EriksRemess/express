"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import request from "supertest";

describe("middleware", () => {
  describe(".next()", () => {
    it("should behave like connect", async () => {
      const app = express(), calls = [];

      app.use((req, res, next) => {
        calls.push("one");
        next();
      });

      app.use((req, res, next) => {
        calls.push("two");
        next();
      });

      app.use((req, res) => {
        let buf = "";
        res.setHeader("Content-Type", "application/json");
        req.setEncoding("utf8");
        req.on("data", chunk => {
          buf += chunk;
        });
        req.on("end", () => {
          res.end(buf);
        });
      });

      await request(app)
        .get("/")
        .set("Content-Type", "application/json")
        .send('{"foo":"bar"}')
        .expect("Content-Type", "application/json")
        .expect(() => {
          assert.deepEqual(calls, ["one", "two"]);
        })
        .expect(200, '{"foo":"bar"}');
    });
  });
});
