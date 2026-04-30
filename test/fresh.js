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
