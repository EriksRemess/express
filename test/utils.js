"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import {Buffer} from "node:buffer";
import { setCharset, normalizeType } from "#lib/utils/content-type";
import { compileETag, strongEtag, weakEtag } from "#lib/utils/etag";

describe("strongEtag(body, encoding)", () => {
  it("should support strings", () => {
    assert.strictEqual(
      strongEtag("express!"),
      '"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support utf8 strings", () => {
    assert.strictEqual(
      strongEtag("express❤", "utf8"),
      '"a-JBiXf7GyzxwcrxY4hVXUwa7tmks"',
    );
  });

  it("should support buffer", () => {
    assert.strictEqual(
      strongEtag(Buffer.from("express!")),
      '"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support empty string", () => {
    assert.strictEqual(strongEtag(""), '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
  });
});

describe("normalizeType acceptParams method", () => {
  it("should handle a type with a malformed parameter and break the loop in acceptParams", () => {
    const result = normalizeType("text/plain;invalid");
    assert.deepEqual(result, {
      value: "text/plain",
      quality: 1,
      params: {}, // No parameters are added since "invalid" has no "="
    });
  });

  it("should default to application/octet-stream when mime lookup fails", () => {
    const result = normalizeType("unknown-extension-xyz");
    assert.deepEqual(result, {
      value: "application/octet-stream",
      params: {},
    });
  });

  it("should keep quoted semicolons inside parameter values", () => {
    const result = normalizeType('text/plain; foo="a;b"; q=0.5; charset=utf-8');
    assert.deepEqual(result, {
      value: "text/plain",
      quality: 0.5,
      params: {
        foo: '"a;b"',
        charset: "utf-8",
      },
    });
  });
});

describe("setCharset(type, charset)", () => {
  it("should do anything without type", () => {
    assert.strictEqual(setCharset(), undefined);
  });

  it("should return type if not given charset", () => {
    assert.strictEqual(setCharset("text/html"), "text/html");
  });

  it("should keep charset if not given charset", () => {
    assert.strictEqual(
      setCharset("text/html; charset=utf-8"),
      "text/html; charset=utf-8",
    );
  });

  it("should set charset", () => {
    assert.strictEqual(
      setCharset("text/html", "utf-8"),
      "text/html; charset=utf-8",
    );
  });

  it("should override charset", () => {
    assert.strictEqual(
      setCharset("text/html; charset=iso-8859-1", "utf-8"),
      "text/html; charset=utf-8",
    );
  });
});

describe("weakEtag(body, encoding)", () => {
  it("should support strings", () => {
    assert.strictEqual(
      weakEtag("express!"),
      'W/"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support utf8 strings", () => {
    assert.strictEqual(
      weakEtag("express❤", "utf8"),
      'W/"a-JBiXf7GyzxwcrxY4hVXUwa7tmks"',
    );
  });

  it("should support buffer", () => {
    assert.strictEqual(
      weakEtag(Buffer.from("express!")),
      'W/"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support empty string", () => {
    assert.strictEqual(weakEtag(""), 'W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
  });
});

describe("compileETag()", () => {
  it("should return generateETag for true", () => {
    const fn = compileETag(true);
    assert.strictEqual(fn("express!"), weakEtag("express!"));
  });

  it("should return undefined for false", () => {
    assert.strictEqual(compileETag(false), undefined);
  });

  it('should return generateETag for string values "strong" and "weak"', () => {
    assert.strictEqual(
      compileETag("strong")("express"),
      strongEtag("express"),
    );
    assert.strictEqual(
      compileETag("weak")("express"),
      weakEtag("express"),
    );
  });

  it("should throw for unknown string values", () => {
    assert.throws(() => compileETag("foo"), TypeError);
  });

  it("should throw for unsupported types like arrays and objects", () => {
    assert.throws(() => compileETag([]), TypeError);
    assert.throws(() => compileETag({}), TypeError);
  });
});
