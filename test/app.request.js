"use strict";
import {describe, it} from "node:test";
import {parse} from "node:url";
import after from "#test/support/after";
import express from "#express";
import request from "supertest";

describe("app", () => {
  describe(".request", () => {
    it("should extend the request prototype", async () => {
      const app = express();

      app.request.querystring = function () {
        return parse(this.url).query;
      };

      app.use((req, res) => {
        res.end(req.querystring());
      });

      await request(app).get("/foo?name=tobi").expect("name=tobi");
    });

    it("should only extend for the referenced app", async () => {
      await new Promise((resolve, reject) => {
        const app1 = express();
        const app2 = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app1.request.foobar = () => {
          return "tobi";
        };

        app1.get("/", (req, res) => {
          res.send(req.foobar());
        });

        app2.get("/", (req, res) => {
          res.send(req.foobar());
        });

        request(app1).get("/").expect(200, "tobi", cb);

        request(app2)
          .get("/")
          .expect(500, /(?:not a function|has no method)/, cb);
      });
    });

    it("should inherit to sub apps", async () => {
      await new Promise((resolve, reject) => {
        const app1 = express();
        const app2 = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app1.request.foobar = () => {
          return "tobi";
        };

        app1.use("/sub", app2);

        app1.get("/", (req, res) => {
          res.send(req.foobar());
        });

        app2.get("/", (req, res) => {
          res.send(req.foobar());
        });

        request(app1).get("/").expect(200, "tobi", cb);

        request(app1).get("/sub").expect(200, "tobi", cb);
      });
    });

    it("should allow sub app to override", async () => {
      await new Promise((resolve, reject) => {
        const app1 = express();
        const app2 = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app1.request.foobar = () => {
          return "tobi";
        };

        app2.request.foobar = () => {
          return "loki";
        };

        app1.use("/sub", app2);

        app1.get("/", (req, res) => {
          res.send(req.foobar());
        });

        app2.get("/", (req, res) => {
          res.send(req.foobar());
        });

        request(app1).get("/").expect(200, "tobi", cb);

        request(app1).get("/sub").expect(200, "loki", cb);
      });
    });

    it("should not pollute parent app", async () => {
      await new Promise((resolve, reject) => {
        const app1 = express();
        const app2 = express();
        const cb = after(2, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });

        app1.request.foobar = () => {
          return "tobi";
        };

        app2.request.foobar = () => {
          return "loki";
        };

        app1.use("/sub", app2);

        app1.get("/sub/foo", (req, res) => {
          res.send(req.foobar());
        });

        app2.get("/", (req, res) => {
          res.send(req.foobar());
        });

        request(app1).get("/sub").expect(200, "loki", cb);

        request(app1).get("/sub/foo").expect(200, "tobi", cb);
      });
    });
  });
});
