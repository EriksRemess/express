"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import express from "#express";
import bodyParser, {
  json,
  raw,
  text,
  urlencoded,
} from "express/bodyParser";
import cookieModule, {
  parse,
  serialize,
} from "express/cookie";

describe("package exports", () => {
  it("should export bodyParser as a package subpath", () => {
    assert.strictEqual(bodyParser.json, json);
    assert.strictEqual(bodyParser.raw, raw);
    assert.strictEqual(bodyParser.text, text);
    assert.strictEqual(bodyParser.urlencoded, urlencoded);
    assert.strictEqual(express.json, json);
    assert.strictEqual(express.raw, raw);
    assert.strictEqual(express.text, text);
    assert.strictEqual(express.urlencoded, urlencoded);
  });

  it("should export cookie helpers as a package subpath", () => {
    assert.strictEqual(typeof cookieModule, "object");
    assert.strictEqual(typeof cookieModule.parse, "function");
    assert.strictEqual(typeof cookieModule.serialize, "function");
    assert.strictEqual(express.cookie.parse, parse);
    assert.strictEqual(express.cookie.serialize, serialize);
  });
});
