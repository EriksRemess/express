var { describe, it } = require("node:test");
var app = require("../../examples/cookie-sessions");
var request = require("supertest");

describe("cookie-sessions", function () {
  describe("GET /", function () {
    it("should display no views", async function () {
      await request(app).get("/").expect(200, "viewed 1 times\n");
    });

    it("should set a session cookie", async function () {
      await request(app)
        .get("/")
        .expect("Set-Cookie", /session=/)
        .expect(200);
    });

    it("should display 1 view on revisit", async function () {
      await new Promise((resolve, reject) => {
        request(app)
          .get("/")
          .expect(200, "viewed 1 times\n", function (err, res) {
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
    .map(function (val) {
      return val.split(";")[0];
    })
    .join("; ");
}
