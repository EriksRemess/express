var { describe, it } = require("node:test");
var request = require("supertest"),
  app = require("../../examples/web-service");

describe("web-service", function () {
  describe("GET /api/users", function () {
    describe("without an api key", function () {
      it("should respond with 400 bad request", async function () {
        await request(app).get("/api/users").expect(400);
      });
    });

    describe("with an invalid api key", function () {
      it("should respond with 401 unauthorized", async function () {
        await request(app).get("/api/users?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", function () {
      it("should respond users json", async function () {
        await request(app)
          .get("/api/users?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '[{"name":"tobi"},{"name":"loki"},{"name":"jane"}]');
      });
    });
  });

  describe("GET /api/repos", function () {
    describe("without an api key", function () {
      it("should respond with 400 bad request", async function () {
        await request(app).get("/api/repos").expect(400);
      });
    });

    describe("with an invalid api key", function () {
      it("should respond with 401 unauthorized", async function () {
        await request(app).get("/api/repos?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", function () {
      it("should respond repos json", async function () {
        await request(app)
          .get("/api/repos?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(/"name":"express"/)
          .expect(/"url":"https:\/\/github.com\/expressjs\/express"/)
          .expect(200);
      });
    });
  });

  describe("GET /api/user/:name/repos", function () {
    describe("without an api key", function () {
      it("should respond with 400 bad request", async function () {
        await request(app).get("/api/user/loki/repos").expect(400);
      });
    });

    describe("with an invalid api key", function () {
      it("should respond with 401 unauthorized", async function () {
        await request(app).get("/api/user/loki/repos?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", function () {
      it("should respond user repos json", async function () {
        await request(app)
          .get("/api/user/loki/repos?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(/"name":"stylus"/)
          .expect(/"url":"https:\/\/github.com\/learnboost\/stylus"/)
          .expect(200);
      });

      it("should 404 with unknown user", async function () {
        await request(app).get("/api/user/bob/repos?api-key=foo").expect(404);
      });
    });
  });

  describe("when requesting an invalid route", function () {
    it("should respond with 404 json", async function () {
      await request(app)
        .get("/api/something?api-key=bar")
        .expect("Content-Type", /json/)
        .expect(404, '{"error":"Sorry, can\'t find that"}');
    });
  });
});
