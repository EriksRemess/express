import {describe, it} from "node:test";
import app from "#examples/vhost/index";
import request from "supertest";

describe("vhost", () => {
  describe("example.com", () => {
    describe("GET /", () => {
      it("should say hello", async () => {
        await request(app)
          .get("/")
          .set("Host", "example.com")
          .expect(200, /hello/i);
      });
    });

    describe("GET /foo", () => {
      it("should say foo", async () => {
        await request(app)
          .get("/foo")
          .set("Host", "example.com")
          .expect(200, "requested foo");
      });
    });
  });

  describe("foo.example.com", () => {
    describe("GET /", () => {
      it("should redirect to /foo", async () => {
        await request(app)
          .get("/")
          .set("Host", "foo.example.com")
          .expect(302, /Redirecting to http:\/\/example.com:3000\/foo/);
      });
    });
  });

  describe("bar.example.com", () => {
    describe("GET /", () => {
      it("should redirect to /bar", async () => {
        await request(app)
          .get("/")
          .set("Host", "bar.example.com")
          .expect(302, /Redirecting to http:\/\/example.com:3000\/bar/);
      });
    });
  });
});
