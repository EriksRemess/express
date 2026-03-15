"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import encodeUrl from "#lib/utils/encode-url";

describe("encode-url", () => {
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
