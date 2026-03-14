"use strict";
var { describe, it } = require("node:test");
var assert = require("node:assert");
var express = require("..");
var path = require("node:path");
var tmpl = require("./support/tmpl");

describe("app", function () {
  describe(".render(name, fn)", function () {
    it("should support absolute paths", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.locals.user = { name: "tobi" };

        app.render(
          path.join(__dirname, "fixtures", "user.tmpl"),
          function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          },
        );
      });
    });

    it('should support absolute paths with "view engine"', async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("view engine", "tmpl");
        app.locals.user = { name: "tobi" };

        app.render(
          path.join(__dirname, "fixtures", "user"),
          function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          },
        );
      });
    });

    it("should expose app.locals", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should support index.<engine>", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));
        app.set("view engine", "tmpl");

        app.render("blog/post", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<h1>blog post</h1>");
          resolve();
        });
      });
    });

    it("should handle render error throws", async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        function View(name, options) {
          this.name = name;
          this.path = "fale";
        }

        View.prototype.render = function (options, fn) {
          throw new Error("err!");
        };

        app.set("view", View);

        app.render("something", function (err, str) {
          assert.ok(err);
          assert.strictEqual(err.message, "err!");
          resolve();
        });
      });
    });

    describe("when the file does not exist", function () {
      it("should provide a helpful error", async function () {
        await new Promise((resolve, reject) => {
          var app = createApp();

          app.set("views", path.join(__dirname, "fixtures"));
          app.render("rawr.tmpl", function (err) {
            assert.ok(err);
            assert.equal(
              err.message,
              'Failed to lookup view "rawr.tmpl" in views directory "' +
                path.join(__dirname, "fixtures") +
                '"',
            );
            resolve();
          });
        });
      });
    });

    describe("when an error occurs", function () {
      it("should invoke the callback", async function () {
        await new Promise((resolve, reject) => {
          var app = createApp();

          app.set("views", path.join(__dirname, "fixtures"));

          app.render("user.tmpl", function (err) {
            assert.ok(err);
            assert.equal(err.name, "RenderError");
            resolve();
          });
        });
      });
    });

    describe("when an extension is given", function () {
      it("should render the template", async function () {
        await new Promise((resolve, reject) => {
          var app = createApp();

          app.set("views", path.join(__dirname, "fixtures"));

          app.render("email.tmpl", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>This is an email</p>");
            resolve();
          });
        });
      });
    });

    describe('when "view engine" is given', function () {
      it("should render the template", async function () {
        await new Promise((resolve, reject) => {
          var app = createApp();

          app.set("view engine", "tmpl");
          app.set("views", path.join(__dirname, "fixtures"));

          app.render("email", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>This is an email</p>");
            resolve();
          });
        });
      });
    });

    describe('when "views" is given', function () {
      it("should lookup the file in the path", async function () {
        await new Promise((resolve, reject) => {
          var app = createApp();

          app.set("views", path.join(__dirname, "fixtures", "default_layout"));
          app.locals.user = { name: "tobi" };

          app.render("user.tmpl", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          });
        });
      });

      describe("when array of paths", function () {
        it("should lookup the file in the path", async function () {
          await new Promise((resolve, reject) => {
            var app = createApp();
            var views = [
              path.join(__dirname, "fixtures", "local_layout"),
              path.join(__dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.user = { name: "tobi" };

            app.render("user.tmpl", function (err, str) {
              if (err) return reject(err);
              assert.strictEqual(str, "<span>tobi</span>");
              resolve();
            });
          });
        });

        it("should lookup in later paths until found", async function () {
          await new Promise((resolve, reject) => {
            var app = createApp();
            var views = [
              path.join(__dirname, "fixtures", "local_layout"),
              path.join(__dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.name = "tobi";

            app.render("name.tmpl", function (err, str) {
              if (err) return reject(err);
              assert.strictEqual(str, "<p>tobi</p>");
              resolve();
            });
          });
        });

        it("should error if file does not exist", async function () {
          await new Promise((resolve, reject) => {
            var app = createApp();
            var views = [
              path.join(__dirname, "fixtures", "local_layout"),
              path.join(__dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.name = "tobi";

            app.render("pet.tmpl", function (err, str) {
              assert.ok(err);
              assert.equal(
                err.message,
                'Failed to lookup view "pet.tmpl" in views directories "' +
                  views[0] +
                  '" or "' +
                  views[1] +
                  '"',
              );
              resolve();
            });
          });
        });
      });
    });

    describe('when a "view" constructor is given', function () {
      it("should create an instance of it", async function () {
        await new Promise((resolve, reject) => {
          var app = express();

          function View(name, options) {
            this.name = name;
            this.path =
              "path is required by application.js as a signal of success even though it is not used there.";
          }

          View.prototype.render = function (options, fn) {
            fn(null, "abstract engine");
          };

          app.set("view", View);

          app.render("something", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(str, "abstract engine");
            resolve();
          });
        });
      });
    });

    describe("caching", function () {
      it("should always lookup view without cache", async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var count = 0;

          function View(name, options) {
            this.name = name;
            this.path = "fake";
            count++;
          }

          View.prototype.render = function (options, fn) {
            fn(null, "abstract engine");
          };

          app.set("view cache", false);
          app.set("view", View);

          app.render("something", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", function (err, str) {
              if (err) return reject(err);
              assert.strictEqual(count, 2);
              assert.strictEqual(str, "abstract engine");
              resolve();
            });
          });
        });
      });

      it('should cache with "view cache" setting', async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var count = 0;

          function View(name, options) {
            this.name = name;
            this.path = "fake";
            count++;
          }

          View.prototype.render = function (options, fn) {
            fn(null, "abstract engine");
          };

          app.set("view cache", true);
          app.set("view", View);

          app.render("something", function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", function (err, str) {
              if (err) return reject(err);
              assert.strictEqual(count, 1);
              assert.strictEqual(str, "abstract engine");
              resolve();
            });
          });
        });
      });
    });
  });

  describe(".render(name, options, fn)", function () {
    it("should render the template", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));

        var user = { name: "tobi" };

        app.render("user.tmpl", { user: user }, function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should expose app.locals", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", {}, function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should give precedence to app.render() locals", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));
        app.locals.user = { name: "tobi" };
        var jane = { name: "jane" };

        app.render("user.tmpl", { user: jane }, function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>jane</p>");
          resolve();
        });
      });
    });

    it("should accept null or undefined options", async function () {
      await new Promise((resolve, reject) => {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", null, function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");

          app.render("user.tmpl", undefined, function (err2, str2) {
            if (err2) return reject(err2);
            assert.strictEqual(str2, "<p>tobi</p>");
            resolve();
          });
        });
      });
    });

    describe("caching", function () {
      it("should cache with cache option", async function () {
        await new Promise((resolve, reject) => {
          var app = express();
          var count = 0;

          function View(name, options) {
            this.name = name;
            this.path = "fake";
            count++;
          }

          View.prototype.render = function (options, fn) {
            fn(null, "abstract engine");
          };

          app.set("view cache", false);
          app.set("view", View);

          app.render("something", { cache: true }, function (err, str) {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", { cache: true }, function (err, str) {
              if (err) return reject(err);
              assert.strictEqual(count, 1);
              assert.strictEqual(str, "abstract engine");
              resolve();
            });
          });
        });
      });
    });
  });
});

function createApp() {
  var app = express();

  app.engine(".tmpl", tmpl);

  return app;
}
