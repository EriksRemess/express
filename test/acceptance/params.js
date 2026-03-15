import {describe, it} from "node:test";
import app from "#examples/params/index";
import request from "supertest";

describe("params", () => {
  describe("GET /", () => {
    it("should respond with instructions", async () => {
      await request(app).get("/").expect(/Visit/);
    });
  });

  describe("GET /user/0", () => {
    it("should respond with a user", async () => {
      await request(app)
        .get("/user/0")
        .expect(/user tj/);
    });
  });

  describe("GET /user/9", () => {
    it("should fail to find user", async () => {
      await request(app)
        .get("/user/9")
        .expect(404, /failed to find user/);
    });
  });

  describe("GET /users/0-2", () => {
    it("should respond with three users", async () => {
      await request(app)
        .get("/users/0-2")
        .expect(/users tj, tobi, loki/);
    });
  });

  describe("GET /users/foo-bar", () => {
    it("should fail integer parsing", async () => {
      await request(app)
        .get("/users/foo-bar")
        .expect(400, /failed to parseInt foo/);
    });
  });
});
