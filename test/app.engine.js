"use strict";
import {describe, it} from "node:test";
import assert from "node:assert";
import express from "#express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function render(path, options, fn) {
  fs.readFile(path, "utf8", (err, str) => {
    if (err) return fn(err);
    str = str.replace("{{user.name}}", options.user.name);
    fn(null, str);
  });
}

describe("app", () => {
  describe(".engine(ext, fn)", () => {
    it("should map a template engine", async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine(".html", render);
        app.locals.user = { name: "tobi" };

        app.render("user.html", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it("should throw when the callback is missing", () => {
      const app = express();
      assert.throws(() => {
        app.engine(".html", null);
      }, /callback function required/);
    });

    it('should work without leading "."', async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine("html", render);
        app.locals.user = { name: "tobi" };

        app.render("user.html", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it('should work "view engine" setting', async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine("html", render);
        app.set("view engine", "html");
        app.locals.user = { name: "tobi" };

        app.render("user", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });

    it('should work "view engine" with leading "."', async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.set("views", path.join(__dirname, "fixtures"));
        app.engine(".html", render);
        app.set("view engine", ".html");
        app.locals.user = { name: "tobi" };

        app.render("user", (err, str) => {
          if (err) return reject(err);
          assert.strictEqual(str, "<p>tobi</p>");
          resolve();
        });
      });
    });
  });
});
