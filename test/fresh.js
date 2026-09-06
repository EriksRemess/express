"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import fresh, { isFresh } from "#lib/utils/fresh";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("fresh()", () => {
  it("should use response etag and last-modified headers", () => {
    const reqHeaders = {
      "if-none-match": '"12345"',
    };
    const resHeaders = {
      etag: '"12345"',
      "last-modified": new Date(0).toUTCString(),
    };

    assert.strictEqual(fresh(reqHeaders, resHeaders), true);
  });

  it("should ignore inherited response etag header values", async () => {
    const reqHeaders = {
      "if-none-match": '"12345"',
    };
    const resHeaders = {};

    await withObjectPrototypeProperties({ etag: '"12345"' }, async () => {
      assert.strictEqual(fresh(reqHeaders, resHeaders), false);
    });
  });

  it('should treat "Cache-Control: no-cache" as stale', () => {
    const reqHeaders = {
      "cache-control": "max-age=0, no-cache",
      "if-none-match": '"12345"',
    };

    assert.strictEqual(isFresh(reqHeaders, '"12345"'), false);
  });

  it('should treat "If-None-Match: *" as fresh', () => {
    const reqHeaders = {
      "if-none-match": "*",
    };

    assert.strictEqual(isFresh(reqHeaders, '"12345"'), true);
  });

  it("should match a token within a comma-separated If-None-Match list", () => {
    const reqHeaders = {
      "if-none-match": '"other", W/"12345", "third"',
    };

    assert.strictEqual(isFresh(reqHeaders, '"12345"'), true);
  });

  it('should treat whitespace-wrapped "If-None-Match: *" as fresh', () => {
    const reqHeaders = {
      "if-none-match": " * ",
    };

    assert.strictEqual(isFresh(reqHeaders, '"12345"'), true);
  });

  it("should return false when if-none-match is present without an etag", () => {
    const reqHeaders = {
      "if-none-match": '"12345"',
    };

    assert.strictEqual(isFresh(reqHeaders), false);
  });
});

describe("quoted ETag lists", () => {
  for (const header of ['"v1,revision2"', '"other",\tW/"v1,revision2"\t, "last"']) {
    it(`should recognize ${header}`, () => {
      assert.strictEqual(isFresh({ "if-none-match": header }, '"v1,revision2"'), true);
    });
  }

  it("should not treat a comma inside an unrelated tag as a separator", () => {
    assert.strictEqual(isFresh({ "if-none-match": '"v1,revision2"' }, '"revision2"'), false);
  });
});
