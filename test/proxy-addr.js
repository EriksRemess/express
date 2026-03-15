"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import proxyaddr from "#lib/utils/proxy-addr";

describe("proxyaddr.compile()", () => {
  it("should accept an IPv4 /0 range", () => {
    const trust = proxyaddr.compile("0.0.0.0/0");

    assert.equal(trust("127.0.0.1"), true);
    assert.equal(trust("203.0.113.10"), true);
  });

  it("should accept an IPv6 /0 range", () => {
    const trust = proxyaddr.compile("::/0");

    assert.equal(trust("::1"), true);
    assert.equal(trust("2001:db8::10"), true);
  });
});
