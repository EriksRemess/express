"use strict";

import {describe, it, before} from "node:test";
let __testApp;
import assert from "node:assert";
import express from "#express";
import path from "node:path";
import {Buffer} from "node:buffer";
import request from "supertest";
import utils from "#test/support/utils";

const fixtures = path.join(import.meta.dirname, "/fixtures");
const relative = path.relative(process.cwd(), fixtures);
const skipRelative =
  ~relative.indexOf("..") || path.resolve(relative) === relative;
describe("express.static()", () => {
  describe("basic operations", () => {
    before(() => {
      __testApp = createApp();
    });
    it("should require root path", () => {
      assert.throws(express.static.bind(), /root path required/);
    });
    it("should require root path to be string", () => {
      assert.throws(express.static.bind(null, 42), /root path.*string/);
    });
    it("should serve static files", async () => {
      await request(__testApp).get("/todo.txt").expect(200, "- groceries");
    });
    it("should support nesting", async () => {
      await request(__testApp).get("/users/tobi.txt").expect(200, "ferret");
    });
    it("should set Content-Type", async () => {
      await request(__testApp)
        .get("/todo.txt")
        .expect("Content-Type", "text/plain; charset=utf-8")
        .expect(200);
    });
    it("should set Last-Modified", async () => {
      await request(__testApp)
        .get("/todo.txt")
        .expect("Last-Modified", /\d{2} \w{3} \d{4}/)
        .expect(200);
    });
    it("should default max-age=0", async () => {
      await request(__testApp)
        .get("/todo.txt")
        .expect("Cache-Control", "public, max-age=0")
        .expect(200);
    });
    it("should support urlencoded pathnames", async () => {
      await request(__testApp).get("/%25%20of%20dogs.txt").expect(200, "20%");
    });
    it("should not choke on auth-looking URL", async () => {
      await request(__testApp).get("//todo@txt").expect(404, "Not Found");
    });
    it("should support index.html", async () => {
      await request(__testApp)
        .get("/users/")
        .expect(200)
        .expect("Content-Type", /html/)
        .expect("<p>tobi, loki, jane</p>");
    });
    it("should support ../", async () => {
      await request(__testApp)
        .get("/users/../todo.txt")
        .expect(200, "- groceries");
    });
    it("should support HEAD", async () => {
      await request(__testApp)
        .head("/todo.txt")
        .expect(200)
        .expect(utils.shouldNotHaveBody());
    });
    it("should skip POST requests", async () => {
      await request(__testApp).post("/todo.txt").expect(404, "Not Found");
    });
    it("should support conditional requests", async () => {
      const app = __testApp;
      const res = await request(app).get("/todo.txt").expect(200);
      await request(app)
        .get("/todo.txt")
        .set("If-None-Match", res.headers.etag)
        .expect(304);
    });
    it("should support precondition checks", async () => {
      await request(__testApp)
        .get("/todo.txt")
        .set("If-Match", '"foo"')
        .expect(412);
    });
    it("should serve zero-length files", async () => {
      await request(__testApp).get("/empty.txt").expect(200, "");
    });
    it("should ignore hidden files", async () => {
      await request(__testApp).get("/.name").expect(404, "Not Found");
    });
  });
  describe("etag", () => {
    it('should respect the app "etag" setting when disabled', async () => {
      const app = express();

      app.disable("etag");
      app.use(express.static(fixtures));

      await request(app)
        .get("/todo.txt")
        .expect(utils.shouldNotHaveHeader("ETag"))
        .expect(200, "- groceries");
    });
  });
  (skipRelative ? describe.skip : describe)("current dir", () => {
    before(() => {
      __testApp = createApp(".");
    });
    it('should be served with "."', async () => {
      const dest = relative.split(path.sep).join("/");
      await request(__testApp)
        .get("/" + dest + "/todo.txt")
        .expect(200, "- groceries");
    });
  });
  describe("acceptRanges", () => {
    describe("when false", () => {
      it("should not include Accept-Ranges", async () => {
        await request(
          createApp(fixtures, {
            acceptRanges: false,
          }),
        )
          .get("/nums.txt")
          .expect(utils.shouldNotHaveHeader("Accept-Ranges"))
          .expect(200, "123456789");
      });
      it("should ignore Rage request header", async () => {
        await request(
          createApp(fixtures, {
            acceptRanges: false,
          }),
        )
          .get("/nums.txt")
          .set("Range", "bytes=0-3")
          .expect(utils.shouldNotHaveHeader("Accept-Ranges"))
          .expect(utils.shouldNotHaveHeader("Content-Range"))
          .expect(200, "123456789");
      });
    });
    describe("when true", () => {
      it("should include Accept-Ranges", async () => {
        await request(
          createApp(fixtures, {
            acceptRanges: true,
          }),
        )
          .get("/nums.txt")
          .expect("Accept-Ranges", "bytes")
          .expect(200, "123456789");
      });
      it("should obey Rage request header", async () => {
        await request(
          createApp(fixtures, {
            acceptRanges: true,
          }),
        )
          .get("/nums.txt")
          .set("Range", "bytes=0-3")
          .expect("Accept-Ranges", "bytes")
          .expect("Content-Range", "bytes 0-3/9")
          .expect(206, "1234");
      });
    });
  });
  describe("cacheControl", () => {
    describe("when false", () => {
      it("should not include Cache-Control", async () => {
        await request(
          createApp(fixtures, {
            cacheControl: false,
          }),
        )
          .get("/nums.txt")
          .expect(utils.shouldNotHaveHeader("Cache-Control"))
          .expect(200, "123456789");
      });
      it("should ignore maxAge", async () => {
        await request(
          createApp(fixtures, {
            cacheControl: false,
            maxAge: 12000,
          }),
        )
          .get("/nums.txt")
          .expect(utils.shouldNotHaveHeader("Cache-Control"))
          .expect(200, "123456789");
      });
    });
    describe("when true", () => {
      it("should include Cache-Control", async () => {
        await request(
          createApp(fixtures, {
            cacheControl: true,
          }),
        )
          .get("/nums.txt")
          .expect("Cache-Control", "public, max-age=0")
          .expect(200, "123456789");
      });
    });
  });
  describe("extensions", () => {
    it("should be not be enabled by default", async () => {
      await request(createApp(fixtures)).get("/todo").expect(404);
    });
    it("should be configurable", async () => {
      await request(
        createApp(fixtures, {
          extensions: "txt",
        }),
      )
        .get("/todo")
        .expect(200, "- groceries");
    });
    it("should support disabling extensions", async () => {
      await request(
        createApp(fixtures, {
          extensions: false,
        }),
      )
        .get("/todo")
        .expect(404);
    });
    it("should support fallbacks", async () => {
      await request(
        createApp(fixtures, {
          extensions: ["htm", "html", "txt"],
        }),
      )
        .get("/todo")
        .expect(200, "<li>groceries</li>");
    });
    it("should 404 if nothing found", async () => {
      await request(
        createApp(fixtures, {
          extensions: ["htm", "html", "txt"],
        }),
      )
        .get("/bob")
        .expect(404);
    });
  });
  describe("fallthrough", () => {
    it("should default to true", async () => {
      await request(createApp())
        .get("/does-not-exist")
        .expect(404, "Not Found");
    });
    describe("when true", () => {
      before(() => {
        __testApp = createApp(fixtures, {
          fallthrough: true,
        });
      });
      it("should fall-through when OPTIONS request", async () => {
        await request(__testApp).options("/todo.txt").expect(404, "Not Found");
      });
      it("should fall-through when URL malformed", async () => {
        await request(__testApp).get("/%").expect(404, "Not Found");
      });
      it("should fall-through when traversing past root", async () => {
        await new Promise((resolve, reject) => {
          utils.rawRequest(
            __testApp,
            "/users/../../todo.txt",
            (err, res) => {
              if (err) return reject(err);
              assert.strictEqual(res.statusCode, 404);
              assert.strictEqual(res.text, "Not Found");
              resolve();
            },
          );
        });
      });
      it("should fall-through when URL too long", async () => {
        const app = express();
        const root = fixtures + Array(10000).join("/foobar");
        app.use(
          express.static(root, {
            fallthrough: true,
          }),
        );
        app.use((req, res, next) => {
          res.sendStatus(404);
        });
        await request(app).get("/").expect(404, "Not Found");
      });
      describe("with redirect: true", () => {
        before(() => {
          __testApp = createApp(fixtures, {
            fallthrough: true,
            redirect: true,
          });
        });
        it("should fall-through when directory", async () => {
          await request(__testApp).get("/pets/").expect(404, "Not Found");
        });
        it("should redirect when directory without slash", async () => {
          await request(__testApp)
            .get("/pets")
            .expect(301, /Redirecting/);
        });
      });
      describe("with redirect: false", () => {
        before(() => {
          __testApp = createApp(fixtures, {
            fallthrough: true,
            redirect: false,
          });
        });
        it("should fall-through when directory", async () => {
          await request(__testApp).get("/pets/").expect(404, "Not Found");
        });
        it("should fall-through when directory without slash", async () => {
          await request(__testApp).get("/pets").expect(404, "Not Found");
        });
      });
    });
    describe("when false", () => {
      before(() => {
        __testApp = createApp(fixtures, {
          fallthrough: false,
        });
      });
      it("should 405 when OPTIONS request", async () => {
        await request(__testApp)
          .options("/todo.txt")
          .expect("Allow", "GET, HEAD")
          .expect(405);
      });
      it("should 400 when URL malformed", async () => {
        await request(__testApp)
          .get("/%")
          .expect(400, /BadRequestError/);
      });
      it("should 403 when traversing past root", async () => {
        await new Promise((resolve, reject) => {
          utils.rawRequest(
            __testApp,
            "/users/../../todo.txt",
            (err, res) => {
              if (err) return reject(err);
              assert.strictEqual(res.statusCode, 403);
              assert.match(res.text, /ForbiddenError/);
              resolve();
            },
          );
        });
      });
      it("should 404 when URL too long", async () => {
        const app = express();
        const root = fixtures + Array(10000).join("/foobar");
        app.use(
          express.static(root, {
            fallthrough: false,
          }),
        );
        app.use((req, res, next) => {
          res.sendStatus(404);
        });
        await request(app)
          .get("/")
          .expect(404, /ENAMETOOLONG/);
      });
      describe("with redirect: true", () => {
        before(() => {
          __testApp = createApp(fixtures, {
            fallthrough: false,
            redirect: true,
          });
        });
        it("should 404 when directory", async () => {
          await request(__testApp)
            .get("/pets/")
            .expect(404, /NotFoundError|ENOENT/);
        });
        it("should redirect when directory without slash", async () => {
          await request(__testApp)
            .get("/pets")
            .expect(301, /Redirecting/);
        });
      });
      describe("with redirect: false", () => {
        before(() => {
          __testApp = createApp(fixtures, {
            fallthrough: false,
            redirect: false,
          });
        });
        it("should 404 when directory", async () => {
          await request(__testApp)
            .get("/pets/")
            .expect(404, /NotFoundError|ENOENT/);
        });
        it("should 404 when directory without slash", async () => {
          await request(__testApp)
            .get("/pets")
            .expect(404, /NotFoundError|ENOENT/);
        });
      });
    });
  });
  describe("hidden files", () => {
    before(() => {
      __testApp = createApp(fixtures, {
        dotfiles: "allow",
      });
    });
    it('should be served when dotfiles: "allow" is given', async () => {
      await request(__testApp)
        .get("/.name")
        .expect(200)
        .expect(utils.shouldHaveBody(Buffer.from("tobi")));
    });
  });
  describe("immutable", () => {
    it("should default to false", async () => {
      await request(createApp(fixtures))
        .get("/nums.txt")
        .expect("Cache-Control", "public, max-age=0");
    });
    it("should set immutable directive in Cache-Control", async () => {
      await request(
        createApp(fixtures, {
          immutable: true,
          maxAge: "1h",
        }),
      )
        .get("/nums.txt")
        .expect("Cache-Control", "public, max-age=3600, immutable");
    });
  });
  describe("lastModified", () => {
    describe("when false", () => {
      it("should not include Last-Modified", async () => {
        await request(
          createApp(fixtures, {
            lastModified: false,
          }),
        )
          .get("/nums.txt")
          .expect(utils.shouldNotHaveHeader("Last-Modified"))
          .expect(200, "123456789");
      });
    });
    describe("when true", () => {
      it("should include Last-Modified", async () => {
        await request(
          createApp(fixtures, {
            lastModified: true,
          }),
        )
          .get("/nums.txt")
          .expect("Last-Modified", /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/)
          .expect(200, "123456789");
      });
    });
  });
  describe("maxAge", () => {
    it("should accept string", async () => {
      await request(
        createApp(fixtures, {
          maxAge: "30d",
        }),
      )
        .get("/todo.txt")
        .expect("cache-control", "public, max-age=" + 60 * 60 * 24 * 30)
        .expect(200);
    });
    it("should be reasonable when infinite", async () => {
      await request(
        createApp(fixtures, {
          maxAge: Infinity,
        }),
      )
        .get("/todo.txt")
        .expect("cache-control", "public, max-age=" + 60 * 60 * 24 * 365)
        .expect(200);
    });
  });
  describe("redirect", () => {
    before(() => {
      __testApp = express();
      __testApp.use((req, res, next) => {
        req.originalUrl = req.url = req.originalUrl.replace(
          /\/snow(\/|$)/,
          "/snow \u2603$1",
        );
        next();
      });
      __testApp.use(express.static(fixtures));
    });
    it("should redirect directories", async () => {
      await request(__testApp)
        .get("/users")
        .expect("Location", "/users/")
        .expect(301);
    });
    it("should include HTML link", async () => {
      await request(__testApp)
        .get("/users")
        .expect("Location", "/users/")
        .expect(301, /\/users\//);
    });
    it("should redirect directories with query string", async () => {
      await request(__testApp)
        .get("/users?name=john")
        .expect("Location", "/users/?name=john")
        .expect(301);
    });
    it("should not redirect to protocol-relative locations", async () => {
      await request(__testApp)
        .get("//users")
        .expect("Location", "/users/")
        .expect(301);
    });
    it("should ensure redirect URL is properly encoded", async () => {
      await request(__testApp)
        .get("/snow")
        .expect("Location", "/snow%20%E2%98%83/")
        .expect("Content-Type", /html/)
        .expect(301, />Redirecting to \/snow%20%E2%98%83\/</);
    });
    it("should respond with default Content-Security-Policy", async () => {
      await request(__testApp)
        .get("/users")
        .expect("Content-Security-Policy", "default-src 'none'")
        .expect(301);
    });
    it("should not redirect incorrectly", async () => {
      await request(__testApp).get("/").expect(404);
    });
    describe("when false", () => {
      before(() => {
        __testApp = createApp(fixtures, {
          redirect: false,
        });
      });
      it("should disable redirect", async () => {
        await request(__testApp).get("/users").expect(404);
      });
    });
  });
  describe("setHeaders", () => {
    before(() => {
      __testApp = express();
      __testApp.use(
        express.static(fixtures, {
          setHeaders: (res) => {
            res.setHeader("x-custom", "set");
          },
        }),
      );
    });
    it("should reject non-functions", () => {
      assert.throws(
        express.static.bind(null, fixtures, {
          setHeaders: 3,
        }),
        /setHeaders.*function/,
      );
    });
    it("should get called when sending file", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .expect("x-custom", "set")
        .expect(200);
    });
    it("should not get called on 404", async () => {
      await request(__testApp)
        .get("/bogus")
        .expect(utils.shouldNotHaveHeader("x-custom"))
        .expect(404);
    });
    it("should not get called on redirect", async () => {
      await request(__testApp)
        .get("/users")
        .expect(utils.shouldNotHaveHeader("x-custom"))
        .expect(301);
    });
  });
  describe("when traversing past root", () => {
    before(() => {
      __testApp = createApp(fixtures, {
        fallthrough: false,
      });
    });
    it("should catch urlencoded ../", async () => {
      await new Promise((resolve, reject) => {
        utils.rawRequest(
          __testApp,
          "/users/%2e%2e/%2e%2e/todo.txt",
          (err, res) => {
            if (err) return reject(err);
            assert.strictEqual(res.statusCode, 403);
            resolve();
          },
        );
      });
    });
    it("should not allow root path disclosure", async () => {
      await new Promise((resolve, reject) => {
        utils.rawRequest(
          __testApp,
          "/users/../../fixtures/todo.txt",
          (err, res) => {
            if (err) return reject(err);
            assert.strictEqual(res.statusCode, 403);
            resolve();
          },
        );
      });
    });
  });
  describe('when request has "Range" header', () => {
    before(() => {
      __testApp = createApp();
    });
    it("should support byte ranges", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=0-4")
        .expect("12345");
    });
    it("should be inclusive", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=0-0")
        .expect("1");
    });
    it("should set Content-Range", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=2-5")
        .expect("Content-Range", "bytes 2-5/9");
    });
    it("should support -n", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=-3")
        .expect("789");
    });
    it("should support n-", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=3-")
        .expect("456789");
    });
    it('should respond with 206 "Partial Content"', async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=0-4")
        .expect(206);
    });
    it("should set Content-Length to the # of octets transferred", async () => {
      await request(__testApp)
        .get("/nums.txt")
        .set("Range", "bytes=2-3")
        .expect("Content-Length", "2")
        .expect(206, "34");
    });
    describe("when last-byte-pos of the range is greater than current length", () => {
      it("is taken to be equal to one less than the current length", async () => {
        await request(__testApp)
          .get("/nums.txt")
          .set("Range", "bytes=2-50")
          .expect("Content-Range", "bytes 2-8/9");
      });
      it("should adapt the Content-Length accordingly", async () => {
        await request(__testApp)
          .get("/nums.txt")
          .set("Range", "bytes=2-50")
          .expect("Content-Length", "7")
          .expect(206);
      });
    });
    describe("when the first- byte-pos of the range is greater than the current length", () => {
      it("should respond with 416", async () => {
        await request(__testApp)
          .get("/nums.txt")
          .set("Range", "bytes=9-50")
          .expect(416);
      });
      it("should include a Content-Range header of complete length", async () => {
        await request(__testApp)
          .get("/nums.txt")
          .set("Range", "bytes=9-50")
          .expect("Content-Range", "bytes */9")
          .expect(416);
      });
    });
    describe("when syntactically invalid", () => {
      it("should respond with 200 and the entire contents", async () => {
        await request(__testApp)
          .get("/nums.txt")
          .set("Range", "asdf")
          .expect("123456789");
      });
    });
  });
  describe("when index at mount point", () => {
    before(() => {
      __testApp = express();
      __testApp.use("/users", express.static(fixtures + "/users"));
    });
    it("should redirect correctly", async () => {
      await request(__testApp)
        .get("/users")
        .expect("Location", "/users/")
        .expect(301);
    });
  });
  describe("when mounted", () => {
    before(() => {
      __testApp = express();
      __testApp.use("/static", express.static(fixtures));
    });
    it("should redirect relative to the originalUrl", async () => {
      await request(__testApp)
        .get("/static/users")
        .expect("Location", "/static/users/")
        .expect(301);
    });
    it("should not choke on auth-looking URL", async () => {
      await request(__testApp).get("//todo@txt").expect(404);
    });
  });

  //
  // NOTE: This is not a real part of the API, but
  //       over time this has become something users
  //       are doing, so this will prevent unseen
  //       regressions around this use-case.
  //
  describe('when mounted "root" as a file', () => {
    before(() => {
      __testApp = express();
      __testApp.use("/todo.txt", express.static(fixtures + "/todo.txt"));
    });
    it("should load the file when on trailing slash", async () => {
      await request(__testApp).get("/todo.txt").expect(200, "- groceries");
    });
    it("should 404 when trailing slash", async () => {
      await request(__testApp).get("/todo.txt/").expect(404);
    });
  });
  describe("when responding non-2xx or 304", () => {
    it("should not alter the status", async () => {
      const app = express();
      app.use((req, res, next) => {
        res.status(501);
        next();
      });
      app.use(express.static(fixtures));
      await request(app).get("/todo.txt").expect(501, "- groceries");
    });
  });
  describe("when index file serving disabled", () => {
    before(() => {
      __testApp = express();
      __testApp.use(
        "/static",
        express.static(fixtures, {
          index: false,
        }),
      );
      __testApp.use((req, res, next) => {
        res.sendStatus(404);
      });
    });
    it("should next() on directory", async () => {
      await request(__testApp).get("/static/users/").expect(404, "Not Found");
    });
    it("should redirect to trailing slash", async () => {
      await request(__testApp)
        .get("/static/users")
        .expect("Location", "/static/users/")
        .expect(301);
    });
    it("should next() on mount point", async () => {
      await request(__testApp).get("/static/").expect(404, "Not Found");
    });
    it("should redirect to trailing slash mount point", async () => {
      await request(__testApp)
        .get("/static")
        .expect("Location", "/static/")
        .expect(301);
    });
  });
});
function createApp(dir, options, fn) {
  const app = express();
  const root = dir || fixtures;
  app.use(express.static(root, options));
  app.use((req, res, next) => {
    res.sendStatus(404);
  });
  return app;
}
