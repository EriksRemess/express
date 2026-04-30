"use strict";

import {describe, it} from "node:test";
import assert from "node:assert";
import {
  JSONCookies,
  parse,
  parseSetCookie,
  serialize,
  sign,
  signedCookies,
} from "#lib/utils/cookies";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("cookie utils", () => {
  describe(".parse()", () => {
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
