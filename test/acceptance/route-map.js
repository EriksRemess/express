import {describe, it} from "node:test";
import request from "supertest";
import app from "#examples/route-map/index";

describe("route-map", () => {
  describe("GET /users", () => {
    it("should respond with users", async () => {
      await request(app).get("/users").expect("user list");
    });
  });

  describe("DELETE /users", () => {
    it("should delete users", async () => {
      await request(app).del("/users").expect("delete users");
    });
  });

  describe("GET /users/:id", () => {
    it("should get a user", async () => {
      await request(app).get("/users/12").expect("user 12");
    });
  });

  describe("GET /users/:id/pets", () => {
    it("should get a users pets", async () => {
      await request(app).get("/users/12/pets").expect("user 12's pets");
    });
  });

  describe("GET /users/:id/pets/:pid", () => {
    it("should get a users pet", async () => {
      await request(app).del("/users/12/pets/2").expect("delete 12's pet 2");
    });
  });
});
