"use strict";
var { describe, it } = require("node:test");
var express = require("..");
var path = require("node:path");
var request = require("supertest");
var tmpl = require("./support/tmpl");

describe("res", function () {
  describe(".render(name)", function () {
    it("should support absolute paths", async function () {
      var app = createApp();

      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.render(path.join(__dirname, "fixtures", "user.tmpl"));
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it('should support absolute paths with "view engine"', async function () {
      var app = createApp();

      app.locals.user = { name: "tobi" };
      app.set("view engine", "tmpl");

      app.use(function (req, res) {
        res.render(path.join(__dirname, "fixtures", "user"));
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it('should error without "view engine" set and file extension to a non-engine module', async function () {
      var app = createApp();

      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.render(path.join(__dirname, "fixtures", "broken.send"));
      });

      await request(app)
        .get("/")
        .expect(500, /does not provide a view engine/);
    });

    it('should error without "view engine" set and no file extension', async function () {
      var app = createApp();

      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.render(path.join(__dirname, "fixtures", "user"));
      });

      await request(app)
        .get("/")
        .expect(500, /No default engine was specified/);
    });

    it("should expose app.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose app.locals with `name` property", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.locals.name = "tobi";

      app.use(function (req, res) {
        res.render("name.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should support index.<engine>", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.set("view engine", "tmpl");

      app.use(function (req, res) {
        res.render("blog/post");
      });

      await request(app).get("/").expect("<h1>blog post</h1>");
    });

    describe("when an error occurs", function () {
      it("should next(err)", async function () {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));

        app.use(function (req, res) {
          res.render("user.tmpl");
        });

        app.use(function (err, req, res, next) {
          res.status(500).send("got error: " + err.name);
        });

        await request(app).get("/").expect(500, "got error: RenderError");
      });
    });

    describe('when "view engine" is given', function () {
      it("should render the template", async function () {
        var app = createApp();

        app.set("view engine", "tmpl");
        app.set("views", path.join(__dirname, "fixtures"));

        app.use(function (req, res) {
          res.render("email");
        });

        await request(app).get("/").expect("<p>This is an email</p>");
      });
    });

    describe('when "views" is given', function () {
      it("should lookup the file in the path", async function () {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures", "default_layout"));

        app.use(function (req, res) {
          res.render("user.tmpl", { user: { name: "tobi" } });
        });

        await request(app).get("/").expect("<p>tobi</p>");
      });

      describe("when array of paths", function () {
        it("should lookup the file in the path", async function () {
          var app = createApp();
          var views = [
            path.join(__dirname, "fixtures", "local_layout"),
            path.join(__dirname, "fixtures", "default_layout"),
          ];

          app.set("views", views);

          app.use(function (req, res) {
            res.render("user.tmpl", { user: { name: "tobi" } });
          });

          await request(app).get("/").expect("<span>tobi</span>");
        });

        it("should lookup in later paths until found", async function () {
          var app = createApp();
          var views = [
            path.join(__dirname, "fixtures", "local_layout"),
            path.join(__dirname, "fixtures", "default_layout"),
          ];

          app.set("views", views);

          app.use(function (req, res) {
            res.render("name.tmpl", { name: "tobi" });
          });

          await request(app).get("/").expect("<p>tobi</p>");
        });
      });
    });
  });

  describe(".render(name, option)", function () {
    it("should render the template", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));

      var user = { name: "tobi" };

      app.use(function (req, res) {
        res.render("user.tmpl", { user: user });
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose app.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should expose res.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));

      app.use(function (req, res) {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl");
      });

      await request(app).get("/").expect("<p>tobi</p>");
    });

    it("should give precedence to res.locals over app.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.locals.user = { name: "tobi" };

      app.use(function (req, res) {
        res.locals.user = { name: "jane" };
        res.render("user.tmpl", {});
      });

      await request(app).get("/").expect("<p>jane</p>");
    });

    it("should give precedence to res.render() locals over res.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      var jane = { name: "jane" };

      app.use(function (req, res) {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl", { user: jane });
      });

      await request(app).get("/").expect("<p>jane</p>");
    });

    it("should give precedence to res.render() locals over app.locals", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));
      app.locals.user = { name: "tobi" };
      var jane = { name: "jane" };

      app.use(function (req, res) {
        res.render("user.tmpl", { user: jane });
      });

      await request(app).get("/").expect("<p>jane</p>");
    });
  });

  describe(".render(name, options, fn)", function () {
    it("should pass the resulting string", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));

      app.use(function (req, res) {
        var tobi = { name: "tobi" };
        res.render("user.tmpl", { user: tobi }, function (err, html) {
          html = html.replace("tobi", "loki");
          res.end(html);
        });
      });

      await request(app).get("/").expect("<p>loki</p>");
    });
  });

  describe(".render(name, fn)", function () {
    it("should pass the resulting string", async function () {
      var app = createApp();

      app.set("views", path.join(__dirname, "fixtures"));

      app.use(function (req, res) {
        res.locals.user = { name: "tobi" };
        res.render("user.tmpl", function (err, html) {
          html = html.replace("tobi", "loki");
          res.end(html);
        });
      });

      await request(app).get("/").expect("<p>loki</p>");
    });

    describe("when an error occurs", function () {
      it("should pass it to the callback", async function () {
        var app = createApp();

        app.set("views", path.join(__dirname, "fixtures"));

        app.use(function (req, res) {
          res.render("user.tmpl", function (err) {
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
  var app = express();

  app.engine(".tmpl", tmpl);

  return app;
}
