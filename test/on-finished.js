"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import onFinished, { isFinished } from "#lib/utils/on-finished";

describe("on-finished", () => {
  it("should invoke listener asynchronously for an already-finished message", async () => {
    const msg = { finished: true, socket: { writable: false } };
    let sync = true;

    await new Promise((resolve) => {
      onFinished(msg, () => {
        assert.strictEqual(sync, false);
        resolve();
      });

      sync = false;
    });
  });

  it("should invoke all listeners once when message finishes", async () => {
    const msg = new EventEmitter();
    const socket = new EventEmitter();
    socket.writable = true;
    msg.finished = false;
    msg.socket = socket;

    let calls = 0;
    await new Promise((resolve, reject) => {
      const done = () => {
        calls += 1;
        if (calls === 2) {
          resolve();
        }
      };

      onFinished(msg, (err, finishedMsg) => {
        if (err) return reject(err);
        assert.strictEqual(finishedMsg, msg);
        done();
      });

      onFinished(msg, (err, finishedMsg) => {
        if (err) return reject(err);
        assert.strictEqual(finishedMsg, msg);
        done();
      });

      msg.emit("finish");
    });
  });

  it("should pass socket errors to listener", async () => {
    const msg = new EventEmitter();
    msg.finished = false;

    const socket = new EventEmitter();
    socket.writable = true;

    const err = new Error("boom");
    await new Promise((resolve) => {
      onFinished(msg, (finishedErr, finishedMsg) => {
        assert.strictEqual(finishedErr, err);
        assert.strictEqual(finishedMsg, msg);
        resolve();
      });

      msg.emit("socket", socket);
      socket.emit("error", err);
    });
  });

  it("should report message finished state", () => {
    assert.strictEqual(isFinished({ finished: false, socket: { writable: true } }), false);
    assert.strictEqual(isFinished({ finished: true, socket: { writable: true } }), true);
    assert.strictEqual(isFinished({ complete: false, socket: { readable: true } }), false);
    assert.strictEqual(isFinished({ complete: true, readable: false, socket: { readable: false } }), true);
  });
});
