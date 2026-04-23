"use strict";

import {describe, it} from "node:test";
import after from "#test/support/after";
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import {Buffer} from "node:buffer";
import express from "#express";
import fs from "node:fs";
import os from "node:os";
import request from "supertest";
import onFinished from "#lib/utils/on-finished";
import path from "node:path";
import utils from "#test/support/utils";

const fixtures = path.join(import.meta.dirname, "fixtures");
describe("res", () => {
  describe(".sendFile(path)", () => {
    it("should error missing path", async () => {
      const app = createApp();
      await request(app)
        .get("/")
        .expect(500, /path.*required/);
    });
    it("should error for non-string path", async () => {
      const app = createApp(42);
      await request(app)
        .get("/")
        .expect(500, /TypeError: path must be a string to res.sendFile/);
    });
    it("should error for non-absolute path", async () => {
      const app = createApp("name.txt");
      await request(app)
        .get("/")
        .expect(500, /TypeError: path must be absolute/);
    });
    it("should transfer a file", async () => {
      const app = createApp(path.resolve(fixtures, "name.txt"));
      await request(app).get("/").expect(200, "tobi");
    });
    it("should transfer a file with special characters in string", async () => {
      const app = createApp(path.resolve(fixtures, "% of dogs.txt"));
      await request(app).get("/").expect(200, "20%");
    });
    it("should include ETag", async () => {
      const app = createApp(path.resolve(fixtures, "name.txt"));
      await request(app)
        .get("/")
        .expect("ETag", /^(?:W\/)?"[^"]+"$/)
        .expect(200, "tobi");
    });
    it("should 304 when ETag matches", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp(path.resolve(fixtures, "name.txt"));
        request(app)
          .get("/")
          .expect("ETag", /^(?:W\/)?"[^"]+"$/)
          .expect(200, "tobi", (err, res) => {
            if (err) return reject(err);
            const etag = res.headers.etag;
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
    it("should support precondition checks", async () => {
      const app = createApp(path.resolve(fixtures, "name.txt"));

      await request(app)
        .get("/")
        .set("If-Match", '"foo"')
        .expect(412);
    });
    it("should support comma-separated If-Match validators", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp(path.resolve(fixtures, "name.txt"));

        request(app)
          .get("/")
          .expect("ETag", /^(?:W\/)?"[^"]+"$/)
          .expect(200, "tobi", (err, res) => {
            if (err) return reject(err);

            request(app)
              .get("/")
              .set("If-Match", ` "foo", ${res.headers.etag} `)
              .expect(200, "tobi", secondErr => {
                if (secondErr) {
                  reject(secondErr);
                  return;
                }

                resolve();
              });
          });
      });
    });
    it("should disable the ETag function if requested", async () => {
      const app = createApp(path.resolve(fixtures, "name.txt")).disable("etag");
      await request(app).get("/").expect(handleHeaders).expect(200);
      function handleHeaders(res) {
        assert(res.headers.etag === undefined);
      }
    });
    it("should 404 for directory", async () => {
      const app = createApp(path.resolve(fixtures, "blog"));
      await request(app).get("/").expect(404);
    });
    it("should 404 when not found", async () => {
      const app = createApp(path.resolve(fixtures, "does-no-exist"));
      app.use((req, res) => {
        res.statusCode = 200;
        res.send("no!");
      });
      await request(app).get("/").expect(404);
    });
    it("should send cache-control by default", async () => {
      const app = createApp(path.resolve(import.meta.dirname, "fixtures/name.txt"));
      await request(app)
        .get("/")
        .expect("Cache-Control", "public, max-age=0")
        .expect(200);
    });
    it("should not serve dotfiles by default", async () => {
      const app = createApp(path.resolve(import.meta.dirname, "fixtures/.name"));
      await request(app).get("/").expect(404);
    });
    it("should not override manual content-types", async () => {
      const app = express();
      app.use((req, res) => {
        res.contentType("application/x-bogus");
        res.sendFile(path.resolve(fixtures, "name.txt"));
      });
      await request(app).get("/").expect("Content-Type", "application/x-bogus");
    });
    it("should not error if the client aborts", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        let error = null;
        app.use((req, res) => {
          setImmediate(() => {
            res.sendFile(path.resolve(fixtures, "name.txt"));
            setTimeout(() => {
              cb(error);
            }, 10);
          });
          test.req.abort();
        });
        app.use((err, req, res, next) => {
          error = err;
          next(err);
        });
        const server = app.listen();
        const test = request(server).get("/");
        test.end(err => {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
  });
  describe(".sendFile(path, fn)", () => {
    it("should invoke the callback when complete", async () => {
      await new Promise((resolve, reject) => {
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const app = createApp(path.resolve(fixtures, "name.txt"), cb);
        request(app).get("/").expect(200, cb);
      });
    });
    it("should invoke the callback when client aborts", async () => {
      await new Promise((resolve, reject) => {
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const app = express();
        app.use((req, res) => {
          setImmediate(() => {
            res.sendFile(path.resolve(fixtures, "name.txt"), err => {
              assert.ok(err);
              assert.strictEqual(err.code, "ECONNABORTED");
              cb();
            });
          });
          test.req.abort();
        });
        const server = app.listen();
        const test = request(server).get("/");
        test.end(err => {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
    it("should invoke the callback when client already aborted", async () => {
      await new Promise((resolve, reject) => {
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const app = express();
        app.use((req, res) => {
          onFinished(res, () => {
            res.sendFile(path.resolve(fixtures, "name.txt"), err => {
              assert.ok(err);
              assert.strictEqual(err.code, "ECONNABORTED");
              cb();
            });
          });
          test.req.abort();
        });
        const server = app.listen();
        const test = request(server).get("/");
        test.end(err => {
          assert.ok(err);
          server.close(cb);
        });
      });
    });
    it("should invoke the callback without error when HEAD", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "name.txt"), cb);
        });
        request(app).head("/").expect(200, cb);
      });
    });
    it("should invoke the callback without error when 304", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(3, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "name.txt"), cb);
        });
        request(app)
          .get("/")
          .expect("ETag", /^(?:W\/)?"[^"]+"$/)
          .expect(200, "tobi", (err, res) => {
            if (err) return cb(err);
            const etag = res.headers.etag;
            request(app).get("/").set("If-None-Match", etag).expect(304, cb);
          });
      });
    });
    it("should invoke the callback on 404", async () => {
      const app = express();
      app.use((req, res) => {
        res.sendFile(path.resolve(fixtures, "does-not-exist"), err => {
          res.send(err ? "got " + err.status + " error" : "no error");
        });
      });
      await request(app).get("/").expect(200, "got 404 error");
    });
    describe("async local storage", () => {
      it("should persist store", async () => {
        await new Promise((resolve, reject) => {
          const app = express();
          const cb = after(2, err => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
          const store = {
            foo: "bar",
          };
          app.use((req, res, next) => {
            req.asyncLocalStorage = new AsyncLocalStorage();
            req.asyncLocalStorage.run(store, next);
          });
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "name.txt"), err => {
              if (err) return cb(err);
              const local = req.asyncLocalStorage.getStore();
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
      it("should persist store on error", async () => {
        const app = express();
        const store = {
          foo: "bar",
        };
        app.use((req, res, next) => {
          req.asyncLocalStorage = new AsyncLocalStorage();
          req.asyncLocalStorage.run(store, next);
        });
        app.use((req, res) => {
          res.sendFile(
            path.resolve(fixtures, "does-not-exist"),
            err => {
              const local = req.asyncLocalStorage.getStore();
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
  describe(".sendFile(path, options)", () => {
    it("should pass options to send module", async () => {
      await request(
        createApp(path.resolve(fixtures, "name.txt"), {
          start: 0,
          end: 1,
        }),
      )
        .get("/")
        .expect(200, "to");
    });
    describe('with "acceptRanges" option', () => {
      describe("when true", () => {
        it("should advertise byte range accepted", async () => {
          const app = express();
          app.use((req, res) => {
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
        it("should respond to range request", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: true,
            });
          });
          await request(app)
            .get("/")
            .set("Range", "bytes=0-4")
            .expect(206, "12345");
        });
        it("should ignore range when If-Range ETag is stale", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: true,
            });
          });
          await request(app)
            .get("/")
            .set("Range", "bytes=0-4")
            .set("If-Range", '"stale"')
            .expect(200, "123456789");
        });
        it("should ignore range when If-Range date is stale", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: true,
            });
          });
          await request(app)
            .get("/")
            .set("Range", "bytes=0-4")
            .set("If-Range", new Date(0).toUTCString())
            .expect(200, "123456789");
        });
      });
      describe("when false", () => {
        it("should not advertise accept-ranges", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "nums.txt"), {
              acceptRanges: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Accept-Ranges"));
        });
        it("should not honor range requests", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "cacheControl" option', () => {
      describe("when true", () => {
        it("should send cache-control header", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe("when false", () => {
        it("should not send cache-control header", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "dotfiles" option', () => {
      it("should reject invalid values", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, ".name"), {
            dotfiles: "nope",
          });
        });
        await request(app)
          .get("/")
          .expect(500, /dotfiles option must be/);
      });
      describe('when "allow"', () => {
        it("should allow dotfiles", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe('when "deny"', () => {
        it("should deny dotfiles", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe('when "ignore"', () => {
        it("should ignore dotfiles", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "headers" option', () => {
      it("should set headers on response", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should use last header when duplicated", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            headers: {
              "X-Foo": "Bar",
              "x-foo": "bar",
            },
          });
        });
        await request(app).get("/").expect(200).expect("X-Foo", "bar");
      });
      it("should override Content-Type", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should not set headers on 404", async () => {
        const app = express();
        app.use((req, res) => {
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
    describe('with "immutable" option', () => {
      describe("when true", () => {
        it("should send cache-control header with immutable", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe("when false", () => {
        it("should not send cache-control header with immutable", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "lastModified" option', () => {
      describe("when true", () => {
        it("should send last-modified header", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: true,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldHaveHeader("Last-Modified"));
        });
        it("should conditionally respond with if-modified-since", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe("when false", () => {
        it("should not have last-modified header", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              lastModified: false,
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect(utils.shouldNotHaveHeader("Last-Modified"));
        });
        it("should not honor if-modified-since", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "maxAge" option', () => {
      it("should set cache-control max-age to milliseconds", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 20000,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=20");
      });
      it("should cap cache-control max-age to 1 year", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 99999999999,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=31536000");
      });
      it("should min cache-control max-age to 0", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: -20000,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=0");
      });
      it("should floor cache-control max-age", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "user.html"), {
            maxAge: 21911.23,
          });
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Cache-Control", "public, max-age=21");
      });
      describe("when cacheControl: false", () => {
        it("should not send cache-control", async () => {
          const app = express();
          app.use((req, res) => {
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
      describe("when string", () => {
        it("should accept plain number as milliseconds", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20000",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=20");
        });
        it('should accept suffix "s" for seconds', async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20s",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=20");
        });
        it('should accept suffix "m" for minutes', async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20m",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=1200");
        });
        it('should accept suffix "d" for days', async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "20d",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=1728000");
        });
        it("should treat invalid strings as 0", async () => {
          const app = express();
          app.use((req, res) => {
            res.sendFile(path.resolve(fixtures, "user.html"), {
              maxAge: "pizza",
            });
          });
          await request(app)
            .get("/")
            .expect(200)
            .expect("Cache-Control", "public, max-age=0");
        });
      });
    });
    describe('with "extensions" option', () => {
      it("should reject non-string entries", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile("todo", {
            extensions: ["txt", 42],
            root: fixtures,
          });
        });
        await request(app)
          .get("/")
          .expect(500, /extensions option must be array of strings or false/);
      });
    });
    describe('with "index" option', () => {
      it("should reject non-string entries", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile(path.resolve(fixtures, "users/"), {
            index: ["index.html", 42],
          });
        });
        await request(app)
          .get("/")
          .expect(500, /index option must be array of strings or false/);
      });
    });
    describe('with "root" option', () => {
      it("should allow relative path", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile("name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(200, "tobi");
      });
      it("should allow up within root", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile("fake/../name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(200, "tobi");
      });
      it("should reject up outside root", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should reject reading outside root", async () => {
        const app = express();
        app.use((req, res) => {
          res.sendFile("../name.txt", {
            root: fixtures,
          });
        });
        await request(app).get("/").expect(403);
      });
      it("should not follow symlinks outside root", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-sendfile-"));
        const root = path.join(tempRoot, "root");

        try {
          fs.mkdirSync(root);
          fs.symlinkSync(fixtures, path.join(root, "escape"));

          const app = express();
          app.use((req, res) => {
            res.sendFile("escape/name.txt", {
              root,
            });
          });

          await request(app).get("/").expect(403);
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });

      it("should reject outside files after root is replaced with a symlink", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-sendfile-"));
        const root = path.join(tempRoot, "root");
        const outside = path.join(tempRoot, "outside");

        try {
          fs.mkdirSync(root);
          fs.mkdirSync(outside);
          fs.writeFileSync(path.join(root, "file.txt"), "SAFE");
          fs.writeFileSync(path.join(outside, "file.txt"), "PWN!");

          const app = express();
          app.use((req, res) => {
            res.sendFile("file.txt", {
              root,
            });
          });

          await request(app).get("/").expect(200, "SAFE");

          fs.rmSync(root, { recursive: true, force: true });
          fs.symlinkSync(outside, root);

          await request(app).get("/").expect(403);
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });

      it("should keep serving the validated file when a symlink changes after headers", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-sendfile-"));
        const root = path.join(tempRoot, "root");
        const safe = path.join(root, "safe");
        const outside = path.join(tempRoot, "outside");

        try {
          fs.mkdirSync(root);
          fs.mkdirSync(safe);
          fs.mkdirSync(outside);
          fs.writeFileSync(path.join(safe, "file.txt"), "SAFE");
          fs.writeFileSync(path.join(outside, "file.txt"), "PWN!");
          fs.symlinkSync(safe, path.join(root, "link"));

          const app = express();
          app.use((req, res) => {
            const setHeader = res.setHeader.bind(res);
            let swapped = false;

            res.setHeader = function patchedSetHeader(name, value) {
              if (!swapped && name === "Content-Length") {
                swapped = true;
                fs.rmSync(path.join(root, "link"));
                fs.symlinkSync(outside, path.join(root, "link"));
              }

              return setHeader(name, value);
            };

            res.sendFile("link/file.txt", {
              root,
            });
          });

          await request(app).get("/").expect(200, "SAFE");
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });

    });
  });
});
function createApp(path, options, fn) {
  const app = express();
  app.use((req, res) => {
    res.sendFile(path, options, fn);
  });
  return app;
}
