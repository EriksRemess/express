var { describe, it } = require("node:test");
var app = require("../../examples/vhost");
var request = require("supertest");

describe("vhost", function () {
  describe("example.com", function () {
    describe("GET /", function () {
      it("should say hello", async function () {
        await request(app)
          .get("/")
          .set("Host", "example.com")
          .expect(200, /hello/i);
      });
    });

    describe("GET /foo", function () {
      it("should say foo", async function () {
        await request(app)
          .get("/foo")
          .set("Host", "example.com")
          .expect(200, "requested foo");
      });
    });
  });

  describe("foo.example.com", function () {
    describe("GET /", function () {
      it("should redirect to /foo", async function () {
        await request(app)
          .get("/")
          .set("Host", "foo.example.com")
          .expect(302, /Redirecting to http:\/\/example.com:3000\/foo/);
      });
    });
  });

  describe("bar.example.com", function () {
    describe("GET /", function () {
      it("should redirect to /bar", async function () {
        await request(app)
          .get("/")
          .set("Host", "bar.example.com")
          .expect(302, /Redirecting to http:\/\/example.com:3000\/bar/);
      });
    });
  });
});
