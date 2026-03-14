"use strict";
var { describe, it, before, after: afterHook } = require("node:test");
var __testEnv;
var assert = require("node:assert");
var express = require("..");
var request = require("supertest");

describe("app", function () {
  it("should inherit from event emitter", async function () {
    var app = express();
    var emitted = new Promise(function (resolve) {
      app.on("foo", resolve);
    });
    app.emit("foo");
    await emitted;
  });

  it("should be callable", function () {
    var app = express();
    assert.equal(typeof app, "function");
  });

  it("should 404 without routes", async function () {
    await request(express()).get("/").expect(404);
  });
});

describe("app.parent", function () {
  it("should return the parent when mounted", function () {
    var app = express(),
      blog = express(),
      blogAdmin = express();

    app.use("/blog", blog);
    blog.use("/admin", blogAdmin);

    assert(!app.parent, "app.parent");
    assert.strictEqual(blog.parent, app);
    assert.strictEqual(blogAdmin.parent, blog);
  });
});

describe("app.mountpath", function () {
  it("should return the mounted path", function () {
    var admin = express();
    var app = express();
    var blog = express();
    var fallback = express();

    app.use("/blog", blog);
    app.use(fallback);
    blog.use("/admin", admin);

    assert.strictEqual(admin.mountpath, "/admin");
    assert.strictEqual(app.mountpath, "/");
    assert.strictEqual(blog.mountpath, "/blog");
    assert.strictEqual(fallback.mountpath, "/");
  });
});

describe("app.path()", function () {
  it("should return the canonical", function () {
    var app = express(),
      blog = express(),
      blogAdmin = express();

    app.use("/blog", blog);
    blog.use("/admin", blogAdmin);

    assert.strictEqual(app.path(), "");
    assert.strictEqual(blog.path(), "/blog");
    assert.strictEqual(blogAdmin.path(), "/blog/admin");
  });
});

describe("in development", function () {
  before(function () {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
  });

  afterHook(function () {
    process.env.NODE_ENV = __testEnv;
  });

  it('should disable "view cache"', function () {
    var app = express();
    assert.ok(!app.enabled("view cache"));
  });
});

describe("in production", function () {
  before(function () {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
  });

  afterHook(function () {
    process.env.NODE_ENV = __testEnv;
  });

  it('should enable "view cache"', function () {
    var app = express();
    assert.ok(app.enabled("view cache"));
  });
});

describe("without NODE_ENV", function () {
  before(function () {
    __testEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "";
  });

  afterHook(function () {
    process.env.NODE_ENV = __testEnv;
  });

  it("should default to development", function () {
    var app = express();
    assert.strictEqual(app.get("env"), "development");
  });
});
