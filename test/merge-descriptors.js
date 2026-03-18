"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import mergeDescriptors from "#lib/utils/merge-descriptors";

describe("merge-descriptors", () => {
  it("should copy property descriptors", () => {
    const destination = {};
    let value = 1;
    const source = {};

    Object.defineProperty(source, "x", {
      enumerable: true,
      configurable: true,
      get() {
        return value;
      },
    });

    mergeDescriptors(destination, source);
    assert.strictEqual(destination.x, 1);

    value = 2;
    assert.strictEqual(destination.x, 2);
  });

  it("should support overwrite=false", () => {
    const destination = { x: "destination" };
    const source = { x: "source" };

    mergeDescriptors(destination, source, false);
    assert.strictEqual(destination.x, "destination");
  });

  it("should copy symbol property descriptors", () => {
    const key = Symbol("x");
    const destination = {};
    const source = {};

    Object.defineProperty(source, key, {
      enumerable: false,
      configurable: true,
      value: 42,
      writable: false,
    });

    mergeDescriptors(destination, source);

    const descriptor = Object.getOwnPropertyDescriptor(destination, key);
    assert.strictEqual(destination[key], 42);
    assert.strictEqual(descriptor.enumerable, false);
    assert.strictEqual(descriptor.writable, false);
  });

  it("should respect overwrite=false for symbol properties", () => {
    const key = Symbol("x");
    const destination = {};
    const source = {};

    Object.defineProperty(destination, key, {
      value: "destination",
      configurable: true,
    });

    Object.defineProperty(source, key, {
      value: "source",
      configurable: true,
    });

    mergeDescriptors(destination, source, false);
    assert.strictEqual(destination[key], "destination");
  });

  it("should throw without required arguments", () => {
    assert.throws(() => {
      mergeDescriptors();
    }, /destination/);

    assert.throws(() => {
      mergeDescriptors({});
    }, /source/);
  });
});
