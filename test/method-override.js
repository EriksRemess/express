"use strict";

import { describe, it } from "node:test";
import assert from "node:assert";
import methodOverride from "#lib/utils/method-override";

describe("methodOverride()", () => {
  it("should override POST to a hyphenated HTTP method", () => {
    const middleware = methodOverride("_method");
    const req = {
      method: "POST",
      url: "/?_method=M-SEARCH",
    };

    middleware(req, {}, () => {
      assert.strictEqual(req.originalMethod, "POST");
      assert.strictEqual(req.method, "M-SEARCH");
    });
  });

  it("should ignore invalid method tokens", () => {
    const middleware = methodOverride("_method");
    const req = {
      method: "POST",
      url: "/?_method=PU/T",
    };

    middleware(req, {}, () => {
      assert.strictEqual(req.originalMethod, undefined);
      assert.strictEqual(req.method, "POST");
    });
  });
});
