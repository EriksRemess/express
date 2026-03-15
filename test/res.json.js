"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import assert from "node:assert";

describe("res", () => {
  describe(".json(object)", () => {
    it("should not support jsonp callbacks", async () => {
      const app = express();

      app.use((req, res) => {
        res.json({ foo: "bar" });
      });

      await request(app).get("/?callback=foo").expect('{"foo":"bar"}');
    });

    it("should not override previous Content-Types", async () => {
      const app = express();

      app.get("/", (req, res) => {
        res.type("application/vnd.example+json");
        res.json({ hello: "world" });
      });

      await request(app)
        .get("/")
        .expect("Content-Type", "application/vnd.example+json; charset=utf-8")
        .expect(200, '{"hello":"world"}');
    });

    describe("when given primitives", () => {
      it("should respond with json for null", async () => {
        const app = express();

        app.use((req, res) => {
          res.json(null);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "null");
      });

      it("should respond with json for Number", async () => {
        const app = express();

        app.use((req, res) => {
          res.json(300);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "300");
      });

      it("should respond with json for String", async () => {
        const app = express();

        app.use((req, res) => {
          res.json("str");
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '"str"');
      });
    });

    describe("when given an array", () => {
      it("should respond with json", async () => {
        const app = express();

        app.use((req, res) => {
          res.json(["foo", "bar", "baz"]);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '["foo","bar","baz"]');
      });
    });

    describe("when given an object", () => {
      it("should respond with json", async () => {
        const app = express();

        app.use((req, res) => {
          res.json({ name: "tobi" });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"name":"tobi"}');
      });
    });

    describe('"json escape" setting', () => {
      it("should be undefined by default", () => {
        const app = express();
        assert.strictEqual(app.get("json escape"), undefined);
      });

      it("should unicode escape HTML-sniffing characters", async () => {
        const app = express();

        app.enable("json escape");

        app.use((req, res) => {
          res.json({ "&": "<script>" });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"\\u0026":"\\u003cscript\\u003e"}');
      });

      it("should not break undefined escape", async () => {
        const app = express();

        app.enable("json escape");

        app.use((req, res) => {
          res.json(undefined);
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, "");
      });
    });

    describe('"json replacer" setting', () => {
      it("should be passed to JSON.stringify()", async () => {
        const app = express();

        app.set("json replacer", (key, val) => {
          return key[0] === "_" ? undefined : val;
        });

        app.use((req, res) => {
          res.json({ name: "tobi", _id: 12345 });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{"name":"tobi"}');
      });
    });

    describe('"json spaces" setting', () => {
      it("should be undefined by default", () => {
        const app = express();
        assert(undefined === app.get("json spaces"));
      });

      it("should be passed to JSON.stringify()", async () => {
        const app = express();

        app.set("json spaces", 2);

        app.use((req, res) => {
          res.json({ name: "tobi", age: 2 });
        });

        await request(app)
          .get("/")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '{\n  "name": "tobi",\n  "age": 2\n}');
      });
    });
  });
});
