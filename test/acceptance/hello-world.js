import {describe, it} from "node:test";
import app from "#examples/hello-world/index";
import request from "supertest";

describe("hello-world", () => {
  describe("GET /", () => {
    it("should respond with hello world", async () => {
      await request(app).get("/").expect(200, "Hello World");
    });
  });

  describe("GET /missing", () => {
    it("should respond with 404", async () => {
      await request(app).get("/missing").expect(404);
    });
  });
});
