"use strict";

import {describe, it} from "node:test";
import assert from "node:assert";
import {
  JSONCookies,
  parse,
  parseSetCookie,
  serialize,
  sign,
  signedCookie,
  signedCookies,
} from "#lib/utils/cookies";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("cookie utils", () => {
  describe(".parse()", () => {
    const parseCorpus = [
      {
        expected: { foo: "bar", spaced: "value", quoted: '"hello"' },
        source: 'foo=bar; spaced = value ; quoted="hello"; foo=again',
      },
      {
        expected: { encoded: '{"ok":true}', bad: "%E0%A4%A", plus: "a+b" },
        source: "encoded=%7B%22ok%22%3Atrue%7D; bad=%E0%A4%A; plus=a+b",
      },
      {
        expected: { "": "empty-name", safe: "value" },
        source: "=empty-name; bare; safe=value; __proto__=polluted",
      },
      {
        expected: { a: "b", c: "d=e", spaced: "one" },
        source: "a=b; c=d=e; spaced= one ",
      },
    ];

    for (const { expected, source } of parseCorpus) {
      it(`parses ${JSON.stringify(source)}`, () => {
        const cookies = parse(source);
        const merged = Object.assign({}, cookies);

        assert.deepEqual(cookies, expected);
        assert.deepStrictEqual(merged, expected);
        assert.strictEqual(Object.getPrototypeOf(cookies), null);
        assert.strictEqual({}.polluted, undefined);
      });
    }

    it("should keep the first value for duplicate cookie names", () => {
      const cookies = parse("foo=bar; foo=baz");

      assert.strictEqual(Object.getPrototypeOf(cookies), null);
      assert.strictEqual(cookies.foo, "bar");
    });

    it("should recover from malformed cookie pairs", () => {
      const cookies = parse("foo=bar; broken; fizz=buzz");

      assert.strictEqual(Object.getPrototypeOf(cookies), null);
      assert.strictEqual(cookies.foo, "bar");
      assert.strictEqual(cookies.fizz, "buzz");
    });

    it("should support a custom decoder", () => {
      const decoder = value => value.replaceAll("+", " ");

      const cookies = parse("full+name=tj+holowaychuk", { decode: decoder });

      assert.strictEqual(Object.getPrototypeOf(cookies), null);
      assert.strictEqual(cookies["full+name"], "tj holowaychuk");
    });

    it("should ignore inherited options", async () => {
      await withObjectPrototypeProperties({
        decode: () => "polluted",
      }, () => {
        const cookies = parse("safe=value", {});

        assert.strictEqual(cookies.safe, "value");
      });
    });

    it("should ignore unsafe prototype names", () => {
      const cookies = parse("__proto__=polluted; constructor=bad; prototype=bad; safe=value");
      const merged = Object.assign({}, cookies);

      assert.deepEqual(cookies, { safe: "value" });
      assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
      assert.strictEqual({}.polluted, undefined);
    });
  });

  describe(".serialize()", () => {
    it("should preserve falsy values when called with a cookie object", () => {
      assert.strictEqual(
        serialize({ name: "count", value: 0 }),
        "count=0",
      );

      assert.strictEqual(
        serialize({ name: "enabled", value: false }),
        "enabled=false",
      );
    });

    it("should support a custom encoder", () => {
      const encoder = value => value.replaceAll(" ", "+");

      assert.strictEqual(
        serialize("full-name", "tj holowaychuk", { encode: encoder }),
        "full-name=tj+holowaychuk",
      );
    });

    it("should reject invalid cookie names", () => {
      assert.throws(() => {
        serialize("bad;name", "value");
      }, /argument name is invalid/);
    });

    it("should reject cookie names with HTTP separators", () => {
      for (const name of ["bad<name", "bad>name", "bad@name", "bad[name]", "bad{name}"]) {
        assert.throws(() => {
          serialize(name, "value");
        }, /argument name is invalid/);
      }
    });

    it("should reject invalid cookie values", () => {
      assert.throws(() => {
        serialize("name", "bad value", { encode: value => value });
      }, /argument val is invalid/);
    });

    it("should reject invalid domains", () => {
      assert.throws(() => {
        serialize("name", "value", { domain: "bad_domain" });
      }, /option domain is invalid/);
    });

    it("should reject invalid paths", () => {
      assert.throws(() => {
        serialize("name", "value", { path: "/semi;colon" });
      }, /option path is invalid/);
    });
  });

  describe(".parseSetCookie()", () => {
    const setCookieCorpus = [
      {
        expected: {
          httpOnly: true,
          maxAge: -10,
          name: "sid",
          path: "/",
          secure: true,
          value: "abc",
        },
        source: "sid=abc; Max-Age=-10; Path=/; Secure; HttpOnly",
      },
      {
        expected: {
          name: "sid",
          priority: "high",
          sameSite: "none",
          value: "abc",
        },
        source: "sid=abc; SameSite=Strict; SameSite=None; Priority=Low; Priority=High",
      },
      {
        expected: {
          name: "",
          path: "/x",
          value: "lonely",
        },
        source: "lonely; Path=/x",
      },
      {
        expected: {
          domain: "Example.COM",
          name: "sid",
          path: "/a%20b",
          value: "abc",
        },
        source: "sid=abc; Domain=Example.COM; Path=/a%20b",
      },
    ];

    for (const { expected, source } of setCookieCorpus) {
      it(`parses Set-Cookie ${JSON.stringify(source)}`, () => {
        assert.deepStrictEqual(parseSetCookie(source), expected);
      });
    }

    it("should parse common attributes", () => {
      const cookie = parseSetCookie(
        "sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=10",
      );

      assert.deepStrictEqual(cookie, {
        httpOnly: true,
        maxAge: 10,
        name: "sid",
        path: "/",
        sameSite: "lax",
        secure: true,
        value: "abc",
      });
    });

    it("should parse optional attributes case-insensitively", () => {
      const cookie = parseSetCookie(
        "sid=abc; domain=example.com; expires=Wed, 21 Oct 2015 07:28:00 GMT; partitioned; priority=High; samesite=None",
      );

      assert.deepStrictEqual(cookie, {
        domain: "example.com",
        expires: new Date("Wed, 21 Oct 2015 07:28:00 GMT"),
        name: "sid",
        partitioned: true,
        priority: "high",
        sameSite: "none",
        value: "abc",
      });
    });

    it("should ignore invalid optional attributes", () => {
      const cookie = parseSetCookie(
        "sid=abc; Max-Age=abc; Expires=bad-date; Priority=urgent; SameSite=maybe; Unknown=value",
      );

      assert.deepStrictEqual(cookie, {
        name: "sid",
        value: "abc",
      });
    });
  });

  describe(".JSONCookies()", () => {
    it("should parse falsy JSON cookie values", () => {
      const cookies = {
        disabled: "j:false",
        empty: "j:null",
        count: "j:0",
      };

      assert.deepStrictEqual(JSONCookies(cookies), {
        disabled: false,
        empty: null,
        count: 0,
      });
    });

    it("should ignore unsafe prototype names", () => {
      const cookies = Object.create(null);

      cookies.__proto__ = 'j:{"polluted":true}';
      cookies.constructor = 'j:{"polluted":true}';
      cookies.prototype = 'j:{"polluted":true}';
      cookies.safe = 'j:{"ok":true}';

      const parsed = JSONCookies(cookies);
      const merged = Object.assign({}, parsed);

      assert.deepEqual(parsed, { safe: { ok: true } });
      assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
      assert.strictEqual({}.polluted, undefined);
    });
  });

  describe(".signedCookies()", () => {
    it("should reject tampered signed cookies", () => {
      const cookies = {
        bad: `s:${sign("value", "secret")}x`,
        good: `s:${sign("value", "secret")}`,
        plain: "value",
      };

      const parsed = signedCookies(cookies, "secret");

      assert.deepEqual(parsed, {
        bad: false,
        good: "value",
      });
      assert.deepEqual(cookies, { plain: "value" });
    });

    it("should verify signed cookies with any configured secret", () => {
      assert.strictEqual(
        signedCookie(`s:${sign("value", "old-secret")}`, ["new-secret", "old-secret"]),
        "value",
      );
    });

    it("should return false for malformed signed cookie values", () => {
      assert.strictEqual(signedCookie("s:nosignature", "secret"), false);
    });

    it("should ignore unsafe prototype names", () => {
      const cookies = Object.create(null);

      cookies.__proto__ = `s:${sign('j:{"polluted":true}', "secret")}`;
      cookies.constructor = `s:${sign('j:{"polluted":true}', "secret")}`;
      cookies.prototype = `s:${sign('j:{"polluted":true}', "secret")}`;
      cookies.safe = `s:${sign("value", "secret")}`;

      const parsed = signedCookies(cookies, "secret");
      const merged = Object.assign({}, parsed);

      assert.deepEqual(parsed, { safe: "value" });
      assert.deepEqual(cookies, {});
      assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
      assert.strictEqual({}.polluted, undefined);
    });
  });
});
