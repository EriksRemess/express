var { describe, it } = require("node:test");
var app = require("../../examples/markdown");
var request = require("supertest");

describe("markdown", function () {
  describe("GET /", function () {
    it("should respond with html", async function () {
      await request(app)
        .get("/")
        .expect(/<h1[^>]*>Markdown Example<\/h1>/);
    });
  });

  describe("GET /fail", function () {
    it("should respond with an error", async function () {
      await request(app).get("/fail").expect(500);
    });
  });
});
