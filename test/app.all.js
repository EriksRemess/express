"use strict";
import {describe, it} from "node:test";
import after from "#test/support/after";
import express from "#express";
import request from "supertest";

describe("app.all()", () => {
  it("should add a router per method", async () => {
    await new Promise((resolve, reject) => {
      const app = express();
      const cb = after(2, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });

      app.all("/tobi", (req, res) => {
        res.end(req.method);
      });

      request(app).put("/tobi").expect(200, "PUT", cb);

      request(app).get("/tobi").expect(200, "GET", cb);
    });
  });

  it("should run the callback for a method just once", async () => {
    await new Promise((resolve, reject) => {
      const app = express();
      let n = 0;

      app.all("/*splat", (req, res, next) => {
        if (n++) return reject(new Error("DELETE called several times"));
        next();
      });

      request(app)
        .del("/tobi")
        .expect(404, (err) => {
          if (err != null) {
            reject(err);
            return;
          }
          resolve();
        });
    });
  });
});
