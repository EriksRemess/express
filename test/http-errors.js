"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import createError, { HttpError, isHttpError } from "#lib/utils/http-errors";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("http-errors", () => {
  it("should create an error with status and expose for 4xx", () => {
    const err = createError(404);
    assert.strictEqual(err.message, "Not Found");
    assert.strictEqual(err.status, 404);
    assert.strictEqual(err.statusCode, 404);
    assert.strictEqual(err.expose, true);
    assert.ok(err instanceof HttpError);
  });

  it("should create an error with status and expose for 5xx", () => {
    const err = createError(503, "unavailable");
    assert.strictEqual(err.message, "unavailable");
    assert.strictEqual(err.status, 503);
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.expose, false);
  });

  it("should decorate an existing error", () => {
    const input = new Error("boom");
    const err = createError(400, input, { headers: { "x-test": "1" } });

    assert.strictEqual(err, input);
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.expose, true);
    assert.deepStrictEqual(err.headers, { "x-test": "1" });
  });

  it("should default to 500 for invalid status", () => {
    const err = createError(9999, "bad");
    assert.strictEqual(err.status, 500);
    assert.strictEqual(err.statusCode, 500);
    assert.strictEqual(err.expose, false);
    assert.strictEqual(err.message, "bad");
  });

  it("should ignore status/statusCode keys in props", () => {
    const err = createError(404, { status: 500, statusCode: 500, code: "X" });
    assert.strictEqual(err.status, 404);
    assert.strictEqual(err.statusCode, 404);
    assert.strictEqual(err.code, "X");
  });

  it("should ignore inherited enumerable props", () => {
    const props = Object.create({ inherited: "nope" });
    props.code = "X";

    const err = createError(404, props);
    assert.strictEqual(err.code, "X");
    assert.strictEqual("inherited" in err, false);
  });

  it("should ignore inherited status metadata on errors", async () => {
    await withObjectPrototypeProperties({
      expose: true,
      status: 404,
      statusCode: 404,
    }, () => {
      const err = createError(500, new Error("boom"));

      assert.strictEqual(err.status, 500);
      assert.strictEqual(err.statusCode, 500);
      assert.strictEqual(err.expose, false);
      assert.strictEqual(isHttpError(new Error("polluted")), false);
    });
  });

  it("should validate unsupported argument types", () => {
    assert.throws(() => {
      createError(404, null);
    }, /unsupported type object/);

    assert.throws(() => {
      createError(404, true);
    }, /unsupported type boolean/);
  });

  it("should provide isHttpError", () => {
    const err = createError(400);
    assert.strictEqual(isHttpError(err), true);
    assert.strictEqual(isHttpError(new Error("x")), false);
    assert.strictEqual(isHttpError(null), false);
  });
});

describe("decorated error identity", () => {
  class ValidationError extends Error {
    describe() { return "validation failed"; }
  }

  for (const ErrorType of [SyntaxError, TypeError, ValidationError]) {
    it(`should preserve ${ErrorType.name} prototypes`, () => {
      const input = new ErrorType("invalid");
      const originalStack = input.stack;
      const result = createError(400, input);
      assert.strictEqual(result, input);
      assert.strictEqual(Object.getPrototypeOf(result), ErrorType.prototype);
      assert.strictEqual(result.stack, originalStack);
      assert.strictEqual(isHttpError(result), true);
      assert.strictEqual(result.status, 400);
      if (result instanceof ValidationError) assert.strictEqual(result.describe(), "validation failed");
    });
  }
});
