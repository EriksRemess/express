"use strict";

import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
describe("res", () => {
  describe(".set(field, value)", () => {
    it("should set the response header field", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", "text/x-foo; charset=utf-8").end();
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/x-foo; charset=utf-8");
    });
    it("should coerce to a string", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("X-Number", 123);
        res.end(typeof res.get("X-Number"));
      });
      await request(app)
        .get("/")
        .expect("X-Number", "123")
        .expect(200, "string");
    });
  });
  describe(".set(field, values)", () => {
    it("should set multiple response header fields", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Set-Cookie", ["type=ninja", "language=javascript"]);
        res.send(res.get("Set-Cookie"));
      });
      await request(app)
        .get("/")
        .expect('["type=ninja","language=javascript"]');
    });
    it("should coerce to an array of strings", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("X-Numbers", [123, 456]);
        res.end(JSON.stringify(res.get("X-Numbers")));
      });
      await request(app)
        .get("/")
        .expect("X-Numbers", "123, 456")
        .expect(200, '["123","456"]');
    });
    it("should not set a charset of one is already set", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", "text/html; charset=lol");
        res.end();
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=lol")
        .expect(200);
    });
    it("should throw when Content-Type is an array", async () => {
      const app = express();
      app.use((req, res) => {
        res.set("Content-Type", ["text/html"]);
        res.end();
      });
      await request(app)
        .get("/")
        .expect(500, /TypeError: Content-Type cannot be set to an Array/);
    });
  });
  describe(".set(object)", () => {
    it("should set multiple fields", async () => {
      const app = express();
      app.use((req, res) => {
        res
          .set({
            "X-Foo": "bar",
            "X-Bar": "baz",
          })
          .end();
      });
      await request(app).get("/").expect("X-Foo", "bar").expect("X-Bar", "baz");
    });
    it("should coerce to a string", async () => {
      const app = express();
      app.use((req, res) => {
        res.set({
          "X-Number": 123,
        });
        res.end(typeof res.get("X-Number"));
      });
      await request(app)
        .get("/")
        .expect("X-Number", "123")
        .expect(200, "string");
    });
  });
});
