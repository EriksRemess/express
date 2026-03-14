"use strict";

var { describe, it } = require("node:test");
var after = require("after");
var assert = require("node:assert");
var AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
const { Buffer } = require("node:buffer");
var express = require("../"),
  request = require("supertest");
var onFinished = require("on-finished");
var path = require("node:path");
var fixtures = path.join(__dirname, "fixtures");
var utils = require("./support/utils");
describe("res", function () {
  describe(".sendFile(path)", function () {
    it("should error missing path", async function () {
      var app = createApp();
      await request(app)
        .get("/")
        .expect(500, /path.*required/);
    });
    it("should error for non-string path", async function () {
      var app = createApp(42);
      await request(app)
        .get("/")
        .expect(500, /TypeError: path must be a string to res.sendFile/);
    });
    it("should error for non-absolute path", async function () {
      var app = createApp("name.txt");
      await request(app)
        .get("/")
        .expect(500, /TypeError: path must be absolute/);
    });
    it("should transfer a file", async function () {
      var app = createApp(path.resolve(fixtures, "name.txt"));
      await request(app).get("/").expect(200, "tobi");
    });
    it("should transfer a file with special characters in string", async function () {
      var app = createApp(path.resolve(fixtures, "% of dogs.txt"));
      await request(app).get("/").expect(200, "20%");
    });
    it("should include ETag", async function () {
      var app = createApp(path.resolve(fixtures, "name.txt"));
      await request(app)
        .get("/")
        .expect("ETag", /^(?:W\/)?"[^"]+"$/)
        .expect(200, "tobi");
    });
    it("should 304 when ETag matches", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp(path.resolve(fixtures, "name.txt"));
        request(app)
          .get("/")
          .expect("ETag", /^(?:W\/)?"[^"]+"$/)
          .expect(200, "tobi", function (err, res) {
            if (err) return reject(err);
            var etag = res.headers.etag;
            request(app)
              .get("/")
              .set("If-None-Match", etag)
              .expect(304, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });
    it("should disable the ETag function if requested", async function () {
      var app = createApp(path.resolve(fixtures, "name.txt")).disable("etag");
      await request(app).get("/").expect(handleHeaders).expect(200);
      function handleHeaders(res) {
        assert(res.headers.etag === undefined);
      }
    });
    it("should 404 for directory", async function () {
      var app = createApp(path.resolve(fixtures, "blog"));
      await request(app).get("/").expect(404);
    });
    it("should 404 when not found", async function () {
      var app = createApp(path.resolve(fixtures, "does-no-exist"));
      app.use(function (req, res) {
        res.statusCode = 200;
        res.send("no!");
      });
      await request(app).get("/").expect(404);
    });
    it("should send cache-control by default", async function () {
      var app = createApp(path.resolve(__dirname, "fixtures/name.txt"));
      await request(app)
        .get("/")
        .expect("Cache-Control", "public, max-age=0")
        .expect(200);
    });
    it("should not serve dotfiles by default", async function () {
      var app = createApp(path.resolve(__dirname, "fixtures/.name"));
      await request(app).get("/").expect(404);
    });
    it("should not override manual content-types", async function () {
      var app = express();
      app.use(function (req, res) {
        res.contentType("application/x-bogus");
        res.sendFile(path.resolve(fixtures, "name.txt"));
      });
      await request(app).get("/").expect("Content-Type", "application/x-bogus");
    });
    it("should not error if the client aborts", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        var error = null;
        app.use(function (req, res) {
          setImmediate(function () {
            res.sendFile(path.resolve(fixtures, "name.txt"));
            setTimeout(function () {
              cb(error);
            }, 10);
          });
          test.req.abort();
        });
        app.use(function (err, req, res, next) {
          error = err;
          next(err);
        });
        var server = app.listen();
        var test = request(server).get("/");
        test.end(function (err) {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
  });
  describe(".sendFile(path, fn)", function () {
    it("should invoke the callback when complete", async function () {
      await new Promise((resolve, reject) => {
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        var app = createApp(path.resolve(fixtures, "name.txt"), cb);
        request(app).get("/").expect(200, cb);
      });
    });
    it("should invoke the callback when client aborts", async function () {
      await new Promise((resolve, reject) => {
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        var app = express();
        app.use(function (req, res) {
          setImmediate(function () {
            res.sendFile(path.resolve(fixtures, "name.txt"), function (err) {
              assert.ok(err);
              assert.strictEqual(err.code, "ECONNABORTED");
              cb();
            });
          });
          test.req.abort();
        });
        var server = app.listen();
        var test = request(server).get("/");
        test.end(function (err) {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
    it("should invoke the callback when client already aborted", async function () {
      await new Promise((resolve, reject) => {
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        var app = express();
        app.use(function (req, res) {
          onFinished(res, function () {
            res.sendFile(path.resolve(fixtures, "name.txt"), function (err) {
              assert.ok(err);
              assert.strictEqual(err.code, "ECONNABORTED");
              cb();
            });
          });
          test.req.abort();
        });
        var server = app.listen();
        var test = request(server).get("/");
        test.end(function (err) {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
    it("should invoke the callback without error when HEAD", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(2, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "name.txt"), cb);
        });
        request(app).head("/").expect(200, cb);
      });
    });
    it("should invoke the callback without error when 304", async function () {
      await new Promise((resolve, reject) => {
        var app = express();
        var cb = after(3, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "name.txt"), cb);
        });
        request(app)
          .get("/")
          .expect("ETag", /^(?:W\/)?"[^"]+"$/)
          .expect(200, "tobi", function (err, res) {
            if (err) return cb(err);
            var etag = res.headers.etag;
            request(app).get("/").set("If-None-Match", etag).expect(304, cb);
          });
      });
    });
    it("should invoke the callback on 404", async function () {
      var app = express();
      app.use(function (req, res) {
        res.sendFile(path.resolve(fixtures, "does-not-exist"), function (err) {
          res.send(err ? "got " + err.status + " error" : "no error");
        });
      });
      await request(app).get("/").expect(200, "got 404 error");
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
            res.sendFile(path.resolve(fixtures, "name.txt"), function (err) {
              if (err) return cb(err);
              var local = req.asyncLocalStorage.getStore();
              assert.strictEqual(local.foo, "bar");
              cb();
            });
          });
          request(app)
            .get("/")
            .expect("Content-Type", "text/plain; charset=utf-8")
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
          res.sendFile(
            path.resolve(fixtures, "does-not-exist"),
            function (err) {
              var local = req.asyncLocalStorage.getStore();
              if (local) {
                res.setHeader("x-store-foo", String(local.foo));
              }
              res.send(err ? "got " + err.status + " error" : "no error");
            },
          );
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("x-store-foo", "bar")
          .expect("got 404 error");
      });
    });
  });
  describe(".sendFile(path, options)", function () {
    it("should pass options to send module", async function () {
      await request(
        createApp(path.resolve(fixtures, "name.txt"), {
          start: 0,
          end: 1,
        }),
      )
        .get("/")
        .expect(200, "to");
    });
    describe('with "acceptRanges" option', function () {
      describe("when true", function () {
        it("should advertise byte range accepted", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: true,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Accept-Ranges", "bytes")
            .expect("123456789");
        });
        it("should respond to range request", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: true,
            });
          });
          await request(app)
            .get("/")
            .set("Range", "bytes=0-4")
            .expect(206, "12345");
        });
      });
      describe("when false", function () {
        it("should not advertise accept-ranges", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Accept-Ranges"));
        });
        it("should not honor range requests", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: false,
            });
          });
          await request(app)
            .get("/")
            .set("Range", "bytes=0-4")
            .expect(200, "123456789");
        });
      });
    });
    describe('with "cacheControl" option', function () {
      describe("when true", function () {
        it("should send cache-control header", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              cacheControl: true,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=0");
        });
      });
      describe("when false", function () {
        it("should not send cache-control header", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              cacheControl: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Cache-Control"));
        });
      });
    });
    describe('with "dotfiles" option', function () {
      describe('when "allow"', function () {
        it("should allow dotfiles", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, ".name"), {
              dotfiles: "allow",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldHaveBody(Buffer.from("tobi")));
        });
      });
      describe('when "deny"', function () {
        it("should deny dotfiles", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, ".name"), {
              dotfiles: "deny",
            });
          });
          await request(app)
            .get("/")
            .expect(403)
            .expect(/Forbidden/);
        });
      });
      describe('when "ignore"', function () {
        it("should ignore dotfiles", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, ".name"), {
              dotfiles: "ignore",
            });
          });
          await request(app)
            .get("/")
            .expect(404)
            .expect(/Not Found/);
        });
      });
    });
    describe('with "headers" option', function () {
      it("should set headers on response", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "user.html"), {
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
          res.sendFile(path.resolve(fixtures, "user.html"), {
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
          res.sendFile(path.resolve(fixtures, "user.html"), {
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
          res.sendFile(path.resolve(fixtures, "does-not-exist"), {
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
    });
    describe('with "immutable" option', function () {
      describe("when true", function () {
        it("should send cache-control header with immutable", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              immutable: true,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=0, immutable");
        });
      });
      describe("when false", function () {
        it("should not send cache-control header with immutable", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              immutable: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=0");
        });
      });
    });
    describe('with "lastModified" option', function () {
      describe("when true", function () {
        it("should send last-modified header", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: true,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldHaveHeader("Last-Modified"));
        });
        it("should conditionally respond with if-modified-since", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: true,
            });
          });
          await request(app)
            .get("/")
            .set(
              "If-Modified-Since",
              new Date(Date.now() + 99999).toUTCString(),
            )
            .expect(304);
        });
      });
      describe("when false", function () {
        it("should not have last-modified header", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Last-Modified"));
        });
        it("should not honor if-modified-since", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: false,
            });
          });
          await request(app)
            .get("/")
            .set(
              "If-Modified-Since",
              new Date(Date.now() + 99999).toUTCString(),
            )
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Last-Modified"));
        });
      });
    });
    describe('with "maxAge" option', function () {
      it("should set cache-control max-age to milliseconds", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 20000,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=20");
      });
      it("should cap cache-control max-age to 1 year", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 99999999999,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=31536000");
      });
      it("should min cache-control max-age to 0", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: -20000,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=0");
      });
      it("should floor cache-control max-age", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 21911.23,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=21");
      });
      describe("when cacheControl: false", function () {
        it("should not send cache-control", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              cacheControl: false,
              maxAge: 20000,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Cache-Control"));
        });
      });
      describe("when string", function () {
        it("should accept plain number as milliseconds", async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20000",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=20");
        });
        it('should accept suffix "s" for seconds', async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20s",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=20");
        });
        it('should accept suffix "m" for minutes', async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20m",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=1200");
        });
        it('should accept suffix "d" for days', async function () {
          var app = express();
          app.use(function (req, res) {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20d",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=1728000");
        });
      });
    });
    describe('with "root" option', function () {
      it("should allow relative path", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile("name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(200, "tobi");
      });
      it("should allow up within root", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile("fake/../name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(200, "tobi");
      });
      it("should reject up outside root", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile(
            ".." +
              path.sep +
              path.relative(
                path.dirname(fixtures),
                path.join(fixtures, "name.txt"),
              ),
            {
              root: fixtures,
            },
          );
        });
        await request(app).get("/").expect(403);
      });
      it("should reject reading outside root", async function () {
        var app = express();
        app.use(function (req, res) {
          res.sendFile("../name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(403);
      });
    });
  });
});
function createApp(path, options, fn) {
  var app = express();
  app.use(function (req, res) {
    res.sendFile(path, options, fn);
  });
  return app;
}
