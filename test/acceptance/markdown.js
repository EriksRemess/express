import {describe, it} from "node:test";
import app from "#examples/markdown/index";
import request from "supertest";

describe("markdown", () => {
  describe("GET /", () => {
    it("should respond with html", async () => {
      await request(app)
        .get("/")
        .expect(/<h1[^>]*>Markdown Example<\/h1>/);
    });
  });

  describe("GET /fail", () => {
    it("should respond with an error", async () => {
      await request(app).get("/fail").expect(500);
    });
  });
});
