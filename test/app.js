"use strict";
import {describe, it, before, after} from "node:test";
let __testEnv;
import assert from "node:assert";
import express from "#express";
import request from "supertest";

describe("app", () => {
  it("should inherit from event emitter", async () => {
    const app = express();
    const emitted = new Promise(resolve => {
      app.on("foo", resolve);
    });
    app.emit("foo");
    await emitted;
  });

  it("should be callable", () => {
    const app = express();
    assert.equal(typeof app, "function");
  });

  it("should 404 without routes", async () => {
    await request(express()).get("/").expect(404);
  });
});

describe("app.parent", () => {
  it("should return the parent when mounted", () => {
    const app = express(), blog = express(), blogAdmin = express();

    app.use("/blog", blog);
    blog.use("/admin", blogAdmin);

    assert(!app.parent, "app.parent");
    assert.strictEqual(blog.parent, app);
    assert.strictEqual(blogAdmin.parent, blog);
  });
});

describe("app.mountpath", () => {
  it("should return the mounted path", () => {
    const admin = express();
    const app = express();
    const blog = express();
    const fallback = express();

    app.use("/blog", blog);
    app.use(fallback);
    blog.use("/admin", admin);

    assert.strictEqual(admin.mountpath, "/admin");
    assert.strictEqual(app.mountpath, "/");
    assert.strictEqual(blog.mountpath, "/blog");
    assert.strictEqual(fallback.mountpath, "/");
  });
});

describe("app.path()", () => {
  it("should return the canonical", () => {
    const app = express(), blog = express(), blogAdmin = express();

    app.use("/blog", blog);
    blog.use("/admin", blogAdmin);

    assert.strictEqual(app.path(), "");
    assert.strictEqual(blog.path(), "/blog");
    assert.strictEqual(blogAdmin.path(), "/blog/admin");
  });
});

describe("in development", () => {
  before(() => {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
  });

  after(() => {
    process.env.NODE_ENV = __testEnv;
  });

  it('should disable "view cache"', () => {
    const app = express();
    assert.ok(!app.enabled("view cache"));
  });
});

describe("in production", () => {
  before(() => {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
  });

  after(() => {
    process.env.NODE_ENV = __testEnv;
  });

  it('should enable "view cache"', () => {
    const app = express();
    assert.ok(app.enabled("view cache"));
  });
});

describe("without NODE_ENV", () => {
  before(() => {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "";
  });

  after(() => {
    process.env.NODE_ENV = __testEnv;
  });

  it("should default to development", () => {
    const app = express();
    assert.strictEqual(app.get("env"), "development");
  });
});
