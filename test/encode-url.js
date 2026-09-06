"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import encodeUrl from "#lib/utils/encode-url";

describe("encode-url", () => {
  it("should replace every unpaired surrogate while preserving valid pairs", () => {
    for (const [value, expected] of [
      ["\uD800\uD800", "%EF%BF%BD%EF%BF%BD"],
      ["\uDC00\uDC00", "%EF%BF%BD%EF%BF%BD"],
      ["\uDC00\uD800", "%EF%BF%BD%EF%BF%BD"],
      ["\uD800\uDC00", "%F0%90%80%80"],
      ["\uD800\uD800\uDC00\uDC00", "%EF%BF%BD%F0%90%80%80%EF%BF%BD"],
      ["a\uD800\uD800b", "a%EF%BF%BD%EF%BF%BDb"],
    ]) {
      assert.strictEqual(encodeUrl(value), expected, JSON.stringify(value));
    }
  });

  it("should escape incomplete percent sequences without consuming valid neighbors", () => {
    for (const [value, expected] of [
      ["/%a", "/%25a"],
      ["/%0", "/%250"],
      ["/%", "/%25"],
      ["/%a%20", "/%25a%20"],
      ["/%20%a", "/%20%25a"],
      ["/%%20", "/%25%20"],
      ["/%2f%2F", "/%2f%2F"],
    ]) {
      assert.strictEqual(encodeUrl(value), expected);
      assert.strictEqual(encodeUrl(expected), expected);
    }
  });

  it("should encode unsafe characters", () => {
    assert.strictEqual(
      encodeUrl("https://google.com?q=\u2603 §10"),
      "https://google.com?q=%E2%98%83%20%C2%A710",
    );
  });

  it("should preserve already encoded sequences", () => {
    assert.strictEqual(
      encodeUrl("https://google.com?q=%A710"),
      "https://google.com?q=%A710",
    );
  });

  it("should preserve backslashes in path", () => {
    assert.strictEqual(
      encodeUrl("https://google.com/foo\\bar\\baz"),
      "https://google.com/foo\\bar\\baz",
    );
  });

  it("should encode invalid percent sequences", () => {
    assert.strictEqual(
      encodeUrl("http://example.com/%foo"),
      "http://example.com/%25foo",
    );
  });

  it("should safely encode unmatched surrogate pairs", () => {
    assert.strictEqual(
      encodeUrl("x\uD800y"),
      "x%EF%BF%BDy",
    );
  });
});
