"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseExtendedQueryString,
  parseSimpleQueryString,
} from "#lib/utils/query-string";

describe("query-string", () => {
  describe("parseSimpleQueryString()", () => {
    it("should ignore empty pairs from repeated separators", () => {
      assert.deepEqual(
        parseSimpleQueryString("&&color=black&&"),
        { color: "black" },
      );
    });
  });

  describe("parseExtendedQueryString()", () => {
    it("should compact sparse indexed arrays while preserving order", () => {
      assert.deepEqual(
        parseExtendedQueryString("a[1]=b&a[15]=c"),
        {
          a: ["b", "c"],
        },
      );

      assert.deepEqual(
        parseExtendedQueryString("a[0][1]=b&a[0][3]=c"),
        {
          a: [["b", "c"]],
        },
      );
    });

    it("should treat indexes above the default array limit as object keys", () => {
      assert.deepEqual(
        parseExtendedQueryString("a[1000000000]=x"),
        {
          a: {
            1000000000: "x",
          },
        },
      );
    });

    it("should allow a custom array index limit", () => {
      assert.deepEqual(
        parseExtendedQueryString("a[25]=x", { arrayLimit: 30 }),
        {
          a: ["x"],
        },
      );
    });

    it("should split malformed bracket notation like qs", () => {
      assert.deepEqual(
        parseExtendedQueryString("foo[[bar]=baz"),
        {
          "foo[": {
            bar: "baz",
          },
        },
      );

      assert.deepEqual(
        parseExtendedQueryString("a[b[c]]=d"),
        {
          "a[b": {
            c: "d",
          },
        },
      );
    });

    it("should preserve array values when later keys require an object", () => {
      assert.deepEqual(
        parseExtendedQueryString("a[]=1&a[b]=2"),
        {
          a: {
            0: "1",
            b: "2",
          },
        },
      );

      assert.deepEqual(
        parseExtendedQueryString("a[0]=1&a[b]=2"),
        {
          a: {
            0: "1",
            b: "2",
          },
        },
      );
    });

    it("should preserve scalar values when later keys require nesting", () => {
      assert.deepEqual(
        parseExtendedQueryString("a=1&a[b]=2"),
        {
          a: {
            0: "1",
            b: "2",
          },
        },
      );
    });

    it("should ignore unsafe __proto__ segments", () => {
      const query = parseExtendedQueryString("a[0]=x&a[__proto__][polluted]=yes");

      assert.equal(Array.isArray(query.a), true);
      assert.equal(query.a[0], "x");
      assert.equal(query.a.polluted, undefined);
      assert.equal(Object.getPrototypeOf(query.a), Array.prototype);
    });

    it("should ignore unsafe constructor/prototype segments", () => {
      const query = parseExtendedQueryString("safe=value&a[constructor][prototype][polluted]=yes");

      assert.deepEqual(query, { safe: "value" });
      assert.equal({}.polluted, undefined);
    });
  });
});
