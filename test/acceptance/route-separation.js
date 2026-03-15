import {describe, it} from "node:test";
import app from "#examples/route-separation/index";
import request from "supertest";

describe("route-separation", () => {
  describe("GET /", () => {
    it("should respond with index", async () => {
      await request(app)
        .get("/")
        .expect(200, /Route Separation Example/);
    });
  });

  describe("GET /users", () => {
    it("should list users", async () => {
      await request(app).get("/users").expect(/TJ/).expect(/Tobi/).expect(200);
    });
  });

  describe("GET /user/:id", () => {
    it("should get a user", async () => {
      await request(app)
        .get("/user/0")
        .expect(200, /Viewing user TJ/);
    });

    it("should 404 on missing user", async () => {
      await request(app).get("/user/10").expect(404);
    });
  });

  describe("GET /user/:id/view", () => {
    it("should get a user", async () => {
      await request(app)
        .get("/user/0/view")
        .expect(200, /Viewing user TJ/);
    });

    it("should 404 on missing user", async () => {
      await request(app).get("/user/10/view").expect(404);
    });
  });

  describe("GET /user/:id/edit", () => {
    it("should get a user to edit", async () => {
      await request(app)
        .get("/user/0/edit")
        .expect(200, /Editing user TJ/);
    });
  });

  describe("PUT /user/:id/edit", () => {
    it("should edit a user", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .put("/user/0/edit")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({ user: { name: "TJ", email: "tj-invalid@vision-media.ca" } })
          .expect(302, err => {
            if (err) return reject(err);
            request(app)
              .get("/user/0")
              .expect(200, /tj-invalid@vision-media\.ca/, (err) => {
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

  describe("POST /user/:id/edit?_method=PUT", () => {
    it("should edit a user", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/user/1/edit?_method=PUT")
          .set("Content-Type", "application/x-www-form-urlencoded")
          .send({
            user: { name: "Tobi", email: "tobi-invalid@vision-media.ca" },
          })
          .expect(302, err => {
            if (err) return reject(err);
            request(app)
              .get("/user/1")
              .expect(200, /tobi-invalid@vision-media\.ca/, (err) => {
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

  describe("GET /posts", () => {
    it("should get a list of posts", async () => {
      await request(app).get("/posts").expect(200, /Posts/);
    });
  });
});
