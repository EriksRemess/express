"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import {Buffer} from "node:buffer";
import utils from "#lib/utils";

describe("utils.etag(body, encoding)", () => {
  it("should support strings", () => {
    assert.strictEqual(
      utils.etag("express!"),
      '"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support utf8 strings", () => {
    assert.strictEqual(
      utils.etag("express❤", "utf8"),
      '"a-JBiXf7GyzxwcrxY4hVXUwa7tmks"',
    );
  });

  it("should support buffer", () => {
    assert.strictEqual(
      utils.etag(Buffer.from("express!")),
      '"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support empty string", () => {
    assert.strictEqual(utils.etag(""), '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
  });
});

describe("utils.normalizeType acceptParams method", () => {
  it("should handle a type with a malformed parameter and break the loop in acceptParams", () => {
    const result = utils.normalizeType("text/plain;invalid");
    assert.deepEqual(result, {
      value: "text/plain",
      quality: 1,
      params: {}, // No parameters are added since "invalid" has no "="
    });
  });

  it("should default to application/octet-stream when mime lookup fails", () => {
    const result = utils.normalizeType("unknown-extension-xyz");
    assert.deepEqual(result, {
      value: "application/octet-stream",
      params: {},
    });
  });
});

describe("utils.setCharset(type, charset)", () => {
  it("should do anything without type", () => {
    assert.strictEqual(utils.setCharset(), undefined);
  });

  it("should return type if not given charset", () => {
    assert.strictEqual(utils.setCharset("text/html"), "text/html");
  });

  it("should keep charset if not given charset", () => {
    assert.strictEqual(
      utils.setCharset("text/html; charset=utf-8"),
      "text/html; charset=utf-8",
    );
  });

  it("should set charset", () => {
    assert.strictEqual(
      utils.setCharset("text/html", "utf-8"),
      "text/html; charset=utf-8",
    );
  });

  it("should override charset", () => {
    assert.strictEqual(
      utils.setCharset("text/html; charset=iso-8859-1", "utf-8"),
      "text/html; charset=utf-8",
    );
  });
});

describe("utils.wetag(body, encoding)", () => {
  it("should support strings", () => {
    assert.strictEqual(
      utils.wetag("express!"),
      'W/"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support utf8 strings", () => {
    assert.strictEqual(
      utils.wetag("express❤", "utf8"),
      'W/"a-JBiXf7GyzxwcrxY4hVXUwa7tmks"',
    );
  });

  it("should support buffer", () => {
    assert.strictEqual(
      utils.wetag(Buffer.from("express!")),
      'W/"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
    );
  });

  it("should support empty string", () => {
    assert.strictEqual(utils.wetag(""), 'W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
  });
});

describe("utils.compileETag()", () => {
  it("should return generateETag for true", () => {
    const fn = utils.compileETag(true);
    assert.strictEqual(fn("express!"), utils.wetag("express!"));
  });

  it("should return undefined for false", () => {
    assert.strictEqual(utils.compileETag(false), undefined);
  });

  it('should return generateETag for string values "strong" and "weak"', () => {
    assert.strictEqual(
      utils.compileETag("strong")("express"),
      utils.etag("express"),
    );
    assert.strictEqual(
      utils.compileETag("weak")("express"),
      utils.wetag("express"),
    );
  });

  it("should throw for unknown string values", () => {
    assert.throws(() => utils.compileETag("foo"), TypeError);
  });

  it("should throw for unsupported types like arrays and objects", () => {
    assert.throws(() => utils.compileETag([]), TypeError);
    assert.throws(() => utils.compileETag({}), TypeError);
  });
});
