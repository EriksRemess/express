var { describe, it } = require("node:test");
var app = require("../../examples/downloads"),
  assert = require("node:assert"),
  request = require("supertest");
var utils = require("../support/utils");

describe("downloads", function () {
  describe("GET /", function () {
    it("should have a link to amazing.txt", async function () {
      await request(app)
        .get("/")
        .expect(/href="\/files\/amazing.txt"/);
    });
  });

  describe("GET /files/notes/groceries.txt", function () {
    it("should have a download header", async function () {
      await request(app)
        .get("/files/notes/groceries.txt")
        .expect("Content-Disposition", 'attachment; filename="groceries.txt"')
        .expect(200);
    });
  });

  describe("GET /files/amazing.txt", function () {
    it("should have a download header", async function () {
      await request(app)
        .get("/files/amazing.txt")
        .expect("Content-Disposition", 'attachment; filename="amazing.txt"')
        .expect(200);
    });
  });

  describe("GET /files/missing.txt", function () {
    it("should respond with 404", async function () {
      await request(app).get("/files/missing.txt").expect(404);
    });
  });

  describe("GET /files/../index.js", function () {
    it("should respond with 403", async function () {
      await new Promise((resolve, reject) => {
        utils.rawRequest(app, "/files/../index.js", function (err, res) {
          if (err) return reject(err);
          assert.strictEqual(res.statusCode, 403);
          resolve();
        });
      });
    });
  });
});
