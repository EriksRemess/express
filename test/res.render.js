"use strict";
import {describe, it} from "node:test";
import express from "#express";
import path from "node:path";
import request from "supertest";
import tmpl from "#test/support/tmpl";


describe("res", () => {
  describe(".render(name)", () => {
    it("should support absolute paths", async () => {
      const app = createApp();

      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.render(path.join(import.meta.dirname, "fixtures", "user.tmpl"));
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it('should support absolute paths with "view engine"', async () => {
      const app = createApp();

      app.locals.user = { name: "tobi" };
      app.set("view engine", "tmpl");

      app.use((req, res) => {
        res.render(path.join(import.meta.dirname, "fixtures", "user"));
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it('should error without "view engine" set and file extension to a non-engine module', async () => {
      const app = createApp();

      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.render(path.join(import.meta.dirname, "fixtures", "broken.send"));
      });

      await request(app)
        .get("/")
        .expect(500, /does not provide a view engine/);
    });

    it('should error without "view engine" set and no file extension', async () => {
      const app = createApp();

      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.render(path.join(import.meta.dirname, "fixtures", "user"));
      });

      await request(app)
        .get("/")
        .expect(500, /No default engine was specified/);
    });

    it("should expose app.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose app.locals with `name` property", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.locals.name = "tobi";

      app.use((req, res) => {
        res.render("name.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should support index.<engine>", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.set("view engine", "tmpl");

      app.use((req, res) => {
        res.render("blog/post");
      });

      await request(app).get("/").expect("<h1>blog post</h1>");
    });

    describe("when an error occurs", () => {
      it("should next(err)", async () => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));

        app.use((req, res) => {
          res.render("user.tmpl");
        });

        app.use((err, req, res, next) => {
          res.status(500).send("got error: " + err.name);
        });

        await request(app).get("/").expect(500, "got error: RenderError");
      });
    });

    describe('when "view engine" is given', () => {
      it("should render the template", async () => {
        const app = createApp();

        app.set("view engine", "tmpl");
        app.set("views", path.join(import.meta.dirname, "fixtures"));

        app.use((req, res) => {
          res.render("email");
        });

        await request(app).get("/").expect("<p>This is an email</p>");
      });
    });

    describe('when "views" is given', () => {
      it("should lookup the file in the path", async () => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures", "default_layout"));

        app.use((req, res) => {
          res.render("user.tmpl", { user: { name: "tobi" } });
        });

        await request(app).get("/").expect("<p>tobi</p>");
      });

      describe("when array of paths", () => {
        it("should lookup the file in the path", async () => {
          const app = createApp();
          const views = [
            path.join(import.meta.dirname, "fixtures", "local_layout"),
            path.join(import.meta.dirname, "fixtures", "default_layout"),
          ];

          app.set("views", views);

          app.use((req, res) => {
            res.render("user.tmpl", { user: { name: "tobi" } });
          });

          await request(app).get("/").expect("<span>tobi</span>");
        });

        it("should lookup in later paths until found", async () => {
          const app = createApp();
          const views = [
            path.join(import.meta.dirname, "fixtures", "local_layout"),
            path.join(import.meta.dirname, "fixtures", "default_layout"),
          ];

          app.set("views", views);

          app.use((req, res) => {
            res.render("name.tmpl", { name: "tobi" });
          });

          await request(app).get("/").expect("<p>tobi</p>");
        });
      });
    });
  });

  describe(".render(name, option)", () => {
    it("should render the template", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));

      const user = { name: "tobi" };

      app.use((req, res) => {
        res.render("user.tmpl", { user: user });
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose app.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose res.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));

      app.use((req, res) => {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should give precedence to res.locals over app.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use((req, res) => {
        res.locals.user = { name: "jane" };
        res.render("user.tmpl", {});
      });

      await request(app).get("/").expect("<p>jane</p>");
    });

    it("should give precedence to res.render() locals over res.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      const jane = { name: "jane" };

      app.use((req, res) => {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl", { user: jane });
      });

      await request(app).get("/").expect("<p>jane</p>");
    });

    it("should give precedence to res.render() locals over app.locals", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));
      app.locals.user = { name: "tobi" };
      const jane = { name: "jane" };

      app.use((req, res) => {
        res.render("user.tmpl", { user: jane });
      });

      await request(app).get("/").expect("<p>jane</p>");
    });
  });

  describe(".render(name, options, fn)", () => {
    it("should pass the resulting string", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));

      app.use((req, res) => {
        const tobi = { name: "tobi" };
        res.render("user.tmpl", { user: tobi }, (err, html) => {
          html = html.replace("tobi", "loki");
          res.end(html);
        });
      });

      await request(app).get("/").expect("<p>loki</p>");
    });
  });

  describe(".render(name, fn)", () => {
    it("should pass the resulting string", async () => {
      const app = createApp();

      app.set("views", path.join(import.meta.dirname, "fixtures"));

      app.use((req, res) => {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl", (err, html) => {
          html = html.replace("tobi", "loki");
          res.end(html);
        });
      });

      await request(app).get("/").expect("<p>loki</p>");
    });

    describe("when an error occurs", () => {
      it("should pass it to the callback", async () => {
        const app = createApp();

        app.set("views", path.join(import.meta.dirname, "fixtures"));

        app.use((req, res) => {
          res.render("user.tmpl", err => {
            if (err) {
              res.status(500).send("got error: " + err.name);
            }
          });
        });

        await request(app).get("/").expect(500, "got error: RenderError");
      });
    });
  });
});

function createApp() {
  const app = express();

  app.engine(".tmpl", tmpl);

  return app;
}
