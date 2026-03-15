"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("res", () => {
  describe(".links(obj)", () => {
    it("should set Link header field", async () => {
      const app = express();

      app.use((req, res) => {
        res.links({
          next: "http://api.example.com/users?page=2",
          last: "http://api.example.com/users?page=5",
        });
        res.end();
      });

      await request(app)
        .get("/")
        .expect(
          "Link",
          '<http://api.example.com/users?page=2>; rel="next", <http://api.example.com/users?page=5>; rel="last"',
        )
        .expect(200);
    });

    it("should set Link header field for multiple calls", async () => {
      const app = express();

      app.use((req, res) => {
        res.links({
          next: "http://api.example.com/users?page=2",
          last: "http://api.example.com/users?page=5",
        });

        res.links({
          prev: "http://api.example.com/users?page=1",
        });

        res.end();
      });

      await request(app)
        .get("/")
        .expect(
          "Link",
          '<http://api.example.com/users?page=2>; rel="next", <http://api.example.com/users?page=5>; rel="last", <http://api.example.com/users?page=1>; rel="prev"',
        )
        .expect(200);
    });

    it("should set multiple links for single rel", async () => {
      const app = express();

      app.use((req, res) => {
        res.links({
          next: "http://api.example.com/users?page=2",
          last: [
            "http://api.example.com/users?page=5",
            "http://api.example.com/users?page=1",
          ],
        });

        res.end();
      });

      await request(app)
        .get("/")
        .expect(
          "Link",
          '<http://api.example.com/users?page=2>; rel="next", <http://api.example.com/users?page=5>; rel="last", <http://api.example.com/users?page=1>; rel="last"',
        )
        .expect(200);
    });
  });
});
