"use strict";

var { describe, it } = require("node:test");
var after = require("after");
var assert = require("node:assert");
var AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
const { Buffer } = require("node:buffer");
var express = require("..");
var path = require("node:path");
var request = require("supertest");
var utils = require("./support/utils");
var FIXTURES_PATH = path.join(__dirname, "fixtures");
describe("res", function () {
  describe(".download(path)", function () {
    it("should transfer as an attachment", async function () {
      var app = express();
      app.use(function (req, res) {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect("Content-Disposition", 'attachment; filename="user.html"')
        .expect(200, "<p>{{user.name}}</p>");
    });
    it("should accept range requests", async function () {
      var app = express();
      app.get("/", function (req, res) {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .expect("Accept-Ranges", "bytes")
        .expect(200, "<p>{{user.name}}</p>");
    });
    it("should respond with requested byte range", async function () {
      var app = express();
      app.get("/", function (req, res) {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .set("Range", "bytes=0-2")
        .expect("Content-Range", "bytes 0-2/20")
        .expect(206, "<p>");
    });
  });
  describe(".download(path, filename)", function () {
    it("should provide an alternate filename", async function () {
      var app = express();
      app.use(function (req, res) {
        res.download("test/fixtures/user.html", "document");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect("Content-Disposition", 'attachment; filename="document"')
        .expect(200);
    });
  });
  describe(".download(path, fn)", function () {
    it("should invoke the callback", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", cb);
        });
        request(app)
          .get("/")
          .expect("Content-Type", "text/html; charset=utf-8")
          .expect("Content-Disposition", 'attachment; filename="user.html"')
          .expect(200, cb);
      });
    });
    describe("async local storage", function () {
      it("should persist store", async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var cb = after(2, function (err) {
            if (err) {
              return reject(err);
            }
            resolve();
          });
          var store = {
            foo: "bar",
          };
          app.use(function (req, res, next) {
            req.asyncLocalStorage = new AsyncLocalStorage();
            req.asyncLocalStorage.run(store, next);
          });
          app.use(function (req, res) {
            res.download("test/fixtures/name.txt", function (err) {
              if (err) return cb(err);
              var local = req.asyncLocalStorage.getStore();
              assert.strictEqual(local.foo, "bar");
              cb();
            });
          });
          request(app)
            .get("/")
            .expect("Content-Type", "text/plain; charset=utf-8")
            .expect("Content-Disposition", 'attachment; filename="name.txt"')
            .expect(200, "tobi", cb);
        });
      });
      it("should persist store on error", async function () {
        var app = express();
        var store = {
          foo: "bar",
        };
        app.use(function (req, res, next) {
          req.asyncLocalStorage = new AsyncLocalStorage();
          req.asyncLocalStorage.run(store, next);
        });
        app.use(function (req, res) {
          res.download("test/fixtures/does-not-exist", function (err) {
            var local = req.asyncLocalStorage.getStore();
            if (local) {
              res.setHeader("x-store-foo", String(local.foo));
            }
            res.send(err ? "got " + err.status + " error" : "no error");
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("x-store-foo", "bar")
          .expect("got 404 error");
      });
    });
  });
  describe(".download(path, options)", function () {
    it("should allow options to res.sendFile()", async function () {
      var app = express();
      app.use(function (req, res) {
        res.download("test/fixtures/.name", {
          dotfiles: "allow",
          maxAge: "4h",
        });
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect("Content-Disposition", 'attachment; filename=".name"')
        .expect("Cache-Control", "public, max-age=14400")
        .expect(utils.shouldHaveBody(Buffer.from("tobi")));
    });
    describe('with "headers" option', function () {
      it("should set headers on response", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", {
            headers: {
              "X-Foo": "Bar",
              "X-Bar": "Foo",
            },
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("X-Foo", "Bar")
          .expect("X-Bar", "Foo");
      });
      it("should use last header when duplicated", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", {
            headers: {
              "X-Foo": "Bar",
              "x-foo": "bar",
            },
          });
        });
        await request(app).get("/").expect(200).expect("X-Foo", "bar");
      });
      it("should override Content-Type", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", {
            headers: {
              "Content-Type": "text/x-custom",
            },
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Content-Type", "text/x-custom");
      });
      it("should not set headers on 404", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/does-not-exist", {
            headers: {
              "X-Foo": "Bar",
            },
          });
        });
        await request(app)
          .get("/")
          .expect(404)
          .expect(utils.shouldNotHaveHeader("X-Foo"));
      });
      describe("when headers contains Content-Disposition", function () {
        it("should be ignored", async function () {
          var app = express();
          app.use(function (req, res) {
            res.download("test/fixtures/user.html", {
              headers: {
                "Content-Disposition": "inline",
              },
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Content-Disposition", 'attachment; filename="user.html"');
        });
        it("should be ignored case-insensitively", async function () {
          var app = express();
          app.use(function (req, res) {
            res.download("test/fixtures/user.html", {
              headers: {
                "content-disposition": "inline",
              },
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Content-Disposition", 'attachment; filename="user.html"');
        });
      });
    });
    describe('with "root" option', function () {
      it("should allow relative path", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("name.txt", {
            root: FIXTURES_PATH,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Content-Disposition", 'attachment; filename="name.txt"')
          .expect(utils.shouldHaveBody(Buffer.from("tobi")));
      });
      it("should allow up within root", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("fake/../name.txt", {
            root: FIXTURES_PATH,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Content-Disposition", 'attachment; filename="name.txt"')
          .expect(utils.shouldHaveBody(Buffer.from("tobi")));
      });
      it("should reject up outside root", async function () {
        var app = express();
        app.use(function (req, res) {
          var p =
            ".." +
            path.sep +
            path.relative(
              path.dirname(FIXTURES_PATH),
              path.join(FIXTURES_PATH, "name.txt"),
            );
          res.download(p, {
            root: FIXTURES_PATH,
          });
        });
        await request(app)
          .get("/")
          .expect(403)
          .expect(utils.shouldNotHaveHeader("Content-Disposition"));
      });
      it("should reject reading outside root", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("../name.txt", {
            root: FIXTURES_PATH,
          });
        });
        await request(app)
          .get("/")
          .expect(403)
          .expect(utils.shouldNotHaveHeader("Content-Disposition"));
      });
    });
  });
  describe(".download(path, filename, fn)", function () {
    it("should invoke the callback", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", "document", cb);
        });
        request(app)
          .get("/")
          .expect("Content-Type", "text/html; charset=utf-8")
          .expect("Content-Disposition", 'attachment; filename="document"')
          .expect(200, cb);
      });
    });
  });
  describe(".download(path, filename, options, fn)", function () {
    it("should invoke the callback", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        var options = {};
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", "document", options, cb);
        });
        request(app)
          .get("/")
          .expect(200)
          .expect("Content-Type", "text/html; charset=utf-8")
          .expect("Content-Disposition", 'attachment; filename="document"')
          .end(cb);
      });
    });
    it("should allow options to res.sendFile()", async function () {
      var app = express();
      app.use(function (req, res) {
        res.download("test/fixtures/.name", "document", {
          dotfiles: "allow",
          maxAge: "4h",
        });
      });
      await request(app)
        .get("/")
        .expect(200)
        .expect("Content-Disposition", 'attachment; filename="document"')
        .expect("Cache-Control", "public, max-age=14400")
        .expect(utils.shouldHaveBody(Buffer.from("tobi")));
    });
    describe("when options.headers contains Content-Disposition", function () {
      it("should be ignored", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", "document", {
            headers: {
              "Content-Type": "text/x-custom",
              "Content-Disposition": "inline",
            },
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Content-Type", "text/x-custom")
          .expect("Content-Disposition", 'attachment; filename="document"');
      });
      it("should be ignored case-insensitively", async function () {
        var app = express();
        app.use(function (req, res) {
          res.download("test/fixtures/user.html", "document", {
            headers: {
              "content-type": "text/x-custom",
              "content-disposition": "inline",
            },
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Content-Type", "text/x-custom")
          .expect("Content-Disposition", 'attachment; filename="document"');
      });
    });
  });
  describe("on failure", function () {
    it("should invoke the callback", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.download("test/fixtures/foobar.html", function (err) {
          if (!err) return next(new Error("expected error"));
          res.send("got " + err.status + " " + err.code);
        });
      });
      await request(app).get("/").expect(200, "got 404 ENOENT");
    });
    it("should remove Content-Disposition", async function () {
      var app = express();
      app.use(function (req, res, next) {
        res.download("test/fixtures/foobar.html", function (err) {
          if (!err) return next(new Error("expected error"));
          res.end("failed");
        });
      });
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Content-Disposition"))
        .expect(200, "failed");
    });
  });
});
