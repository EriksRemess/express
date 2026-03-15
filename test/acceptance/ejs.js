import {describe, it} from "node:test";
import request from "supertest";
import app from "#examples/ejs/index";

describe("ejs", () => {
  describe("GET /", () => {
    it("should respond with html", async () => {
      await request(app)
        .get("/")
        .expect("Content-Type", "text/html; charset=utf-8")
        .expect(/<li>tobi &lt;tobi@learnboost\.com&gt;<\/li>/)
        .expect(/<li>loki &lt;loki@learnboost\.com&gt;<\/li>/)
        .expect(/<li>jane &lt;jane@learnboost\.com&gt;<\/li>/)
        .expect(200);
    });
  });
});
