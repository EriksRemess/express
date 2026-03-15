"use strict";
import {describe, it} from "node:test";
import after from "#test/support/after";
import assert from "node:assert";
import express from "#express";
const Route = express.Route;
import { httpMethods } from "#lib/utils/methods";

describe("Route", () => {
  it("should work without handlers", async () => {
    const req = { method: "GET", url: "/" };
    const route = new Route("/foo");
    await new Promise((resolve, reject) => {
      route.dispatch(req, {}, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  it(
    "should not stack overflow with a large sync stack",
    { timeout: 5000 },
    async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "GET", url: "/" };
        const route = new Route("/foo");

        route.get((req, res, next) => {
          req.counter = 0;
          next();
        });

        for (let i = 0; i < 6000; i++) {
          route.all((req, res, next) => {
            req.counter++;
            next();
          });
        }

        route.get((req, res, next) => {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.ok(req.called);
          assert.strictEqual(req.counter, 6000);
          resolve();
        });
      });
    },
  );

  describe(".all", () => {
    it("should add handler", async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "GET", url: "/" };
        const route = new Route("/foo");

        route.all((req, res, next) => {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should handle VERBS", async () => {
      await new Promise((resolve, reject) => {
        let count = 0;
        const route = new Route("/foo");
        const cb = after(httpMethods.length, err => {
          if (err) return reject(err);
          assert.strictEqual(count, httpMethods.length);
          resolve();
        });

        route.all((req, res, next) => {
          count++;
          next();
        });

        httpMethods.forEach(function testMethod(method) {
          const req = { method: method, url: "/" };
          route.dispatch(req, {}, cb);
        });
      });
    });

    it("should stack", async () => {
      await new Promise((resolve, reject) => {
        const req = { count: 0, method: "GET", url: "/" };
        const route = new Route("/foo");

        route.all((req, res, next) => {
          req.count++;
          next();
        });

        route.all((req, res, next) => {
          req.count++;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.strictEqual(req.count, 2);
          resolve();
        });
      });
    });
  });

  describe(".VERB", () => {
    it("should support .get", async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "GET", url: "/" };
        const route = new Route("");

        route.get((req, res, next) => {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should limit to just .VERB", async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "POST", url: "/" };
        const route = new Route("");

        route.get(() => {
          throw new Error("not me!");
        });

        route.post((req, res, next) => {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should allow fallthrough", async () => {
      await new Promise((resolve, reject) => {
        const req = { order: "", method: "GET", url: "/" };
        const route = new Route("");

        route.get((req, res, next) => {
          req.order += "a";
          next();
        });

        route.all((req, res, next) => {
          req.order += "b";
          next();
        });

        route.get((req, res, next) => {
          req.order += "c";
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.strictEqual(req.order, "abc");
          resolve();
        });
      });
    });
  });

  describe("errors", () => {
    it("should handle errors via arity 4 functions", async () => {
      await new Promise((resolve, reject) => {
        const req = { order: "", method: "GET", url: "/" };
        const route = new Route("");

        route.all((req, res, next) => {
          next(new Error("foobar"));
        });

        route.all((req, res, next) => {
          req.order += "0";
          next();
        });

        route.all((err, req, res, next) => {
          req.order += "a";
          next(err);
        });

        route.dispatch(req, {}, err => {
          assert.ok(err);
          assert.strictEqual(err.message, "foobar");
          assert.strictEqual(req.order, "a");
          resolve();
        });
      });
    });

    it("should handle throw", async () => {
      await new Promise((resolve, reject) => {
        const req = { order: "", method: "GET", url: "/" };
        const route = new Route("");

        route.all(() => {
          throw new Error("foobar");
        });

        route.all((req, res, next) => {
          req.order += "0";
          next();
        });

        route.all((err, req, res, next) => {
          req.order += "a";
          next(err);
        });

        route.dispatch(req, {}, err => {
          assert.ok(err);
          assert.strictEqual(err.message, "foobar");
          assert.strictEqual(req.order, "a");
          resolve();
        });
      });
    });

    it("should handle throwing inside error handlers", async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "GET", url: "/" };
        const route = new Route("");

        route.get(() => {
          throw new Error("boom!");
        });

        route.get((err, req, res, next) => {
          throw new Error("oops");
        });

        route.get((err, req, res, next) => {
          req.message = err.message;
          next();
        });

        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          assert.strictEqual(req.message, "oops");
          resolve();
        });
      });
    });

    it("should handle throw in .all", async () => {
      await new Promise((resolve, reject) => {
        const req = { method: "GET", url: "/" };
        const route = new Route("");

        route.all((req, res, next) => {
          throw new Error("boom!");
        });

        route.dispatch(req, {}, err => {
          assert.ok(err);
          assert.strictEqual(err.message, "boom!");
          resolve();
        });
      });
    });

    it("should handle single error handler", async () => {
      const req = { method: "GET", url: "/" };
      const route = new Route("");

      route.all((err, req, res, next) => {
        // this should not execute
        throw new Error("should not be called");
      });

      await new Promise((resolve, reject) => {
        route.dispatch(req, {}, err => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
});
