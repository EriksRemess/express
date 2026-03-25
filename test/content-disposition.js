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

  it("should reject invalid types", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { type: "inline;" });
    }, /invalid type/);
  });

  it("should treat Windows-style paths like filenames", () => {
    assert.strictEqual(
      contentDisposition("C:\\path\\to\\report.pdf"),
      'attachment; filename="report.pdf"',
    );
  });

  it("should normalize Windows-style fallback paths", () => {
    assert.strictEqual(
      contentDisposition("/tmp/日本語.txt", { fallback: "C:\\temp\\report.txt" }),
      'attachment; filename="report.txt"; filename*=UTF-8\'\'%E6%97%A5%E6%9C%AC%E8%AA%9E.txt',
    );
  });

  it("should reject non-string filenames", () => {
    assert.throws(() => {
      contentDisposition(42);
    }, /filename must be a string/);
  });

  it("should reject invalid fallback values", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { fallback: 42 });
    }, /fallback must be a string or boolean/);
  });

  it("should reject non-Latin1 fallback strings", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { fallback: "日本語.txt" });
    }, /fallback must be ISO-8859-1 string/);
  });

  it("should escape quoted filename characters", () => {
    assert.strictEqual(
      contentDisposition('he"llo.txt'),
      'attachment; filename="he\\"llo.txt"',
    );
  });

  it("should emit RFC 5987 encoding for attr characters", () => {
    assert.strictEqual(
      contentDisposition("日*.txt"),
      'attachment; filename="?*.txt"; filename*=UTF-8\'\'%E6%97%A5%2A.txt',
    );
  });
});
