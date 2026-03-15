import {describe, it} from "node:test";
import request from "supertest";
import app from "#examples/content-negotiation/index";

describe("content-negotiation", () => {
  describe("GET /", () => {
    it("should default to text/html", async () => {
      await request(app)
        .get("/")
        .expect(200, "<ul><li>Tobi</li><li>Loki</li><li>Jane</li></ul>");
    });

    it("should accept to text/plain", async () => {
      await request(app)
        .get("/")
        .set("Accept", "text/plain")
        .expect(200, " - Tobi\n - Loki\n - Jane\n");
    });

    it("should accept to application/json", async () => {
      await request(app)
        .get("/")
        .set("Accept", "application/json")
        .expect(200, '[{"name":"Tobi"},{"name":"Loki"},{"name":"Jane"}]');
    });
  });

  describe("GET /users", () => {
    it("should default to text/html", async () => {
      await request(app)
        .get("/users")
        .expect(200, "<ul><li>Tobi</li><li>Loki</li><li>Jane</li></ul>");
    });

    it("should accept to text/plain", async () => {
      await request(app)
        .get("/users")
        .set("Accept", "text/plain")
        .expect(200, " - Tobi\n - Loki\n - Jane\n");
    });

    it("should accept to application/json", async () => {
      await request(app)
        .get("/users")
        .set("Accept", "application/json")
        .expect(200, '[{"name":"Tobi"},{"name":"Loki"},{"name":"Jane"}]');
    });
  });
});
