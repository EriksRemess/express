"use strict";
var { describe, it } = require("node:test");
var assert = require("node:assert");
var express = require("../"),
  fs = require("node:fs");
var path = require("node:path");

function render(path, options, fn) {
  fs.readFile(path, "utf8", function (err, str) {
    if (err) return fn(err);
    str = str.replace("{{user.name}}", options.user.name);
    fn(null, str);
  });
}

describe("app", function () {
  describe(".engine(ext, fn)", function () {
    it("should map a template engine", async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine(".html", render);
        app.locals.user = { name: "tobi" };

        app.render("user.html", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should throw when the callback is missing", function () {
      var app = express();
      assert.throws(function () {
        app.engine(".html", null);
      }, /callback function required/);
    });

    it('should work without leading "."', async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine("html", render);
        app.locals.user = { name: "tobi" };

        app.render("user.html", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it('should work "view engine" setting', async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine("html", render);
        app.set("view engine", "html");
        app.locals.user = { name: "tobi" };

        app.render("user", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it('should work "view engine" with leading "."', async function () {
      await new Promise((resolve, reject) => {
        var app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine(".html", render);
        app.set("view engine", ".html");
        app.locals.user = { name: "tobi" };

        app.render("user", function (err, str) {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });
  });
});
