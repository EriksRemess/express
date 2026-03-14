"use strict";
var { describe, it } = require("node:test");
var express = require("../");
var assert = require("node:assert");

describe("app.listen()", function () {
  it("should wrap with an HTTP server", async function () {
    var app = express();

    var server = app.listen(0, function () {
      server.close();
    });
  });
  it("should callback on HTTP server errors", async function () {
    await new Promise((resolve, reject) => {
      var app1 = express();
      var app2 = express();

      var server1 = app1.listen(0, function (err) {
        assert(!err);
        app2.listen(server1.address().port, function (err) {
          assert(err.code === "EADDRINUSE");
          server1.close();
          resolve();
        });
      });
    });
  });
  it("accepts port + hostname + backlog + callback", async function () {
    const app = express();
    const server = app.listen(0, "127.0.0.1", 5, function () {
      const { address, port } = server.address();
      assert.strictEqual(address, "127.0.0.1");
      assert(Number.isInteger(port) && port > 0);
      // backlog isn’t directly inspectable, but if no error was thrown
      // we know it was accepted.
      server.close();
    });
  });
  it("accepts just a callback (no args)", async function () {
    const app = express();
    // same as app.listen(0, done)
    // same as app.listen(0, done)
    const server = app.listen();
    await server.close();
  });
  it("server.address() gives a { address, port, family } object", async function () {
    const app = express();
    const server = app.listen(0, () => {
      const addr = server.address();
      assert(addr && typeof addr === "object");
      assert.strictEqual(typeof addr.address, "string");
      assert(Number.isInteger(addr.port) && addr.port > 0);
      assert(typeof addr.family === "string");
      server.close();
    });
  });
});
