"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import contentDisposition from "#lib/utils/content-disposition";

describe("content-disposition", () => {
  it("should return attachment when filename missing", () => {
    assert.strictEqual(contentDisposition(), "attachment");
  });

  it("should include ascii filename", () => {
    assert.strictEqual(
      contentDisposition("/path/to/image.png"),
      'attachment; filename="image.png"',
    );
  });

  it("should include latin1 fallback and utf8 filename*", () => {
    assert.strictEqual(
      contentDisposition("/locales/日本語.txt"),
      'attachment; filename="???.txt"; filename*=UTF-8\'\'%E6%97%A5%E6%9C%AC%E8%AA%9E.txt',
    );
  });

  it("should support custom type", () => {
    assert.strictEqual(
      contentDisposition("name.txt", { type: "INLINE" }),
      'inline; filename="name.txt"',
    );
  });
});
