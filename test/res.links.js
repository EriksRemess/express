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

    it("should not allow link values to inject link parameters", async () => {
      const app = express();

      app.use((req, res) => {
        res.links({
          'next"; title="pwn': 'http://api.example.com/users?page=2>; rel="preload',
        });
        res.end();
      });

      await request(app)
        .get("/")
        .expect(
          "Link",
          '<http://api.example.com/users?page=2%3E;%20rel=%22preload>; rel="next\\"; title=\\"pwn"',
        )
        .expect(200);
    });
  });
});
