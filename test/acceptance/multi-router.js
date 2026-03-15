import {describe, it} from "node:test";
import app from "#examples/multi-router/index";
import request from "supertest";

describe("multi-router", () => {
  describe("GET /", () => {
    it("should respond with root handler", async () => {
      await request(app).get("/").expect(200, "Hello from root route.");
    });
  });

  describe("GET /api/v1/", () => {
    it("should respond with APIv1 root handler", async () => {
      await request(app)
        .get("/api/v1/")
        .expect(200, "Hello from APIv1 root route.");
    });
  });

  describe("GET /api/v1/users", () => {
    it("should respond with users from APIv1", async () => {
      await request(app)
        .get("/api/v1/users")
        .expect(200, "List of APIv1 users.");
    });
  });

  describe("GET /api/v2/", () => {
    it("should respond with APIv2 root handler", async () => {
      await request(app)
        .get("/api/v2/")
        .expect(200, "Hello from APIv2 root route.");
    });
  });

  describe("GET /api/v2/users", () => {
    it("should respond with users from APIv2", async () => {
      await request(app)
        .get("/api/v2/users")
        .expect(200, "List of APIv2 users.");
    });
  });
});
