"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("throw after .end()", () => {
  it("should fail gracefully", async () => {
    const app = express();

    app.get("/", (req, res) => {
      res.end("yay");
      throw new Error("boom");
    });

    await request(app).get("/").expect("yay").expect(200);
  });
});
