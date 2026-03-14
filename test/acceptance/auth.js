var { describe, it } = require("node:test");
var app = require("../../examples/auth");
var request = require("supertest");

function getCookie(res) {
  return res.headers["set-cookie"][0].split(";")[0];
}

describe("auth", function () {
  describe("GET /", function () {
    it("should redirect to /login", async function () {
      await request(app).get("/").expect("Location", "/login").expect(302);
    });
  });

  describe("GET /login", function () {
    it("should render login form", async function () {
      await request(app).get("/login").expect(200, /<form/);
    });

    it("should display login error for bad user", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=not-tj&password=foobar")
          .expect("Location", "/login")
          .expect(302, function (err, res) {
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

    it("should display login error for bad password", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=tj&password=nogood")
          .expect("Location", "/login")
          .expect(302, function (err, res) {
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

  describe("GET /logout", function () {
    it("should redirect to /", async function () {
      await request(app).get("/logout").expect("Location", "/").expect(302);
    });
  });

  describe("GET /restricted", function () {
    it("should redirect to /login without cookie", async function () {
      await request(app)
        .get("/restricted")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should succeed with proper cookie", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/login")
          .type("urlencoded")
          .send("username=tj&password=foobar")
          .expect("Location", "/")
          .expect(302, function (err, res) {
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

  describe("POST /login", function () {
    it("should fail without proper username", async function () {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=not-tj&password=foobar")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should fail without proper password", async function () {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=tj&password=baz")
        .expect("Location", "/login")
        .expect(302);
    });

    it("should succeed with proper credentials", async function () {
      await request(app)
        .post("/login")
        .type("urlencoded")
        .send("username=tj&password=foobar")
        .expect("Location", "/")
        .expect(302);
    });
  });
});
