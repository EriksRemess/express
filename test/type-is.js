"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import typeis, { hasBody, is, match, normalize } from "#lib/utils/type-is";

describe("type-is", () => {
  it("should detect request body presence", () => {
    assert.strictEqual(hasBody({ headers: {} }), false);
    assert.strictEqual(hasBody({ headers: { "content-length": "0" } }), true);
    assert.strictEqual(hasBody({ headers: { "transfer-encoding": "chunked" } }), true);
  });

  it("should match concrete media types", () => {
    const req = {
      headers: {
        "content-length": "2",
        "content-type": "application/json; charset=utf-8",
      },
    };

    assert.strictEqual(typeis(req, ["application/json"]), "application/json");
    assert.strictEqual(typeis(req, ["json"]), "json");
    assert.strictEqual(typeis(req, ["application/*"]), "application/json");
    assert.strictEqual(typeis(req, ["*/json"]), "application/json");
    assert.strictEqual(typeis(req, ["text/*"]), false);
  });

  it("should return null when no body", () => {
    const req = { headers: { "content-type": "application/json" } };
    assert.strictEqual(typeis(req, ["application/json"]), null);
  });

  it("should return false when body exists but content-type missing", () => {
    const req = { headers: { "content-length": "2" } };
    assert.strictEqual(typeis(req, ["application/json"]), false);
  });

  it("should expose helper functions", () => {
    assert.strictEqual(normalize("json"), "application/json");
    assert.strictEqual(normalize("urlencoded"), "application/x-www-form-urlencoded");
    assert.strictEqual(normalize("+json"), "*/*+json");
    assert.strictEqual(match("application/*", "application/json"), true);
    assert.strictEqual(is("application/json; charset=utf-8", ["json"]), "json");
  });
});
