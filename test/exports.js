"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import request from "supertest";

describe("exports", () => {
  it("should expose Router", () => {
    assert.strictEqual(typeof express.Router, "function");
  });

  it("should expose json middleware", () => {
    assert.equal(typeof express.json, "function");
    assert.equal(express.json.length, 1);
  });

  it("should expose raw middleware", () => {
    assert.equal(typeof express.raw, "function");
    assert.equal(express.raw.length, 1);
  });

  it("should expose cookie utilities", () => {
    assert.strictEqual(typeof express.cookie, "object");
    assert.strictEqual(typeof express.cookie.parse, "function");
    assert.strictEqual(typeof express.cookie.serialize, "function");
  });

  it("should expose static middleware", () => {
    assert.equal(typeof express.static, "function");
    assert.equal(express.static.length, 2);
  });

  it("should expose text middleware", () => {
    assert.equal(typeof express.text, "function");
    assert.equal(express.text.length, 1);
  });

  it("should expose urlencoded middleware", () => {
    assert.equal(typeof express.urlencoded, "function");
    assert.equal(express.urlencoded.length, 1);
  });

  it("should expose the application prototype", () => {
    assert.strictEqual(typeof express.application, "object");
    assert.strictEqual(typeof express.application.set, "function");
  });

  it("should expose the request prototype", () => {
    assert.strictEqual(typeof express.request, "object");
    assert.strictEqual(typeof express.request.accepts, "function");
  });

  it("should expose the response prototype", () => {
    assert.strictEqual(typeof express.response, "object");
    assert.strictEqual(typeof express.response.send, "function");
  });

  it("should permit modifying the .application prototype", () => {
    express.application.foo = () => {
      return "bar";
    };
    assert.strictEqual(express().foo(), "bar");
  });

  it("should permit modifying the .request prototype", async () => {
    express.request.foo = () => {
      return "bar";
    };
    const app = express();

    app.use((req, res, next) => {
      res.end(req.foo());
    });

    await request(app).get("/").expect("bar");
  });

  it("should permit modifying the .response prototype", async () => {
    express.response.foo = function () {
      this.send("bar");
    };
    const app = express();

    app.use((req, res, next) => {
      res.foo();
    });

    await request(app).get("/").expect("bar");
  });
});
