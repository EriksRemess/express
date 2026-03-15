"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import express, {
  Router,
  Route,
  application,
  cookie,
  request,
  response,
  json,
  raw,
  static as staticMiddleware,
  text,
  urlencoded,
} from "#express";

describe("module exports", () => {
  it("should expose named exports", () => {
    assert.strictEqual(Router, express.Router);
    assert.strictEqual(Route, express.Route);
    assert.strictEqual(application, express.application);
    assert.strictEqual(cookie, express.cookie);
    assert.strictEqual(request, express.request);
    assert.strictEqual(response, express.response);
    assert.strictEqual(json, express.json);
    assert.strictEqual(raw, express.raw);
    assert.strictEqual(staticMiddleware, express.static);
    assert.strictEqual(text, express.text);
    assert.strictEqual(urlencoded, express.urlencoded);
  });
});
