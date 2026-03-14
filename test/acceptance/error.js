var { describe, it } = require("node:test");
var app = require("../../examples/error"),
  request = require("supertest");

describe("error", function () {
  describe("GET /", function () {
    it("should respond with 500", async function () {
      await request(app).get("/").expect(500);
    });
  });

  describe("GET /next", function () {
    it("should respond with 500", async function () {
      await request(app).get("/next").expect(500);
    });
  });

  describe("GET /missing", function () {
    it("should respond with 404", async function () {
      await request(app).get("/missing").expect(404);
    });
  });
});
