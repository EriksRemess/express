var { describe, it } = require("node:test");
var app = require("../../examples/error-pages"),
  request = require("supertest");

describe("error-pages", function () {
  describe("GET /", function () {
    it("should respond with page list", async function () {
      await request(app)
        .get("/")
        .expect(/Pages Example/);
    });
  });

  describe("Accept: text/html", function () {
    describe("GET /403", function () {
      it("should respond with 403", async function () {
        await request(app).get("/403").expect(403);
      });
    });

    describe("GET /404", function () {
      it("should respond with 404", async function () {
        await request(app).get("/404").expect(404);
      });
    });

    describe("GET /500", function () {
      it("should respond with 500", async function () {
        await request(app).get("/500").expect(500);
      });
    });
  });

  describe("Accept: application/json", function () {
    describe("GET /403", function () {
      it("should respond with 403", async function () {
        await request(app)
          .get("/403")
          .set("Accept", "application/json")
          .expect(403);
      });
    });

    describe("GET /404", function () {
      it("should respond with 404", async function () {
        await request(app)
          .get("/404")
          .set("Accept", "application/json")
          .expect(404, { error: "Not found" });
      });
    });

    describe("GET /500", function () {
      it("should respond with 500", async function () {
        await request(app)
          .get("/500")
          .set("Accept", "application/json")
          .expect(500);
      });
    });
  });

  describe("Accept: text/plain", function () {
    describe("GET /403", function () {
      it("should respond with 403", async function () {
        await request(app).get("/403").set("Accept", "text/plain").expect(403);
      });
    });

    describe("GET /404", function () {
      it("should respond with 404", async function () {
        await request(app)
          .get("/404")
          .set("Accept", "text/plain")
          .expect(404)
          .expect("Not found");
      });
    });

    describe("GET /500", function () {
      it("should respond with 500", async function () {
        await request(app).get("/500").set("Accept", "text/plain").expect(500);
      });
    });
  });
});
