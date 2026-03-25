"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import onFinished, { isFinished } from "#lib/utils/on-finished";

describe("on-finished", () => {
  it("should require a function listener", () => {
    assert.throws(() => {
      onFinished({}, null);
    }, /listener must be a function/);
  });

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

  it("should invoke listener when a request ends", async () => {
    const msg = new EventEmitter();
    const socket = new EventEmitter();
    socket.readable = true;
    msg.complete = false;
    msg.readable = true;
    msg.socket = socket;

    await new Promise((resolve, reject) => {
      onFinished(msg, (err, finishedMsg) => {
        if (err) return reject(err);
        assert.strictEqual(finishedMsg, msg);
        resolve();
      });

      msg.emit("end");
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

  it("should invoke listener once when socket closes before finish", async () => {
    const msg = new EventEmitter();
    msg.finished = false;

    const socket = new EventEmitter();
    socket.writable = true;
    msg.socket = socket;

    let calls = 0;
    await new Promise((resolve, reject) => {
      onFinished(msg, (err, finishedMsg) => {
        if (err) return reject(err);
        calls += 1;
        assert.strictEqual(finishedMsg, msg);
        resolve();
      });

      socket.emit("close");
      msg.emit("finish");
    });

    assert.strictEqual(calls, 1);
  });

  it("should return the original message", () => {
    const msg = new EventEmitter();
    msg.finished = false;
    msg.socket = new EventEmitter();
    msg.socket.writable = true;

    assert.strictEqual(onFinished(msg, () => {}), msg);
  });

  it("should report message finished state", () => {
    assert.strictEqual(isFinished({ finished: false, socket: { writable: true } }), false);
    assert.strictEqual(isFinished({ finished: true, socket: { writable: true } }), true);
    assert.strictEqual(isFinished({ finished: false, socket: { writable: false } }), true);
    assert.strictEqual(isFinished({ complete: false, socket: { readable: true } }), false);
    assert.strictEqual(isFinished({ complete: false }), true);
    assert.strictEqual(isFinished({ complete: false, upgrade: true, socket: { readable: true } }), true);
    assert.strictEqual(isFinished({ complete: true, readable: false, socket: { readable: false } }), true);
    assert.strictEqual(isFinished({}), undefined);
  });
});
