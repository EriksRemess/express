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
import { withObjectPrototypeProperties } from "#test/support/object-prototype";

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
    it("should ignore inherited range header values", async () => {
      const app = express();

      app.use((req, res, next) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "range");
        let restored = false;

        function restore() {
          if (restored) {
            return;
          }

          restored = true;
          if (descriptor) {
            Object.defineProperty(Object.prototype, "range", descriptor);
          } else {
            delete Object.prototype.range;
          }
        }

        Object.defineProperty(Object.prototype, "range", {
          configurable: true,
          value: "bytes=0-0",
          writable: true,
        });
        Object.setPrototypeOf(req.headers, Object.prototype);
        res.once("close", restore);
        res.once("finish", restore);
        next();
      });

      app.use((req, res) => {
        res.sendFile(path.resolve(fixtures, "name.txt"));
      });

      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Content-Range"))
        .expect(200, "tobi");
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
        const app = createApp(path.resolve(fixtures, "name.txt"), {
          headers: { ETag: '"strong"' },
        });

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

      it("should not follow extension fallback symlinks outside root", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-sendfile-"));
        const root = path.join(tempRoot, "root");
        const outside = path.join(tempRoot, "outside");

        try {
          fs.mkdirSync(root);
          fs.mkdirSync(outside);
          fs.writeFileSync(path.join(outside, "escape.txt"), "PWN!");
          fs.symlinkSync(path.join(outside, "escape.txt"), path.join(root, "escape.txt"));

          const app = express();
          app.use((req, res) => {
            res.sendFile("escape", {
              extensions: "txt",
              root,
            });
          });

          await request(app).get("/").expect(403);
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
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

      it("should not follow index fallback symlinks outside root", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-sendfile-"));
        const root = path.join(tempRoot, "root");
        const docs = path.join(root, "docs");
        const outside = path.join(tempRoot, "outside");

        try {
          fs.mkdirSync(docs, { recursive: true });
          fs.mkdirSync(outside);
          fs.writeFileSync(path.join(outside, "index.html"), "PWN!");
          fs.symlinkSync(path.join(outside, "index.html"), path.join(docs, "index.html"));

          const app = express();
          app.use((req, res) => {
            res.sendFile("docs/", {
              root,
            });
          });

          await request(app).get("/").expect(403);
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });
    });
    describe('with "root" option', () => {
      it("should ignore inherited root option", async () => {
        await withObjectPrototypeProperties({
          root: fixtures,
        }, async () => {
          const app = express();

          app.use((req, res) => {
            res.sendFile("name.txt");
          });

          await request(app)
            .get("/")
            .expect(500, /path must be absolute or specify root/);
        });
      });
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

describe("file range and precondition regressions", () => {
  for (const staticMiddleware of [false, true]) {
    function fileApp(headers) {
      const app = express();
      if (headers) app.use((req, res, next) => { res.set(headers); next(); });
      if (staticMiddleware) app.use(express.static(fixtures));
      else app.use((req, res) => res.sendFile(path.join(fixtures, "name.txt")));
      return app;
    }

    it(`should return the whole file for an oversized suffix range (static=${staticMiddleware})`, async () => {
      await request(fileApp()).get("/name.txt").set("Range", "bytes=-1000")
        .expect(206, "tobi").expect("Content-Range", "bytes 0-3/4");
      await request(fileApp()).get("/name.txt").set("Range", "bytes=-0").expect(416);
    });

    it(`should reject weak If-Match validators (static=${staticMiddleware})`, async () => {
      const app = fileApp();
      const response = await request(app).get("/name.txt").expect(200);
      for (const etag of [response.headers.etag, response.headers.etag.slice(2)]) {
        await request(app).get("/name.txt").set("If-Match", etag).expect(412);
      }
      await request(app).get("/name.txt").set("If-None-Match", response.headers.etag).expect(304);
    });

    it(`should accept strong If-Match lists (static=${staticMiddleware})`, async () => {
      const app = fileApp({ ETag: '"strong"' });
      await request(app).get("/name.txt").set("If-Match", '"stale", "strong"').expect(200, "tobi");
      await request(app).get("/name.txt").set("If-Match", 'W/"strong"').expect(412);
    });

    it(`should accept If-Match wildcard when ETags are disabled (static=${staticMiddleware})`, async () => {
      await request(fileApp().disable("etag")).get("/name.txt").set("If-Match", "*").expect(200, "tobi");
    });

    it(`should ignore ranges with weak If-Range validators (static=${staticMiddleware})`, async () => {
      const app = fileApp();
      const response = await request(app).get("/name.txt").expect(200);
      await request(app).get("/name.txt").set("Range", "bytes=0-1")
        .set("If-Range", response.headers.etag).expect(200, "tobi");
    });

    it(`should require an exact strong If-Range match (static=${staticMiddleware})`, async () => {
      const app = fileApp({ ETag: '"strong"' });
      await request(app).get("/name.txt").set("Range", "bytes=0-1")
        .set("If-Range", '"strong"').expect(206, "to");
      for (const etag of ['W/"strong"', '"stale", "strong"']) {
        await request(app).get("/name.txt").set("Range", "bytes=0-1")
          .set("If-Range", etag).expect(200, "tobi");
      }
    });
  }
});

describe("file conditional method and validator handling", () => {
  const modified = "Tue, 01 Jan 2019 00:00:00 GMT";
  const later = "Wed, 02 Jan 2019 00:00:00 GMT";
  const etag = '"v1,revision2"';

  for (const customHeaders of [false, true]) {
    function appForFile() {
      const app = express();
      app.use((req, res) => {
        const headers = { ETag: etag, "Last-Modified": modified };
        if (!customHeaders) res.set(headers);
        res.sendFile(path.join(fixtures, "name.txt"), customHeaders ? { headers } : undefined);
      });
      return app;
    }

    it(`should compare quoted comma-containing ETags (headers=${customHeaders})`, async () => {
      const app = appForFile();
      await request(app).get("/").set("If-Match", `"stale", ${etag}`).expect(200, "tobi");
      await request(app).get("/").set("If-None-Match", etag).expect(304);
    });

    for (const method of ["post", "put", "patch", "delete"]) {
      it(`should return 412 for matching ${method} If-None-Match (headers=${customHeaders})`, async () => {
        const app = appForFile();
        for (const noneMatch of ["*", etag, `W/${etag}`]) {
          await request(app)[method]("/").set("If-None-Match", noneMatch)
            .set("Cache-Control", "no-cache").expect(412);
        }
        await request(app)[method]("/").set("If-Match", etag).set("If-None-Match", etag).expect(412);
        await request(app)[method]("/").set("If-Match", "*").set("If-None-Match", "*").expect(412);
        await request(app)[method]("/").set("If-None-Match", '"stale"').expect(200, "tobi");
      });

      it(`should ignore ${method} ranges and If-Modified-Since (headers=${customHeaders})`, async () => {
        await request(appForFile())[method]("/").set("Range", "bytes=0-1")
          .set("If-Modified-Since", later).expect(200, "tobi")
          .expect("Content-Length", "4").expect(utils.shouldNotHaveHeader("Content-Range"));
      });
    }

    it(`should retain HEAD revalidation and ignore HEAD ranges (headers=${customHeaders})`, async () => {
      const app = appForFile();
      await request(app).head("/").set("If-None-Match", etag).expect(304);
      await request(app).head("/").set("Range", "bytes=0-1").expect(200)
        .expect("Content-Length", "4").expect(utils.shouldNotHaveHeader("Content-Range"));
    });

    it(`should retain QUERY revalidation (headers=${customHeaders})`, async () => {
      const result = await new Promise((resolve, reject) => {
        utils.rawRequest(appForFile(), { method: "QUERY", path: "/", headers: { "If-None-Match": etag } },
          (err, res) => err ? reject(err) : resolve(res));
      });
      assert.strictEqual(result.statusCode, 304);
    });

    it(`should require exact If-Range dates (headers=${customHeaders})`, async () => {
      const app = appForFile();
      await request(app).get("/").set("Range", "bytes=0-1").set("If-Range", modified).expect(206, "to");
      for (const date of [later, "invalid", "Mon, 31 Dec 2018 00:00:00 GMT"]) {
        await request(app).get("/").set("Range", "bytes=0-1").set("If-Range", date).expect(200, "tobi");
      }
    });
  }
});


describe("file preconditions without Last-Modified", () => {
  for (const headersListener of [false, true]) {
    it(`should check the file date with headersListener=${headersListener}`, async () => {
      const app = express();
      const options = { lastModified: false };
      if (headersListener) options.headers = { "X-Test": "custom headers" };
      app.get("/", (req, res) => res.sendFile(path.join(fixtures, "name.txt"), options));
      await request(app).get("/")
        .set("If-Unmodified-Since", "Wed, 01 Jan 2031 00:00:00 GMT")
        .expect(200, "tobi")
        .expect(res => assert.strictEqual(res.headers["last-modified"], undefined));
      await request(app).get("/")
        .set("If-Unmodified-Since", "Thu, 01 Jan 1970 00:00:00 GMT").expect(412);
      await request(app).get("/").set("If-Unmodified-Since", "invalid").expect(200, "tobi");
    });
  }
});
