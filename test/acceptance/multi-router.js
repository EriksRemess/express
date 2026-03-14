var { describe, it } = require("node:test");
var app = require("../../examples/multi-router");
var request = require("supertest");

describe("multi-router", function () {
  describe("GET /", function () {
    it("should respond with root handler", async function () {
      await request(app).get("/").expect(200, "Hello from root route.");
    });
  });

  describe("GET /api/v1/", function () {
    it("should respond with APIv1 root handler", async function () {
      await request(app)
        .get("/api/v1/")
        .expect(200, "Hello from APIv1 root route.");
    });
  });

  describe("GET /api/v1/users", function () {
    it("should respond with users from APIv1", async function () {
      await request(app)
        .get("/api/v1/users")
        .expect(200, "List of APIv1 users.");
    });
  });

  describe("GET /api/v2/", function () {
    it("should respond with APIv2 root handler", async function () {
      await request(app)
        .get("/api/v2/")
        .expect(200, "Hello from APIv2 root route.");
    });
  });

  describe("GET /api/v2/users", function () {
    it("should respond with users from APIv2", async function () {
      await request(app)
        .get("/api/v2/users")
        .expect(200, "List of APIv2 users.");
    });
  });
});
