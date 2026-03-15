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
