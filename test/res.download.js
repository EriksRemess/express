"use strict";

import {describe, it} from "node:test";
import after from "#test/support/after";
import assert from "node:assert";
import {AsyncLocalStorage} from "node:async_hooks";
import {Buffer} from "node:buffer";
import express from "#express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import utils from "#test/support/utils";

const FIXTURES_PATH = path.join(import.meta.dirname, "fixtures");
describe("res", () => {
  describe(".download(path)", () => {
    it("should transfer as an attachment", async () => {
      const app = express();
      app.use((req, res) => {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect("Content-Disposition", 'attachment; filename="user.html"')
        .expect(200, "<p>{{user.name}}</p>");
    });
    it("should accept range requests", async () => {
      const app = express();
      app.get("/", (req, res) => {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .expect("Accept-Ranges", "bytes")
        .expect(200, "<p>{{user.name}}</p>");
    });
    it("should respond with requested byte range", async () => {
      const app = express();
      app.get("/", (req, res) => {
        res.download("test/fixtures/user.html");
      });
      await request(app)
        .get("/")
        .set("Range", "bytes=0-2")
        .expect("Content-Range", "bytes 0-2/20")
        .expect(206, "<p>");
    });
  });
  describe(".download(path, filename)", () => {
    it("should provide an alternate filename", async () => {
      const app = express();
      app.use((req, res) => {
        res.download("test/fixtures/user.html", "document");
      });
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect("Content-Disposition", 'attachment; filename="document"')
        .expect(200);
    });
  });
  describe(".download(path, fn)", () => {
    it("should invoke the callback", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use((req, res) => {
          res.download("test/fixtures/user.html", cb);
        });
        request(app)
          .get("/")
          .expect("Content-Type", "text/html; charset=utf-8")
          .expect("Content-Disposition", 'attachment; filename="user.html"')
          .expect(200, cb);
      });
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
            res.download("test/fixtures/name.txt", err => {
              if (err) return cb(err);
              const local = req.asyncLocalStorage.getStore();
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
          res.download("test/fixtures/does-not-exist", err => {
            const local = req.asyncLocalStorage.getStore();
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
  describe(".download(path, options)", () => {
    it("should allow options to res.sendFile()", async () => {
      const app = express();
      app.use((req, res) => {
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
    describe('with "headers" option', () => {
      it("should set headers on response", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should use last header when duplicated", async () => {
        const app = express();
        app.use((req, res) => {
          res.download("test/fixtures/user.html", {
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
      it("should not set headers on 404", async () => {
        const app = express();
        app.use((req, res) => {
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
      describe("when headers contains Content-Disposition", () => {
        it("should be ignored", async () => {
          const app = express();
          app.use((req, res) => {
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
        it("should be ignored case-insensitively", async () => {
          const app = express();
          app.use((req, res) => {
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
    describe('with "root" option', () => {
      it("should allow relative path", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should allow up within root", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should reject up outside root", async () => {
        const app = express();
        app.use((req, res) => {
          const p =
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
      it("should reject reading outside root", async () => {
        const app = express();
        app.use((req, res) => {
          res.download("../name.txt", {
            root: FIXTURES_PATH,
          });
        });
        await request(app)
          .get("/")
          .expect(403)
          .expect(utils.shouldNotHaveHeader("Content-Disposition"));
      });
      it("should not follow symlinks outside root", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-download-"));
        const root = path.join(tempRoot, "root");

        try {
          fs.mkdirSync(root);
          fs.symlinkSync(FIXTURES_PATH, path.join(root, "escape"));

          const app = express();
          app.use((req, res) => {
            res.download("escape/name.txt", {
              root,
            });
          });

          await request(app)
            .get("/")
            .expect(403)
            .expect(utils.shouldNotHaveHeader("Content-Disposition"));
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });

      it("should keep serving the validated file when a symlink changes after headers", async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "express-download-"));
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

            res.download("link/file.txt", {
              root,
            });
          });

          await request(app)
            .get("/")
            .expect(200)
            .expect("Content-Disposition", 'attachment; filename="file.txt"')
            .expect(utils.shouldHaveBody(Buffer.from("SAFE")));
        } finally {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      });

    });
  });
  describe(".download(path, filename, fn)", () => {
    it("should invoke the callback", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        app.use((req, res) => {
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
  describe(".download(path, filename, options, fn)", () => {
    it("should invoke the callback", async () => {
      await new Promise((resolve, reject) => {
        const app = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
        const options = {};
        app.use((req, res) => {
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
    it("should allow options to res.sendFile()", async () => {
      const app = express();
      app.use((req, res) => {
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
    describe("when options.headers contains Content-Disposition", () => {
      it("should be ignored", async () => {
        const app = express();
        app.use((req, res) => {
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
      it("should be ignored case-insensitively", async () => {
        const app = express();
        app.use((req, res) => {
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
  describe("on failure", () => {
    it("should invoke the callback", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.download("test/fixtures/foobar.html", err => {
          if (!err) return next(new Error("expected error"));
          res.send("got " + err.status + " " + err.code);
        });
      });
      await request(app).get("/").expect(200, "got 404 ENOENT");
    });
    it("should remove Content-Disposition", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.download("test/fixtures/foobar.html", err => {
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
