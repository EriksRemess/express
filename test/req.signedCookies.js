"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import cookieParser from "#lib/utils/cookies";

describe("req", () => {
  describe(".cookies", () => {
    it("should ignore unsafe JSON cookie names", async () => {
      const app = express();

      app.use(cookieParser());
      app.use((req, res) => {
        const merged = Object.assign({}, req.cookies);

        res.send({
          keys: Object.keys(req.cookies).sort(),
          polluted: merged.polluted,
          prototype: Object.getPrototypeOf(merged) === Object.prototype,
        });
      });

      await request(app)
        .get("/")
        .set("Cookie", "__proto__=j%3A%7B%22polluted%22%3Atrue%7D; constructor=bad; prototype=bad; safe=value")
        .expect(200, '{"keys":["safe"],"prototype":true}');
    });

    it("should ignore inherited Cookie header values", async () => {
      const app = express();

      app.use((req, res, next) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "cookie");
        let restored = false;

        function restore() {
          if (restored) {
            return;
          }

          restored = true;
          if (descriptor) {
            Object.defineProperty(Object.prototype, "cookie", descriptor);
          } else {
            delete Object.prototype.cookie;
          }
        }

        Object.defineProperty(Object.prototype, "cookie", {
          configurable: true,
          value: "polluted=yes",
          writable: true,
        });
        Object.setPrototypeOf(req.headers, Object.prototype);
        res.once("close", restore);
        res.once("finish", restore);
        next();
      });
      app.use(cookieParser());
      app.use((req, res) => {
        res.send(req.cookies);
      });

      await request(app)
        .get("/")
        .expect(200, "{}");
    });
  });

  describe(".signedCookies", () => {
    it("should return a signed JSON cookie", async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.use(cookieParser("secret"));

        app.use((req, res) => {
          if (req.path === "/set") {
            res.cookie("obj", { foo: "bar" }, { signed: true });
            res.end();
          } else {
            res.send(req.signedCookies);
          }
        });

        request(app)
          .get("/set")
          .end((err, res) => {
            if (err) return reject(err);
            const cookie = res.header["set-cookie"];

            request(app)
              .get("/")
              .set("Cookie", cookie)
              .expect(200, { obj: { foo: "bar" } }, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });

    it("should return falsy signed JSON cookies", async () => {
      await new Promise((resolve, reject) => {
        const app = express();

        app.use(cookieParser("secret"));

        app.use((req, res) => {
          if (req.path === "/set") {
            res.cookie("disabled", "j:false", { signed: true });
            res.cookie("count", "j:0", { signed: true });
            res.cookie("empty", "j:null", { signed: true });
            res.end();
          } else {
            res.send(req.signedCookies);
          }
        });

        request(app)
          .get("/set")
          .end((err, res) => {
            if (err) return reject(err);
            const cookie = res.header["set-cookie"];

            request(app)
              .get("/")
              .set("Cookie", cookie)
              .expect(200, { count: 0, disabled: false, empty: null }, err => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });
  });
});
