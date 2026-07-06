"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import contentDisposition from "#lib/utils/content-disposition";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("content-disposition", () => {
  const corpus = [
    {
      expected: 'attachment; filename="report final.txt"',
      filename: "report final.txt",
    },
    {
      expected: 'attachment; filename="100% done.txt"',
      filename: "100% done.txt",
    },
    {
      expected: 'attachment; filename="semi;colon.txt"',
      filename: "semi;colon.txt",
    },
    {
      expected: "attachment; filename=\"emoji-??.txt\"; filename*=UTF-8''emoji-%F0%9F%98%80.txt",
      filename: "emoji-😀.txt",
    },
    {
      expected: "attachment; filename=fallback.txt; filename*=UTF-8''emoji-%F0%9F%98%80.txt",
      filename: "../path/emoji-😀.txt",
      options: { fallback: "fallback.txt" },
    },
    {
      expected: "attachment; filename=\"bad?name.txt\"; filename*=UTF-8''bad%0Dname.txt",
      filename: "bad\rname.txt",
    },
    {
      expected: 'attachment; filename=""',
      filename: "",
    },
    {
      expected: "attachment; filename=file%20name.txt; filename*=UTF-8''file%2520name.txt",
      filename: "file%20name.txt",
      options: { fallback: "file%20name.txt" },
    },
    {
      expected: "attachment; filename=c.txt",
      filename: "a/b\\c.txt",
    },
  ];

  for (const { expected, filename, options } of corpus) {
    it(`formats ${JSON.stringify(filename)}`, () => {
      assert.strictEqual(contentDisposition(filename, options), expected);
    });
  }

  it("should return attachment when filename missing", () => {
    assert.strictEqual(contentDisposition(), "attachment");
  });

  it("should include ascii filename", () => {
    assert.strictEqual(
      contentDisposition("/path/to/image.png"),
      "attachment; filename=image.png",
    );
  });

  it("should include ascii fallback and utf8 filename*", () => {
    assert.strictEqual(
      contentDisposition("/locales/日本語.txt"),
      'attachment; filename="???.txt"; filename*=UTF-8\'\'%E6%97%A5%E6%9C%AC%E8%AA%9E.txt',
    );
  });

  it("should support custom type", () => {
    assert.strictEqual(
      contentDisposition("name.txt", { type: "INLINE" }),
      "inline; filename=name.txt",
    );
  });

  it("should omit ascii fallback when fallback is false", () => {
    assert.strictEqual(
      contentDisposition("/locales/日本語.txt", { fallback: false }),
      "attachment; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.txt",
    );
  });

  it("should ignore inherited options", async () => {
    await withObjectPrototypeProperties({
      fallback: false,
      type: "inline",
    }, () => {
      assert.strictEqual(
        contentDisposition("name.txt", {}),
        "attachment; filename=name.txt",
      );
    });
  });

  it("should reject invalid types", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { type: "inline;" });
    }, /invalid type/);
  });

  it("should treat Windows-style paths like filenames", () => {
    assert.strictEqual(
      contentDisposition("C:\\path\\to\\report.pdf"),
      "attachment; filename=report.pdf",
    );
  });

  it("should normalize Windows-style fallback paths", () => {
    assert.strictEqual(
      contentDisposition("/tmp/日本語.txt", { fallback: "C:\\temp\\report.txt" }),
      "attachment; filename=report.txt; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.txt",
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

  it("should reject non-ASCII fallback strings", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { fallback: "日本語.txt" });
    }, /fallback must be US-ASCII string/);
  });

  it("should reject fallback strings with invalid header characters", () => {
    assert.throws(() => {
      contentDisposition("name.txt", { fallback: "bad\nname.txt" });
    }, /fallback must be US-ASCII string/);
  });

  it("should sanitize generated fallback strings with invalid header characters", () => {
    assert.strictEqual(
      contentDisposition("bad\n日本語.txt"),
      'attachment; filename="bad????.txt"; filename*=UTF-8\'\'bad%0A%E6%97%A5%E6%9C%AC%E8%AA%9E.txt',
    );
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
