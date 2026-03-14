var { describe, it } = require("node:test");
var request = require("supertest"),
  app = require("../../examples/content-negotiation");

describe("content-negotiation", function () {
  describe("GET /", function () {
    it("should default to text/html", async function () {
      await request(app)
        .get("/")
        .expect(200, "<ul><li>Tobi</li><li>Loki</li><li>Jane</li></ul>");
    });

    it("should accept to text/plain", async function () {
      await request(app)
        .get("/")
        .set("Accept", "text/plain")
        .expect(200, " - Tobi\n - Loki\n - Jane\n");
    });

    it("should accept to application/json", async function () {
      await request(app)
        .get("/")
        .set("Accept", "application/json")
        .expect(200, '[{"name":"Tobi"},{"name":"Loki"},{"name":"Jane"}]');
    });
  });

  describe("GET /users", function () {
    it("should default to text/html", async function () {
      await request(app)
        .get("/users")
        .expect(200, "<ul><li>Tobi</li><li>Loki</li><li>Jane</li></ul>");
    });

    it("should accept to text/plain", async function () {
      await request(app)
        .get("/users")
        .set("Accept", "text/plain")
        .expect(200, " - Tobi\n - Loki\n - Jane\n");
    });

    it("should accept to application/json", async function () {
      await request(app)
        .get("/users")
        .set("Accept", "application/json")
        .expect(200, '[{"name":"Tobi"},{"name":"Loki"},{"name":"Jane"}]');
    });
  });
});
