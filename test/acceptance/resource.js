var { describe, it } = require("node:test");
var app = require("../../examples/resource");
var request = require("supertest");

describe("resource", function () {
  describe("GET /", function () {
    it("should respond with instructions", async function () {
      await request(app)
        .get("/")
        .expect(/^<h1>Examples:<\/h1>/);
    });
  });

  describe("GET /users", function () {
    it("should respond with all users", async function () {
      await request(app)
        .get("/users")
        .expect(
          /^\[{"name":"tj"},{"name":"ciaran"},{"name":"aaron"},{"name":"guillermo"},{"name":"simon"},{"name":"tobi"}\]/,
        );
    });
  });

  describe("GET /users/1", function () {
    it("should respond with user 1", async function () {
      await request(app)
        .get("/users/1")
        .expect(/^{"name":"ciaran"}/);
    });
  });

  describe("GET /users/9", function () {
    it("should respond with error", async function () {
      await request(app).get("/users/9").expect('{"error":"Cannot find user"}');
    });
  });

  describe("GET /users/1..3", function () {
    it("should respond with users 1 through 3", async function () {
      await request(app)
        .get("/users/1..3")
        .expect(
          /^<ul><li>ciaran<\/li>\n<li>aaron<\/li>\n<li>guillermo<\/li><\/ul>/,
        );
    });
  });

  describe("DELETE /users/1", function () {
    it("should delete user 1", async function () {
      await request(app)
        .del("/users/1")
        .expect(/^destroyed/);
    });
  });

  describe("DELETE /users/9", function () {
    it("should fail", async function () {
      await request(app).del("/users/9").expect("Cannot find user");
    });
  });

  describe("GET /users/1..3.json", function () {
    it("should respond with users 2 and 3 as json", async function () {
      await request(app)
        .get("/users/1..3.json")
        .expect(/^\[null,{"name":"aaron"},{"name":"guillermo"}\]/);
    });
  });
});
