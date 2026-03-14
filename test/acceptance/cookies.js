var { describe, it } = require("node:test");
var app = require("../../examples/cookies"),
  request = require("supertest");
var utils = require("../support/utils");

describe("cookies", function () {
  describe("GET /", function () {
    it("should have a form", async function () {
      await request(app).get("/").expect(/<form/);
    });

    it("should respond with no cookies", async function () {
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Set-Cookie"))
        .expect(200);
    });

    it("should respond to cookie", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/")
          .type("urlencoded")
          .send({ remember: 1 })
          .expect(302, function (err, res) {
            if (err) return reject(err);
            request(app)
              .get("/")
              .set("Cookie", res.headers["set-cookie"][0])
              .expect(200, /Remembered/, (err) => {
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

  describe("GET /forget", function () {
    it("should clear cookie", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/")
          .type("urlencoded")
          .send({ remember: 1 })
          .expect(302, function (err, res) {
            if (err) return reject(err);
            request(app)
              .get("/forget")
              .set("Cookie", res.headers["set-cookie"][0])
              .expect("Set-Cookie", /remember=;/)
              .expect(302, (err) => {
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

  describe("POST /", function () {
    it("should set a cookie", async function () {
      await request(app)
        .post("/")
        .type("urlencoded")
        .send({ remember: 1 })
        .expect("Set-Cookie", /remember=1/)
        .expect(302);
    });

    it("should no set cookie w/o reminder", async function () {
      await request(app)
        .post("/")
        .send({})
        .expect(utils.shouldNotHaveHeader("Set-Cookie"))
        .expect(302);
    });
  });
});
