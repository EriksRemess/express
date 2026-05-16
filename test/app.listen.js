"use strict";
import {describe, it} from "node:test";
import express from "#express";
import assert from "node:assert";

describe("app.listen()", () => {
  it("should wrap with an HTTP server", async () => {
    const app = express();

    const server = app.listen(0, () => {
      server.close();
    });
  });
  it("should callback on HTTP server errors", async () => {
    await new Promise((resolve, reject) => {
      const app1 = express();
      const app2 = express();

      const server1 = app1.listen(0, err => {
        assert(!err);
        app2.listen(server1.address().port, err => {
          assert(err.code === "EADDRINUSE");
          server1.close();
          resolve();
        });
      });
    });
  });
  it("should remove startup error listener after listening", async () => {
    await new Promise((resolve, reject) => {
      const app = express();
      const server = app.listen(0, err => {
        try {
          assert.ifError(err);
          assert.strictEqual(server.listenerCount("error"), 0);
          server.close(resolve);
        } catch (error) {
          server.close(() => reject(error));
        }
      });
    });
  });
  it("accepts port + hostname + backlog + callback", async () => {
    const app = express();
    const server = app.listen(0, "127.0.0.1", 5, () => {
      const { address, port } = server.address();
      assert.strictEqual(address, "127.0.0.1");
      assert(Number.isInteger(port) && port > 0);
      // backlog isn’t directly inspectable, but if no error was thrown
      // we know it was accepted.
      server.close();
    });
  });
  it("accepts just a callback (no args)", async () => {
    const app = express();
    // same as app.listen(0, done)
    // same as app.listen(0, done)
    const server = app.listen();
    await server.close();
  });
  it("server.address() gives a { address, port, family } object", async () => {
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
