import {describe, it} from "node:test";
import request from "supertest";
import app from "#examples/mvc/index";

describe("mvc", () => {
  describe("GET /", () => {
    it("should redirect to /users", async () => {
      await request(app).get("/").expect("Location", "/users").expect(302);
    });
  });

  describe("GET /pet/0", () => {
    it("should get pet", async () => {
      await request(app).get("/pet/0").expect(200, /Tobi/);
    });
  });

  describe("GET /pet/0/edit", () => {
    it("should get pet edit page", async () => {
      await request(app).get("/pet/0/edit").expect(/<form/).expect(200, /Tobi/);
    });
  });

  describe("PUT /pet/2", () => {
    it("should update the pet", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .put("/pet/3")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ pet: { name: "Boots" } })
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/pet/3/edit")
              .expect(200, /Boots/, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });
  });

  describe("GET /users", () => {
    it("should display a list of users", async () => {
      await request(app)
        .get("/users")
        .expect(/<h1>Users<\/h1>/)
        .expect(/>TJ</)
        .expect(/>Guillermo</)
        .expect(/>Nathan</)
        .expect(200);
    });
  });

  describe("GET /user/:id", () => {
    describe("when present", () => {
      it("should display the user", async () => {
        await request(app)
          .get("/user/0")
          .expect(200, /<h1>TJ <a href="\/user\/0\/edit">edit/);
      });

      it("should display the users pets", async () => {
        await request(app)
          .get("/user/0")
          .expect(/\/pet\/0">Tobi/)
          .expect(/\/pet\/1">Loki/)
          .expect(/\/pet\/2">Jane/)
          .expect(200);
      });
    });

    describe("when not present", () => {
      it("should 404", async () => {
        await request(app).get("/user/123").expect(404);
      });
    });
  });

  describe("GET /user/:id/edit", () => {
    it("should display the edit form", async () => {
      await request(app)
        .get("/user/1/edit")
        .expect(/Guillermo/)
        .expect(200, /<form/);
    });
  });

  describe("PUT /user/:id", () => {
    it("should 500 on error", async () => {
      await request(app).put("/user/1").send({}).expect(500);
    });

    it("should update the user", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .put("/user/1")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ user: { name: "Tobo" } })
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/user/1/edit")
              .expect(200, /Tobo/, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });
  });

  describe("POST /user/:id/pet", () => {
    it("should create a pet for user", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/user/2/pet")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ pet: { name: "Snickers" } })
          .expect("Location", "/user/2")
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/user/2")
              .expect(200, /Snickers/, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });
  });
});
