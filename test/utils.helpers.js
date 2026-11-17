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
  it("should ignore surrounding HTTP field whitespace", () => {
    assert.strictEqual(parseHttpDate("\t Thu, 01 Jan 1970 00:00:00 GMT \t"), 0);
  });

  it("should parse asctime dates as UTC in any time zone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      assert.strictEqual(parseHttpDate("Sun Nov  6 08:49:37 1994"), Date.UTC(1994, 10, 6, 8, 49, 37));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("should resolve two-digit HTTP years relative to the current date", t => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
    assert.strictEqual(parseHttpDate("Wednesday, 01-Jan-70 00:00:00 GMT"), Date.UTC(2070, 0, 1));
    assert.strictEqual(parseHttpDate("Saturday, 01-Jan-77 00:00:00 GMT"), Date.UTC(1977, 0, 1));
  });

  it("should reject impossible calendar dates", () => {
    assert.ok(Number.isNaN(parseHttpDate("Sun, 31 Feb 2025 00:00:00 GMT")));
  });

  it("should account for the leap second at the end of 2016", () => {
    assert.strictEqual(parseHttpDate("Sat, 31 Dec 2016 23:59:60 GMT"), Date.UTC(2017, 0, 1));
  });

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
  it("should trim tab whitespace around tokens", () => {
    assert.deepStrictEqual(parseTokenList("\tgzip\t,\tbr"), ["gzip", "br"]);
  });

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
