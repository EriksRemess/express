import {describe, it} from "node:test";
import app from "#examples/downloads/index";
import assert from "node:assert";
import request from "supertest";
import utils from "#test/support/utils";

describe("downloads", () => {
  describe("GET /", () => {
    it("should have a link to amazing.txt", async () => {
      await request(app)
        .get("/")
        .expect(/href="\/files\/amazing.txt"/);
    });
  });

  describe("GET /files/notes/groceries.txt", () => {
    it("should have a download header", async () => {
      await request(app)
        .get("/files/notes/groceries.txt")
        .expect("Content-Disposition", 'attachment; filename="groceries.txt"')
        .expect(200);
    });
  });

  describe("GET /files/amazing.txt", () => {
    it("should have a download header", async () => {
      await request(app)
        .get("/files/amazing.txt")
        .expect("Content-Disposition", 'attachment; filename="amazing.txt"')
        .expect(200);
    });
  });

  describe("GET /files/missing.txt", () => {
    it("should respond with 404", async () => {
      await request(app).get("/files/missing.txt").expect(404);
    });
  });

  describe("GET /files/../index.js", () => {
    it("should respond with 403", async () => {
      await new Promise((resolve, reject) => {
        utils.rawRequest(app, "/files/../index.js", (err, res) => {
          if (err) return reject(err);
          assert.strictEqual(res.statusCode, 403);
          resolve();
        });
      });
    });
  });
});
