import {describe, it} from "node:test";
import app from "#examples/cookie-sessions/index";
import request from "supertest";

describe("cookie-sessions", () => {
  describe("GET /", () => {
    it("should display no views", async () => {
      await request(app).get("/").expect(200, "viewed 1 times\n");
    });

    it("should set a session cookie", async () => {
      await request(app)
        .get("/")
        .expect("Set-Cookie", /session=/)
        .expect(200);
    });

    it("should display 1 view on revisit", async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .get("/")
          .expect(200, "viewed 1 times\n", (err, res) => {
            if (err) return reject(err);
            request(app)
              .get("/")
              .set("Cookie", getCookies(res))
              .expect(200, "viewed 2 times\n", (err) => {
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

function getCookies(res) {
  return res.headers["set-cookie"]
    .map(val => {
      return val.split(";")[0];
    })
    .join("; ");
}
