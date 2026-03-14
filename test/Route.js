"use strict";
var { describe, it } = require("node:test");
var after = require("after");
var assert = require("node:assert");
var express = require("../"),
  Route = express.Route,
  methods = require("../lib/utils").methods;

describe("Route", function () {
  it("should work without handlers", async function () {
    var req = { method: "GET", url: "/" };
    var route = new Route("/foo");
    await new Promise(function (resolve, reject) {
      route.dispatch(req, {}, function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  it(
    "should not stack overflow with a large sync stack",
    { timeout: 5000 },
    async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "GET", url: "/" };
        var route = new Route("/foo");

        route.get(function (req, res, next) {
          req.counter = 0;
          next();
        });

        for (var i = 0; i < 6000; i++) {
          route.all(function (req, res, next) {
            req.counter++;
            next();
          });
        }

        route.get(function (req, res, next) {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.ok(req.called);
          assert.strictEqual(req.counter, 6000);
          resolve();
        });
      });
    },
  );

  describe(".all", function () {
    it("should add handler", async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "GET", url: "/" };
        var route = new Route("/foo");

        route.all(function (req, res, next) {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should handle VERBS", async function () {
      await new Promise((resolve, reject) => {
        var count = 0;
        var route = new Route("/foo");
        var cb = after(methods.length, function (err) {
          if (err) return reject(err);
          assert.strictEqual(count, methods.length);
          resolve();
        });

        route.all(function (req, res, next) {
          count++;
          next();
        });

        methods.forEach(function testMethod(method) {
          var req = { method: method, url: "/" };
          route.dispatch(req, {}, cb);
        });
      });
    });

    it("should stack", async function () {
      await new Promise((resolve, reject) => {
        var req = { count: 0, method: "GET", url: "/" };
        var route = new Route("/foo");

        route.all(function (req, res, next) {
          req.count++;
          next();
        });

        route.all(function (req, res, next) {
          req.count++;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.strictEqual(req.count, 2);
          resolve();
        });
      });
    });
  });

  describe(".VERB", function () {
    it("should support .get", async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "GET", url: "/" };
        var route = new Route("");

        route.get(function (req, res, next) {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should limit to just .VERB", async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "POST", url: "/" };
        var route = new Route("");

        route.get(function () {
          throw new Error("not me!");
        });

        route.post(function (req, res, next) {
          req.called = true;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.ok(req.called);
          resolve();
        });
      });
    });

    it("should allow fallthrough", async function () {
      await new Promise((resolve, reject) => {
        var req = { order: "", method: "GET", url: "/" };
        var route = new Route("");

        route.get(function (req, res, next) {
          req.order += "a";
          next();
        });

        route.all(function (req, res, next) {
          req.order += "b";
          next();
        });

        route.get(function (req, res, next) {
          req.order += "c";
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.strictEqual(req.order, "abc");
          resolve();
        });
      });
    });
  });

  describe("errors", function () {
    it("should handle errors via arity 4 functions", async function () {
      await new Promise((resolve, reject) => {
        var req = { order: "", method: "GET", url: "/" };
        var route = new Route("");

        route.all(function (req, res, next) {
          next(new Error("foobar"));
        });

        route.all(function (req, res, next) {
          req.order += "0";
          next();
        });

        route.all(function (err, req, res, next) {
          req.order += "a";
          next(err);
        });

        route.dispatch(req, {}, function (err) {
          assert.ok(err);
          assert.strictEqual(err.message, "foobar");
          assert.strictEqual(req.order, "a");
          resolve();
        });
      });
    });

    it("should handle throw", async function () {
      await new Promise((resolve, reject) => {
        var req = { order: "", method: "GET", url: "/" };
        var route = new Route("");

        route.all(function () {
          throw new Error("foobar");
        });

        route.all(function (req, res, next) {
          req.order += "0";
          next();
        });

        route.all(function (err, req, res, next) {
          req.order += "a";
          next(err);
        });

        route.dispatch(req, {}, function (err) {
          assert.ok(err);
          assert.strictEqual(err.message, "foobar");
          assert.strictEqual(req.order, "a");
          resolve();
        });
      });
    });

    it("should handle throwing inside error handlers", async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "GET", url: "/" };
        var route = new Route("");

        route.get(function () {
          throw new Error("boom!");
        });

        route.get(function (err, req, res, next) {
          throw new Error("oops");
        });

        route.get(function (err, req, res, next) {
          req.message = err.message;
          next();
        });

        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          assert.strictEqual(req.message, "oops");
          resolve();
        });
      });
    });

    it("should handle throw in .all", async function () {
      await new Promise((resolve, reject) => {
        var req = { method: "GET", url: "/" };
        var route = new Route("");

        route.all(function (req, res, next) {
          throw new Error("boom!");
        });

        route.dispatch(req, {}, function (err) {
          assert.ok(err);
          assert.strictEqual(err.message, "boom!");
          resolve();
        });
      });
    });

    it("should handle single error handler", async function () {
      var req = { method: "GET", url: "/" };
      var route = new Route("");

      route.all(function (err, req, res, next) {
        // this should not execute
        throw new Error("should not be called");
      });

      await new Promise(function (resolve, reject) {
        route.dispatch(req, {}, function (err) {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
});
