"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import proxyaddr from "#lib/utils/proxy-addr";

function makeReq(forwardedFor, remoteAddress, useConnection) {
  const req = {
    headers: {},
    socket: {
      remoteAddress,
    },
  };

  if (forwardedFor !== undefined) {
    req.headers["x-forwarded-for"] = forwardedFor;
  }

  if (useConnection) {
    req.connection = req.socket;
    delete req.socket;
  }

  return req;
}

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

  it("should trim array entries before compiling", () => {
    const trust = proxyaddr.compile([" loopback ", " 10.0.0.0/8 "]);

    assert.equal(trust("127.0.0.1"), true);
    assert.equal(trust("10.1.2.3"), true);
    assert.equal(trust("203.0.113.10"), false);
  });

  it("should trust IPv4-mapped IPv6 addresses against IPv4 ranges", () => {
    const trust = proxyaddr.compile("loopback");

    assert.equal(trust("::ffff:127.0.0.1"), true);
    assert.equal(trust("::ffff:203.0.113.10"), false);
  });

  it("should expand named IP ranges", () => {
    const trust = proxyaddr.compile(["linklocal", "uniquelocal"]);

    assert.equal(trust("169.254.10.20"), true);
    assert.equal(trust("fe80::1"), true);
    assert.equal(trust("10.1.2.3"), true);
    assert.equal(trust("fc00::1"), true);
    assert.equal(trust("203.0.113.10"), false);
  });

  it("should accept dotted IPv4 netmasks", () => {
    const trust = proxyaddr.compile("192.168.0.0/255.255.0.0");

    assert.equal(trust("192.168.10.20"), true);
    assert.equal(trust("192.169.10.20"), false);
  });

  it("should reject unsupported trust argument types", () => {
    assert.throws(() => {
      proxyaddr.compile({});
    }, /unsupported trust argument/);
  });

  it("should reject invalid IP addresses", () => {
    assert.throws(() => {
      proxyaddr.compile("not-an-ip");
    }, /invalid IP address/);
  });

  it("should reject invalid CIDR ranges", () => {
    assert.throws(() => {
      proxyaddr.compile("127.0.0.1/33");
    }, /invalid range on address/);
  });

  it("should reject non-contiguous netmasks", () => {
    assert.throws(() => {
      proxyaddr.compile("192.168.0.0/255.0.255.0");
    }, /invalid range on address/);
  });
});

describe("proxyaddr.all()", () => {
  it("should return all addresses from socket and x-forwarded-for", () => {
    const req = makeReq("203.0.113.1, 10.0.0.1", "127.0.0.1");

    assert.deepStrictEqual(proxyaddr.all(req), [
      "127.0.0.1",
      "10.0.0.1",
      "203.0.113.1",
    ]);
  });

  it("should trim empty x-forwarded-for entries", () => {
    const req = makeReq(" 203.0.113.1 , , 10.0.0.1 ", "127.0.0.1");

    assert.deepStrictEqual(proxyaddr.all(req), [
      "127.0.0.1",
      "10.0.0.1",
      "203.0.113.1",
    ]);
  });

  it("should stop at the first untrusted hop", () => {
    const req = makeReq("203.0.113.1, 10.0.0.1", "127.0.0.1");

    assert.deepStrictEqual(proxyaddr.all(req, "loopback"), [
      "127.0.0.1",
      "10.0.0.1",
    ]);
  });

  it("should accept a custom trust function", () => {
    const calls = [];
    const req = makeReq("203.0.113.1, 10.0.0.1", "127.0.0.1");

    const addrs = proxyaddr.all(req, (addr, index) => {
      calls.push([addr, index]);
      return index < 2;
    });

    assert.deepStrictEqual(addrs, [
      "127.0.0.1",
      "10.0.0.1",
      "203.0.113.1",
    ]);
    assert.deepStrictEqual(calls, [
      ["127.0.0.1", 0],
      ["10.0.0.1", 1],
    ]);
  });
});

describe("proxyaddr()", () => {
  it("should return the client address after trusted proxies", () => {
    const req = makeReq("203.0.113.1, 10.0.0.1", "127.0.0.1");

    assert.strictEqual(
      proxyaddr(req, ["loopback", "uniquelocal"]),
      "203.0.113.1",
    );
  });

  it("should fall back to req.connection.remoteAddress", () => {
    const req = makeReq("203.0.113.1", "127.0.0.1", true);

    assert.strictEqual(proxyaddr(req, "loopback"), "203.0.113.1");
  });

  it("should validate required arguments", () => {
    assert.throws(() => {
      proxyaddr();
    }, /req argument is required/);

    assert.throws(() => {
      proxyaddr(makeReq(undefined, "127.0.0.1"));
    }, /trust argument is required/);
  });
});


describe("IPv4-mapped address normalization", () => {
  for (const address of ["::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:127.0.0.1", "0:0:0:0:0:FFFF:7F00:1"]) {
    it(`should trust ${address} as loopback in a proxy chain`, () => {
      assert.strictEqual(proxyaddr(makeReq(`203.0.113.9, ${address}`, "127.0.0.1"), "loopback"), "203.0.113.9");
      assert.strictEqual(proxyaddr(makeReq("203.0.113.9", address), "loopback"), "203.0.113.9");
    });
  }

  it("should match IPv4 clients against mapped IPv6 subnets", () => {
    const trust = proxyaddr.compile("::ffff:7f00:0/104");
    assert.strictEqual(trust("127.0.0.1"), true);
    assert.strictEqual(trust("128.0.0.1"), false);
  });

  it("should keep non-loopback and non-mapped IPv6 addresses untrusted", () => {
    const trust = proxyaddr.compile("loopback");
    for (const address of ["::ffff:cb00:7109", "::7f00:1", "2001:db8::7f00:1", "not-an-ip"]) {
      assert.strictEqual(trust(address), false, address);
    }
  });
});
