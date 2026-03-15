import {describe, it} from "node:test";
import app from "#examples/cookies/index";
import request from "supertest";
import utils from "#test/support/utils";

describe("cookies", () => {
  describe("GET /", () => {
    it("should have a form", async () => {
      await request(app).get("/").expect(/<form/);
    });

    it("should respond with no cookies", async () => {
      await request(app)
        .get("/")
        .expect(utils.shouldNotHaveHeader("Set-Cookie"))
        .expect(200);
    });

    it("should respond to cookie", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/")
          .type("urlencoded")
          .send({ remember: 1 })
          .expect(302, (err, res) => {
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

  describe("GET /forget", () => {
    it("should clear cookie", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post("/")
          .type("urlencoded")
          .send({ remember: 1 })
          .expect(302, (err, res) => {
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

  describe("POST /", () => {
    it("should set a cookie", async () => {
      await request(app)
        .post("/")
        .type("urlencoded")
        .send({ remember: 1 })
        .expect("Set-Cookie", /remember=1/)
        .expect(302);
    });

    it("should no set cookie w/o reminder", async () => {
      await request(app)
        .post("/")
        .send({})
        .expect(utils.shouldNotHaveHeader("Set-Cookie"))
        .expect(302);
    });
  });
});
