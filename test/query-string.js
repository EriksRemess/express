"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseExtendedQueryString,
  parseSimpleQueryString,
} from "#lib/utils/query-string";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("query-string", () => {
  describe("parseSimpleQueryString()", () => {
    it("should ignore empty pairs from repeated separators", () => {
      assert.deepEqual(
        parseSimpleQueryString("&&color=black&&"),
        { color: "black" },
      );
    });

    it("should preserve repeated decoded keys as arrays", () => {
      assert.deepEqual(
        parseSimpleQueryString("full+name=tj&full+name=holowaychuk"),
        { "full name": ["tj", "holowaychuk"] },
      );
    });

    it("should decode malformed percent-encoding like URLSearchParams", () => {
      assert.deepEqual(
        parseSimpleQueryString("a=%E0%A4%A&b=%ZZ&c=%"),
        { a: "�%A", b: "%ZZ", c: "%" },
      );
    });

    it("should preserve empty keys when explicitly provided", () => {
      assert.deepEqual(
        parseSimpleQueryString("=x&&color=black"),
        { "": "x", color: "black" },
      );
    });

    it("should ignore unsafe prototype keys", () => {
      const query = parseSimpleQueryString(
        "__proto__=polluted&__proto__=again&constructor=bad&prototype=bad&safe=value",
      );
      const merged = Object.assign({}, query);

      assert.deepEqual(query, { safe: "value" });
      assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
      assert.strictEqual({}.polluted, undefined);
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

    it("should ignore inherited options", async () => {
      await withObjectPrototypeProperties({
        depth: 0,
        throwOnDepthLimit: true,
      }, () => {
        assert.deepEqual(
          parseExtendedQueryString("a[b]=c", {}),
          { a: { b: "c" } },
        );
      });
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
