"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import typeis, { hasBody, is, match, normalize } from "#lib/utils/type-is";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("type-is", () => {
  it("should detect request body presence", () => {
    assert.strictEqual(hasBody({ headers: {} }), false);
    assert.strictEqual(hasBody({ headers: { "content-length": "0" } }), true);
    assert.strictEqual(hasBody({ headers: { "transfer-encoding": "chunked" } }), true);
  });

  it("should reject malformed content-length body markers", () => {
    assert.strictEqual(hasBody({ headers: { "content-length": "" } }), false);
    assert.strictEqual(hasBody({ headers: { "content-length": "nope" } }), false);
    assert.strictEqual(hasBody({ headers: { "content-length": "-1" } }), false);
  });

  it("should ignore inherited body marker headers", async () => {
    await withObjectPrototypeProperties({
      "content-length": "1",
      "transfer-encoding": "chunked",
    }, () => {
      assert.strictEqual(hasBody({ headers: {} }), false);
    });
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

  it("should match media type aliases and suffix patterns", () => {
    const req = {
      headers: {
        "content-length": "2",
        "content-type": "application/vnd.api+json; charset=utf-8",
      },
    };

    assert.strictEqual(typeis(req, "+json"), "application/vnd.api+json");
    assert.strictEqual(typeis(req, "application/*+json"), "application/vnd.api+json");
    assert.strictEqual(is("multipart/form-data; boundary=abc", "multipart"), "multipart");
    assert.strictEqual(is("application/x-www-form-urlencoded", "urlencoded"), "urlencoded");
  });

  it("should match the first compatible type from an argument list", () => {
    assert.strictEqual(
      is("application/json; charset=utf-8", "text/html", "json", "application/*"),
      "json",
    );
  });

  it("should return null when no body", () => {
    const req = { headers: { "content-type": "application/json" } };
    assert.strictEqual(typeis(req, ["application/json"]), null);
  });

  it("should return false when body exists but content-type missing", () => {
    const req = { headers: { "content-length": "2" } };
    assert.strictEqual(typeis(req, ["application/json"]), false);
  });

  it("should return the normalized content type for a single falsy matcher", () => {
    const req = {
      headers: {
        "content-length": "2",
        "content-type": "text/plain; charset=utf-8",
      },
    };

    for (const matcher of [undefined, null, false, 0, ""]) {
      assert.strictEqual(typeis(req, matcher), "text/plain");
      assert.strictEqual(is("text/plain; charset=utf-8", matcher), "text/plain");
    }
  });

  it("should normalize matcher input before comparing", () => {
    assert.strictEqual(is("application/json; charset=utf-8", " Application/JSON "), " Application/JSON ");
    assert.strictEqual(is("application/vnd.api+json", " +JSON "), "application/vnd.api+json");
    assert.strictEqual(normalize(" Multipart "), "multipart/*");
  });

  it("should return false for invalid content types", () => {
    assert.strictEqual(is("application json", "application/json"), false);
    assert.strictEqual(is("text/plain", "application json"), false);
  });

  it("should expose helper functions", () => {
    assert.strictEqual(normalize("json"), "application/json");
    assert.strictEqual(normalize("urlencoded"), "application/x-www-form-urlencoded");
    assert.strictEqual(normalize("multipart"), "multipart/*");
    assert.strictEqual(normalize("+json"), "*/*+json");
    assert.strictEqual(match("application/*", "application/json"), true);
    assert.strictEqual(match("*/*+json", "application/vnd.api+json"), true);
    assert.strictEqual(is("application/json; charset=utf-8", ["json"]), "json");
  });
});
