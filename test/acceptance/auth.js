import {describe, it} from "node:test";
import app from "#examples/auth/index";
import request from "supertest";

function getCookie(res) {
  return res.headers["set-cookie"][0].split(";")[0];
}

describe("auth", () => {
  describe("GET /", () => {
    it("should redirect to /login", async () => {
      await request(app).get("/").expect("Location", "/login").expect(302);
    });
  });

  describe("GET /login", () => {
    it("should render login form", async () => {
      await request(app).get("/login").expect(200, /<form/);
    });

    it("should display login error for bad user", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=not-tj&password=foobar")
          .expect("Location", "/login")
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/login")
              .set("Cookie", getCookie(res))
              .expect(200, /Authentication failed/, (err) => {
                if (err != null) {
                  reject(err);
                  return;
                }
                resolve();
              });
          });
      });
    });

    it("should display login error for bad password", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=tj&password=nogood")
          .expect("Location", "/login")
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/login")
              .set("Cookie", getCookie(res))
              .expect(200, /Authentication failed/, (err) => {
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

  describe("GET /logout", () => {
    it("should redirect to /", async () => {
      await request(app).get("/logout").expect("Location", "/").expect(302);
    });
  });

  describe("GET /restricted", () => {
    it("should redirect to /login without cookie", async () => {
      await request(app)
        .get("/restricted")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should succeed with proper cookie", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=tj&password=foobar")
          .expect("Location", "/")
          .expect(302, (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/restricted")
              .set("Cookie", getCookie(res))
              .expect(200, (err) => {
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

  describe("POST /login", () => {
    it("should fail without proper username", async () => {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=not-tj&password=foobar")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should fail without proper password", async () => {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=tj&password=baz")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should succeed with proper credentials", async () => {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=tj&password=foobar")
        .expect("Location", "/")
        .expect(302);
    });
  });
});
