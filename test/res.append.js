"use strict";

import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import request from "supertest";
describe("res", () => {
  describe(".append(field, val)", () => {
    it("should append multiple headers", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.append("Set-Cookie", "foo=bar");
        next();
      });
      app.use((req, res) => {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should accept array of values", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.append("Set-Cookie", ["foo=bar", "fizz=buzz"]);
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should get reset by res.set(field, val)", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.append("Set-Cookie", "foo=bar");
        res.append("Set-Cookie", "fizz=buzz");
        next();
      });
      app.use((req, res) => {
        res.set("Set-Cookie", "pet=tobi");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["pet=tobi"]));
    });
    it("should work with res.set(field, val) first", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.set("Set-Cookie", "foo=bar");
        next();
      });
      app.use((req, res) => {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(shouldHaveHeaderValues("Set-Cookie", ["foo=bar", "fizz=buzz"]));
    });
    it("should work together with res.cookie", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.cookie("foo", "bar");
        next();
      });
      app.use((req, res) => {
        res.append("Set-Cookie", "fizz=buzz");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect(
          shouldHaveHeaderValues("Set-Cookie", [
            "foo=bar; Path=/",
            "fizz=buzz",
          ]),
        );
    });
  });
});
function shouldHaveHeaderValues(key, values) {
  return res => {
    const headers = res.headers[key.toLowerCase()];
    assert.ok(headers, 'should have header "' + key + '"');
    assert.strictEqual(
      headers.length,
      values.length,
      "should have " + values.length + ' occurrences of "' + key + '"',
    );
    for (let i = 0; i < values.length; i++) {
      assert.strictEqual(headers[i], values[i]);
    }
  };
}
