"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import {Buffer} from "node:buffer";
import { setCharset, normalizeType } from "#lib/utils/content-type";
import createEntityTag, { compileETag, strongEtag, weakEtag } from "#lib/utils/etag";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

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

describe("createEntityTag(entity, options)", () => {
  it("should ignore inherited weak option", async () => {
    await withObjectPrototypeProperties({ weak: true }, async () => {
      assert.strictEqual(
        createEntityTag("express!", {}),
        '"8-O2uVAFaQ1rZvlKLT14RnuvjPIdg"',
      );
    });
  });

  it("should not treat inherited stat fields as a Stats object", async () => {
    await withObjectPrototypeProperties({
      ctime: new Date(0),
      ino: 1,
      mtime: new Date(0),
      size: 1,
    }, async () => {
      assert.throws(
        () => createEntityTag({}),
        /argument entity must be string, Buffer, or fs\.Stats/,
      );
    });
  });
});

describe("normalizeType acceptParams method", () => {
  const normalizeTypeCorpus = [
    {
      name: "quality after ordinary parameters",
      source: "text/html; charset=utf-8; q=0.7",
      expected: {
        value: "text/html",
        quality: 0.7,
        params: { charset: "utf-8" },
      },
    },
    {
      name: "quoted semicolons stay inside parameter values",
      source: 'application/json; foo="a;b"; bar=baz; q=.8',
      expected: {
        value: "application/json",
        quality: 0.8,
        params: {
          foo: '"a;b"',
          bar: "baz",
        },
      },
    },
    {
      name: "malformed parameter stops parsing later parameters",
      source: "text/plain; broken; charset=utf-8",
      expected: {
        value: "text/plain",
        quality: 1,
        params: {},
      },
    },
    {
      name: "optional whitespace around keys and values is ignored",
      source: " text/plain ; charset = utf-8 ; q = 0.5 ",
      expected: {
        value: "text/plain",
        quality: 0.5,
        params: { charset: "utf-8" },
      },
    },
    {
      name: "boundary quality with trailing dot is accepted",
      source: "text/plain; q=1.",
      expected: {
        value: "text/plain",
        quality: 1,
        params: {},
      },
    },
    {
      name: "malformed quality is ignored instead of prefix-parsed",
      source: "text/plain; charset=utf-8; q=.5x; foo=bar",
      expected: {
        value: "text/plain",
        quality: 1,
        params: { charset: "utf-8" },
      },
    },
    {
      name: "out-of-range quality is ignored",
      source: "text/plain; q=2; charset=utf-8",
      expected: {
        value: "text/plain",
        quality: 1,
        params: {},
      },
    },
  ];

  for (const { name, source, expected } of normalizeTypeCorpus) {
    it(`should handle corpus case: ${name}`, () => {
      assert.deepEqual(normalizeType(source), expected);
    });
  }

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

  it("should preserve quoted semicolons while setting charset", () => {
    assert.strictEqual(
      setCharset('text/plain; foo="a;b"; charset=iso-8859-1; bar=baz', "utf-8"),
      'text/plain; foo="a;b"; bar=baz; charset=utf-8',
    );
  });

  it("should ignore malformed parameters while preserving valid parameters", () => {
    assert.strictEqual(
      setCharset("text/plain; broken; foo=bar", "utf-8"),
      "text/plain; foo=bar; charset=utf-8",
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
