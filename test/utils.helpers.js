"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseHttpDate, parseTokenList } from "#lib/utils/http-parsing";
import once from "#lib/utils/once";

describe("once()", () => {
  it("should call the wrapped function only once", () => {
    let calls = 0;
    const fn = once((value) => {
      calls += 1;
      return `${value}:${calls}`;
    });

    assert.strictEqual(fn("a"), "a:1");
    assert.strictEqual(fn("b"), "a:1");
    assert.strictEqual(calls, 1);
  });

  it("should preserve this binding for the first call", () => {
    const obj = {
      value: 42,
      fn: once(function () {
        return this.value;
      }),
    };

    assert.strictEqual(obj.fn(), 42);
  });
});

describe("parseHttpDate()", () => {
  it("should parse valid HTTP dates", () => {
    assert.strictEqual(
      parseHttpDate("Thu, 01 Jan 1970 00:00:00 GMT"),
      0,
    );
  });

  it("should return NaN for invalid dates", () => {
    assert.ok(Number.isNaN(parseHttpDate("not-a-date")));
  });
});

describe("parseTokenList()", () => {
  it("should split comma-separated tokens and trim surrounding spaces", () => {
    assert.deepStrictEqual(
      parseTokenList("gzip, deflate, br"),
      ["gzip", "deflate", "br"],
    );
  });

  it("should ignore empty tokens", () => {
    assert.deepStrictEqual(
      parseTokenList("gzip, , deflate ,, br"),
      ["gzip", "deflate", "br"],
    );
  });
});
