var { describe, it } = require("node:test");
var request = require("supertest"),
  app = require("../../examples/route-map");

describe("route-map", function () {
  describe("GET /users", function () {
    it("should respond with users", async function () {
      await request(app).get("/users").expect("user list");
    });
  });

  describe("DELETE /users", function () {
    it("should delete users", async function () {
      await request(app).del("/users").expect("delete users");
    });
  });

  describe("GET /users/:id", function () {
    it("should get a user", async function () {
      await request(app).get("/users/12").expect("user 12");
    });
  });

  describe("GET /users/:id/pets", function () {
    it("should get a users pets", async function () {
      await request(app).get("/users/12/pets").expect("user 12's pets");
    });
  });

  describe("GET /users/:id/pets/:pid", function () {
    it("should get a users pet", async function () {
      await request(app).del("/users/12/pets/2").expect("delete 12's pet 2");
    });
  });
});
