var { describe, it } = require("node:test");
var app = require("../../examples/hello-world");
var request = require("supertest");

describe("hello-world", function () {
  describe("GET /", function () {
    it("should respond with hello world", async function () {
      await request(app).get("/").expect(200, "Hello World");
    });
  });

  describe("GET /missing", function () {
    it("should respond with 404", async function () {
      await request(app).get("/missing").expect(404);
    });
  });
});
