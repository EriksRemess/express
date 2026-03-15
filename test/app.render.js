"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import path from "node:path";
import tmpl from "#test/support/tmpl";


describe("app", () => {
  describe(".render(name, fn)", () => {
    it("should support absolute paths", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.locals.user = { name: "tobi" };

        app.render(
          path.join(import.meta.dirname, "fixtures", "user.tmpl"),
          (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          },
        );
      });
    });

    it('should support absolute paths with "view engine"', async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("view engine", "tmpl");
        app.locals.user = { name: "tobi" };

        app.render(
          path.join(import.meta.dirname, "fixtures", "user"),
          (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          },
        );
      });
    });

    it("should expose app.locals", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should support index.<engine>", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));
        app.set("view engine", "tmpl");

        app.render("blog/post", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<h1>blog post</h1>");
          resolve();
        });
      });
    });

    it("should handle render error throws", async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        function View(name, options) {
          this.name = name;
          this.path = "fale";
        }

        View.prototype.render = (options, fn) => {
          throw new Error("err!");
        };

        app.set("view", View);

        app.render("something", (err, str) => {
          assert.ok(err);
          assert.strictEqual(err.message, "err!");
          resolve();
        });
      });
    });

    describe("when the file does not exist", () => {
      it("should provide a helpful error", async () => {
        await new Promise((resolve, reject) => {
          const app = createApp();

          app.set("views", path.join(import.meta.dirname, "fixtures"));
          app.render("rawr.tmpl", err => {
            assert.ok(err);
            assert.equal(
              err.message,
              'Failed to lookup view "rawr.tmpl" in views directory "' +
                path.join(import.meta.dirname, "fixtures") +
                '"',
            );
            resolve();
          });
        });
      });
    });

    describe("when an error occurs", () => {
      it("should invoke the callback", async () => {
        await new Promise((resolve, reject) => {
          const app = createApp();

          app.set("views", path.join(import.meta.dirname, "fixtures"));

          app.render("user.tmpl", err => {
            assert.ok(err);
            assert.equal(err.name, "RenderError");
            resolve();
          });
        });
      });
    });

    describe("when an extension is given", () => {
      it("should render the template", async () => {
        await new Promise((resolve, reject) => {
          const app = createApp();

          app.set("views", path.join(import.meta.dirname, "fixtures"));

          app.render("email.tmpl", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>This is an email</p>");
            resolve();
          });
        });
      });
    });

    describe('when "view engine" is given', () => {
      it("should render the template", async () => {
        await new Promise((resolve, reject) => {
          const app = createApp();

          app.set("view engine", "tmpl");
          app.set("views", path.join(import.meta.dirname, "fixtures"));

          app.render("email", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>This is an email</p>");
            resolve();
          });
        });
      });
    });

    describe('when "views" is given', () => {
      it("should lookup the file in the path", async () => {
        await new Promise((resolve, reject) => {
          const app = createApp();

          app.set("views", path.join(import.meta.dirname, "fixtures", "default_layout"));
          app.locals.user = { name: "tobi" };

          app.render("user.tmpl", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "<p>tobi</p>");
            resolve();
          });
        });
      });

      describe("when array of paths", () => {
        it("should lookup the file in the path", async () => {
          await new Promise((resolve, reject) => {
            const app = createApp();
            const views = [
              path.join(import.meta.dirname, "fixtures", "local_layout"),
              path.join(import.meta.dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.user = { name: "tobi" };

            app.render("user.tmpl", (err, str) => {
              if (err) return reject(err);
              assert.strictEqual(str, "<span>tobi</span>");
              resolve();
            });
          });
        });

        it("should lookup in later paths until found", async () => {
          await new Promise((resolve, reject) => {
            const app = createApp();
            const views = [
              path.join(import.meta.dirname, "fixtures", "local_layout"),
              path.join(import.meta.dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.name = "tobi";

            app.render("name.tmpl", (err, str) => {
              if (err) return reject(err);
              assert.strictEqual(str, "<p>tobi</p>");
              resolve();
            });
          });
        });

        it("should error if file does not exist", async () => {
          await new Promise((resolve, reject) => {
            const app = createApp();
            const views = [
              path.join(import.meta.dirname, "fixtures", "local_layout"),
              path.join(import.meta.dirname, "fixtures", "default_layout"),
            ];

            app.set("views", views);
            app.locals.name = "tobi";

            app.render("pet.tmpl", (err, str) => {
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

    describe('when a "view" constructor is given', () => {
      it("should create an instance of it", async () => {
        await new Promise((resolve, reject) => {
          const app = express();

          function View(name, options) {
            this.name = name;
            this.path =
              "path is required by application.js as a signal of success even though it is not used there.";
          }

          View.prototype.render = (options, fn) => {
            fn(null, "abstract engine");
          };

          app.set("view", View);

          app.render("something", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(str, "abstract engine");
            resolve();
          });
        });
      });
    });

    describe("caching", () => {
      it("should always lookup view without cache", async () => {
        await new Promise((resolve, reject) => {
          const app = express();
          let count = 0;

          function View(name, options) {
            this.name = name;
            this.path = "fake";
            count++;
          }

          View.prototype.render = (options, fn) => {
            fn(null, "abstract engine");
          };

          app.set("view cache", false);
          app.set("view", View);

          app.render("something", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", (err, str) => {
              if (err) return reject(err);
              assert.strictEqual(count, 2);
              assert.strictEqual(str, "abstract engine");
              resolve();
            });
          });
        });
      });

      it('should cache with "view cache" setting', async () => {
        await new Promise((resolve, reject) => {
          const app = express();
          let count = 0;

          class View {
            constructor(name, options) {
              this.name = name;
              this.path = "fake";
              count++;
            }

            render(options, fn) {
              fn(null, "abstract engine");
            }
          }

          app.set("view cache", true);
          app.set("view", View);

          app.render("something", (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", (err, str) => {
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

  describe(".render(name, options, fn)", () => {
    it("should render the template", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));

        const user = { name: "tobi" };

        app.render("user.tmpl", { user: user }, (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should expose app.locals", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", {}, (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should give precedence to app.render() locals", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));
        app.locals.user = { name: "tobi" };
        const jane = { name: "jane" };

        app.render("user.tmpl", { user: jane }, (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>jane</p>");
          resolve();
        });
      });
    });

    it("should accept null or undefined options", async () => {
      await new Promise((resolve, reject) => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));
        app.locals.user = { name: "tobi" };

        app.render("user.tmpl", null, (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");

          app.render("user.tmpl", undefined, (err2, str2) => {
            if (err2) return reject(err2);
            assert.strictEqual(str2, "<p>tobi</p>");
            resolve();
          });
        });
      });
    });

    describe("caching", () => {
      it("should cache with cache option", async () => {
        await new Promise((resolve, reject) => {
          const app = express();
          let count = 0;

          class View {
            constructor(name, options) {
              this.name = name;
              this.path = "fake";
              count++;
            }

            render(options, fn) {
              fn(null, "abstract engine");
            }
          }

          app.set("view cache", false);
          app.set("view", View);

          app.render("something", { cache: true }, (err, str) => {
            if (err) return reject(err);
            assert.strictEqual(count, 1);
            assert.strictEqual(str, "abstract engine");
            app.render("something", { cache: true }, (err, str) => {
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
  const app = express();

  app.engine(".tmpl", tmpl);

  return app;
}
