var { describe, it } = require("node:test");
var app = require("../../examples/params");
var request = require("supertest");

describe("params", function () {
  describe("GET /", function () {
    it("should respond with instructions", async function () {
      await request(app).get("/").expect(/Visit/);
    });
  });

  describe("GET /user/0", function () {
    it("should respond with a user", async function () {
      await request(app)
        .get("/user/0")
        .expect(/user tj/);
    });
  });

  describe("GET /user/9", function () {
    it("should fail to find user", async function () {
      await request(app)
        .get("/user/9")
        .expect(404, /failed to find user/);
    });
  });

  describe("GET /users/0-2", function () {
    it("should respond with three users", async function () {
      await request(app)
        .get("/users/0-2")
        .expect(/users tj, tobi, loki/);
    });
  });

  describe("GET /users/foo-bar", function () {
    it("should fail integer parsing", async function () {
      await request(app)
        .get("/users/foo-bar")
        .expect(400, /failed to parseInt foo/);
    });
  });
});
