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
    const simpleCorpus = [
      {
        name: "repeated keys become arrays",
        source: "a=1&a=2&a=3",
        expected: { a: ["1", "2", "3"] },
      },
      {
        name: "bare keys and empty keys are preserved as empty strings",
        source: "empty=&bare&=root",
        expected: { empty: "", bare: "", "": "root" },
      },
      {
        name: "empty pairs around repeated keys are ignored",
        source: "a=1&&a=2&",
        expected: { a: ["1", "2"] },
      },
      {
        name: "encoded names, plus signs, separators, and malformed escapes are decoded consistently",
        source: "encoded%20key=value+one&semi=%3B&bad=%E0%A4%A",
        expected: { "encoded key": "value one", semi: ";", bad: "�%A" },
      },
    ];

    for (const { name, source, expected } of simpleCorpus) {
      it(`should handle corpus case: ${name}`, () => {
        assert.deepEqual(parseSimpleQueryString(source), expected);
      });
    }

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

    it("should ignore decoded unsafe prototype keys", () => {
      const query = parseSimpleQueryString(
        "%5f%5fproto%5f%5f=polluted&%63onstructor=bad&%70rototype=bad&safe=value",
      );
      const merged = Object.assign({}, query);

      assert.deepEqual(query, { safe: "value" });
      assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
      assert.strictEqual({}.polluted, undefined);
    });
  });

  describe("parseExtendedQueryString()", () => {
    const extendedCorpus = [
      {
        name: "array pushes with nested object values",
        source: "a[][b]=1&a[][b]=2",
        expected: { a: [{ b: "1" }, { b: "2" }] },
      },
      {
        name: "duplicate indexed values become nested arrays",
        source: "a[0]=x&a[0]=y&a[1][z]=w",
        expected: { a: [["x", "y"], { z: "w" }] },
      },
      {
        name: "sparse numeric indexes compact in numeric order",
        source: "a[2]=c&a[0]=a&a[1]=b",
        expected: { a: ["a", "b", "c"] },
      },
      {
        name: "huge numeric indexes stay object keys",
        source: "a[999999999999]=x&a[1]=y",
        expected: { a: { 1: "y", 999999999999: "x" } },
      },
      {
        name: "unsafe nested branches are skipped while safe array entries remain",
        source: "a[][constructor][prototype][polluted]=yes&a[][safe]=ok",
        expected: { a: [{ safe: "ok" }] },
      },
      {
        name: "depth truncation is deterministic when not throwing",
        source: "a[b][c][d]=e",
        options: { depth: 2 },
        expected: { a: { b: { c: "e" } } },
      },
    ];

    for (const { name, source, options, expected } of extendedCorpus) {
      it(`should handle corpus case: ${name}`, () => {
        const query = parseExtendedQueryString(source, options);

        assert.deepEqual(query, expected);
        assert.strictEqual({}.polluted, undefined);
      });
    }

    it("should throw on depth corpus case when configured", () => {
      assert.throws(() => {
        parseExtendedQueryString("a[b][c][d]=e", {
          depth: 2,
          throwOnDepthLimit: true,
        });
      }, /The input exceeded the depth/);
    });

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

    it("should ignore decoded unsafe segments while preserving safe array values", () => {
      const query = parseExtendedQueryString(
        "a%5B0%5D=safe&a%5B%5F%5Fproto%5F%5F%5D%5Bpolluted%5D=yes&a%5B1%5D%5Bconstructor%5D%5Bprototype%5D%5Bpolluted%5D=yes&a%5B1%5D%5Bname%5D=tj",
      );

      assert.equal(Array.isArray(query.a), true);
      assert.deepEqual(query.a, ["safe", { name: "tj" }]);
      assert.strictEqual(query.a.polluted, undefined);
      assert.equal({}.polluted, undefined);
    });
  });
});
