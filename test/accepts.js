"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import accepts from "#lib/utils/accepts";

function makeReq(headers) {
  return { headers: headers || {} };
}

describe("accepts", () => {
  it("should return first type when Accept is missing", () => {
    const accept = accepts(makeReq());
    assert.strictEqual(accept.types("json", "html"), "json");
  });

  it("should respect media type quality", () => {
    const accept = accepts(makeReq({ accept: "*/html; q=.5, application/json" }));
    assert.strictEqual(
      accept.types(["text/html", "application/json"]),
      "application/json",
    );
  });

  it("should map extension names and return original input", () => {
    const accept = accepts(makeReq({ accept: "application/json" }));
    assert.strictEqual(accept.types("json", "html"), "json");
  });

  it("should return canonical mime candidate when provided", () => {
    const accept = accepts(makeReq({ accept: "*/html" }));
    assert.strictEqual(
      accept.types(["application/json", "text/html"]),
      "text/html",
    );
  });

  it("should return false for non-matching types", () => {
    const accept = accepts(makeReq({ accept: "foo/bar, bar/baz" }));
    assert.strictEqual(accept.types(["text/html", "application/json"]), false);
  });

  it("should negotiate charsets", () => {
    const missing = accepts(makeReq());
    assert.strictEqual(missing.charsets("utf-8"), "utf-8");

    const present = accepts(makeReq({ "accept-charset": "iso-8859-1, utf-8" }));
    assert.strictEqual(
      present.charsets("utf-8", "iso-8859-1"),
      "iso-8859-1",
    );
  });

  it("should negotiate encodings", () => {
    const accept = accepts(makeReq({ "accept-encoding": "gzip, deflate" }));
    assert.strictEqual(accept.encodings("gzip"), "gzip");
    assert.strictEqual(accept.encodings("bogus"), false);
  });

  it("should ignore empty accept-encoding entries", () => {
    const accept = accepts(makeReq({ "accept-encoding": "" }));

    assert.deepStrictEqual(accept.encodings(), ["identity"]);
    assert.strictEqual(accept.encodings("gzip"), false);
    assert.strictEqual(accept.encodings("identity"), "identity");
  });

  it("should negotiate languages", () => {
    const accept = accepts(makeReq({ "accept-language": "en;q=.5, en-us" }));
    assert.strictEqual(accept.languages("en-us"), "en-us");
    assert.strictEqual(accept.languages("en"), "en");
    assert.strictEqual(accept.languages("es"), false);

    const missing = accepts(makeReq());
    assert.strictEqual(missing.languages("en"), "en");
  });
});
