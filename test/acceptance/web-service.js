import {describe, it} from "node:test";
import request from "supertest";
import app from "#examples/web-service/index";

describe("web-service", () => {
  describe("GET /api/users", () => {
    describe("without an api key", () => {
      it("should respond with 400 bad request", async () => {
        await request(app).get("/api/users").expect(400);
      });
    });

    describe("with an invalid api key", () => {
      it("should respond with 401 unauthorized", async () => {
        await request(app).get("/api/users?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", () => {
      it("should respond users json", async () => {
        await request(app)
          .get("/api/users?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(200, '[{"name":"tobi"},{"name":"loki"},{"name":"jane"}]');
      });
    });
  });

  describe("GET /api/repos", () => {
    describe("without an api key", () => {
      it("should respond with 400 bad request", async () => {
        await request(app).get("/api/repos").expect(400);
      });
    });

    describe("with an invalid api key", () => {
      it("should respond with 401 unauthorized", async () => {
        await request(app).get("/api/repos?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", () => {
      it("should respond repos json", async () => {
        await request(app)
          .get("/api/repos?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(/"name":"express"/)
          .expect(/"url":"https:\/\/github.com\/expressjs\/express"/)
          .expect(200);
      });
    });
  });

  describe("GET /api/user/:name/repos", () => {
    describe("without an api key", () => {
      it("should respond with 400 bad request", async () => {
        await request(app).get("/api/user/loki/repos").expect(400);
      });
    });

    describe("with an invalid api key", () => {
      it("should respond with 401 unauthorized", async () => {
        await request(app).get("/api/user/loki/repos?api-key=rawr").expect(401);
      });
    });

    describe("with a valid api key", () => {
      it("should respond user repos json", async () => {
        await request(app)
          .get("/api/user/loki/repos?api-key=foo")
          .expect("Content-Type", "application/json; charset=utf-8")
          .expect(/"name":"stylus"/)
          .expect(/"url":"https:\/\/github.com\/learnboost\/stylus"/)
          .expect(200);
      });

      it("should 404 with unknown user", async () => {
        await request(app).get("/api/user/bob/repos?api-key=foo").expect(404);
      });
    });
  });

  describe("when requesting an invalid route", () => {
    it("should respond with 404 json", async () => {
      await request(app)
        .get("/api/something?api-key=bar")
        .expect("Content-Type", /json/)
        .expect(404, '{"error":"Sorry, can\'t find that"}');
    });
  });
});
