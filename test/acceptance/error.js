import {describe, it} from "node:test";
import app from "#examples/error/index";
import request from "supertest";

describe("error", () => {
  describe("GET /", () => {
    it("should respond with 500", async () => {
      await request(app).get("/").expect(500);
    });
  });

  describe("GET /next", () => {
    it("should respond with 500", async () => {
      await request(app).get("/next").expect(500);
    });
  });

  describe("GET /missing", () => {
    it("should respond with 404", async () => {
      await request(app).get("/missing").expect(404);
    });
  });
});
