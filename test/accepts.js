"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import accepts from "#lib/utils/accepts";

function makeReq(headers) {
  return { headers: headers || {} };
}

describe("accepts", () => {
  it("should support alias methods", () => {
    const accept = accepts(makeReq({
      accept: "application/json",
      "accept-charset": "utf-8",
      "accept-encoding": "gzip",
      "accept-language": "en-us",
    }));

    assert.strictEqual(accept.type("json", "html"), "json");
    assert.strictEqual(accept.charset("utf-8"), "utf-8");
    assert.strictEqual(accept.encoding("gzip"), "gzip");
    assert.strictEqual(accept.lang("en-us"), "en-us");
    assert.strictEqual(accept.langs("en-us"), "en-us");
    assert.strictEqual(accept.language("en-us"), "en-us");
  });

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

  it("should not duplicate media types when quoted parameters contain commas", () => {
    const accept = accepts(
      makeReq({ accept: 'application/json; foo="a,b"; q=.7, text/html; q=.6' }),
    );

    assert.deepStrictEqual(accept.types(), ["application/json", "text/html"]);
  });

  it("should match media type parameters case-insensitively", () => {
    const accept = accepts(
      makeReq({ accept: "text/html; level=ONE, text/html; q=.5" }),
    );

    assert.strictEqual(
      accept.types(["text/html;level=two", "text/html;level=one"]),
      "text/html;level=one",
    );
  });

  it("should allow wildcard media type parameters", () => {
    const accept = accepts(
      makeReq({ accept: "text/html; level=*; q=.7, text/html; q=.5" }),
    );

    assert.strictEqual(
      accept.types(["text/html;level=two", "text/html"]),
      "text/html;level=two",
    );
  });

  it("should ignore invalid provided media type candidates", () => {
    const accept = accepts(makeReq({ accept: "application/json" }));
    assert.strictEqual(accept.types("bogus", "json"), "json");
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

  it("should list preferred charsets when no candidates are provided", () => {
    const accept = accepts(
      makeReq({ "accept-charset": "utf-8;q=.5, iso-8859-1" }),
    );

    assert.deepStrictEqual(accept.charsets(), ["iso-8859-1", "utf-8"]);
  });

  it("should negotiate encodings", () => {
    const accept = accepts(makeReq({ "accept-encoding": "gzip, deflate" }));
    assert.strictEqual(accept.encodings("gzip"), "gzip");
    assert.strictEqual(accept.encodings("bogus"), false);
  });

  it("should list preferred encodings when no candidates are provided", () => {
    const accept = accepts(
      makeReq({ "accept-encoding": "gzip;q=.5, deflate" }),
    );

    assert.deepStrictEqual(accept.encodings(), ["deflate", "gzip", "identity"]);
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

  it("should list preferred languages when no candidates are provided", () => {
    const accept = accepts(
      makeReq({ "accept-language": "en;q=.5, en-us" }),
    );

    assert.deepStrictEqual(accept.languages(), ["en-us", "en"]);
  });

  it("should trim provided candidates before matching", () => {
    const accept = accepts(makeReq({
      accept: "application/json",
      "accept-charset": "utf-8",
      "accept-encoding": "gzip",
      "accept-language": "en-us",
    }));

    assert.strictEqual(accept.types([" json ", " html "]), " json ");
    assert.strictEqual(accept.charsets([" utf-8 "]), " utf-8 ");
    assert.strictEqual(accept.encodings([" gzip "]), " gzip ");
    assert.strictEqual(accept.languages([" en-us "]), " en-us ");
  });
});
