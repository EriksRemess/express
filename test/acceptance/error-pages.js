import {describe, it} from "node:test";
import app from "#examples/error-pages/index";
import request from "supertest";

describe("error-pages", () => {
  describe("GET /", () => {
    it("should respond with page list", async () => {
      await request(app)
        .get("/")
        .expect(/Pages Example/);
    });
  });

  describe("Accept: text/html", () => {
    describe("GET /403", () => {
      it("should respond with 403", async () => {
        await request(app).get("/403").expect(403);
      });
    });

    describe("GET /404", () => {
      it("should respond with 404", async () => {
        await request(app).get("/404").expect(404);
      });
    });

    describe("GET /500", () => {
      it("should respond with 500", async () => {
        await request(app).get("/500").expect(500);
      });
    });
  });

  describe("Accept: application/json", () => {
    describe("GET /403", () => {
      it("should respond with 403", async () => {
        await request(app)
          .get("/403")
          .set("Accept", "application/json")
          .expect(403);
      });
    });

    describe("GET /404", () => {
      it("should respond with 404", async () => {
        await request(app)
          .get("/404")
          .set("Accept", "application/json")
          .expect(404, { error: "Not found" });
      });
    });

    describe("GET /500", () => {
      it("should respond with 500", async () => {
        await request(app)
          .get("/500")
          .set("Accept", "application/json")
          .expect(500);
      });
    });
  });

  describe("Accept: text/plain", () => {
    describe("GET /403", () => {
      it("should respond with 403", async () => {
        await request(app).get("/403").set("Accept", "text/plain").expect(403);
      });
    });

    describe("GET /404", () => {
      it("should respond with 404", async () => {
        await request(app)
          .get("/404")
          .set("Accept", "text/plain")
          .expect(404)
          .expect("Not found");
      });
    });

    describe("GET /500", () => {
      it("should respond with 500", async () => {
        await request(app).get("/500").set("Accept", "text/plain").expect(500);
      });
    });
  });
});
