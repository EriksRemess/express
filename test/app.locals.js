"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import request from "supertest";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

describe("app", () => {
  describe(".locals", () => {
    it("should default object with null prototype", () => {
      const app = express();
      assert.ok(app.locals);
      assert.strictEqual(typeof app.locals, "object");
      assert.strictEqual(Object.getPrototypeOf(app.locals), null);
    });

    describe(".settings", () => {
      it("should contain app settings ", () => {
        const app = express();
        app.set("title", "Express");
        assert.ok(app.locals.settings);
        assert.strictEqual(typeof app.locals.settings, "object");
        assert.strictEqual(app.locals.settings, app.settings);
        assert.strictEqual(app.locals.settings.title, "Express");
      });
    });
  });

  describe("res.locals", () => {
    it("should ignore inherited locals values during request setup", async () => {
      const app = express();

      app.use((req, res) => {
        res.send({
          keys: Object.keys(res.locals),
          own: Object.hasOwn(res, "locals"),
          prototype: Object.getPrototypeOf(res.locals),
        });
      });

      await withObjectPrototypeProperties({
        locals: {
          polluted: true,
        },
      }, async () => {
        await request(app)
          .get("/")
          .expect(200, '{"keys":[],"own":true,"prototype":null}');
      });
    });
  });
});
