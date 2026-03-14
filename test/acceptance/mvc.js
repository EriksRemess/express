var { describe, it } = require("node:test");
var request = require("supertest"),
  app = require("../../examples/mvc");

describe("mvc", function () {
  describe("GET /", function () {
    it("should redirect to /users", async function () {
      await request(app).get("/").expect("Location", "/users").expect(302);
    });
  });

  describe("GET /pet/0", function () {
    it("should get pet", async function () {
      await request(app).get("/pet/0").expect(200, /Tobi/);
    });
  });

  describe("GET /pet/0/edit", function () {
    it("should get pet edit page", async function () {
      await request(app).get("/pet/0/edit").expect(/<form/).expect(200, /Tobi/);
    });
  });

  describe("PUT /pet/2", function () {
    it("should update the pet", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .put("/pet/3")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ pet: { name: "Boots" } })
          .expect(302, function (err, res) {
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

  describe("GET /users", function () {
    it("should display a list of users", async function () {
      await request(app)
        .get("/users")
        .expect(/<h1>Users<\/h1>/)
        .expect(/>TJ</)
        .expect(/>Guillermo</)
        .expect(/>Nathan</)
        .expect(200);
    });
  });

  describe("GET /user/:id", function () {
    describe("when present", function () {
      it("should display the user", async function () {
        await request(app)
          .get("/user/0")
          .expect(200, /<h1>TJ <a href="\/user\/0\/edit">edit/);
      });

      it("should display the users pets", async function () {
        await request(app)
          .get("/user/0")
          .expect(/\/pet\/0">Tobi/)
          .expect(/\/pet\/1">Loki/)
          .expect(/\/pet\/2">Jane/)
          .expect(200);
      });
    });

    describe("when not present", function () {
      it("should 404", async function () {
        await request(app).get("/user/123").expect(404);
      });
    });
  });

  describe("GET /user/:id/edit", function () {
    it("should display the edit form", async function () {
      await request(app)
        .get("/user/1/edit")
        .expect(/Guillermo/)
        .expect(200, /<form/);
    });
  });

  describe("PUT /user/:id", function () {
    it("should 500 on error", async function () {
      await request(app).put("/user/1").send({}).expect(500);
    });

    it("should update the user", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .put("/user/1")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ user: { name: "Tobo" } })
          .expect(302, function (err, res) {
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

  describe("POST /user/:id/pet", function () {
    it("should create a pet for user", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/user/2/pet")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ pet: { name: "Snickers" } })
          .expect("Location", "/user/2")
          .expect(302, function (err, res) {
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
