"use strict";

import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import utils from "#test/support/utils";
describe("res", () => {
  describe(".redirect(url)", () => {
    it("should default to a 302 redirect", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("http://google.com");
      });
      await request(app)
        .get("/")
        .expect("location", "http://google.com")
        .expect(302);
    });
    it('should encode "url"', async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("https://google.com?q=\u2603 §10");
      });
      await request(app)
        .get("/")
        .expect("Location", "https://google.com?q=%E2%98%83%20%C2%A710")
        .expect(302);
    });
    it('should not touch already-encoded sequences in "url"', async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("https://google.com?q=%A710");
      });
      await request(app)
        .get("/")
        .expect("Location", "https://google.com?q=%A710")
        .expect(302);
    });
  });
  describe(".redirect(status, url)", () => {
    it("should set the response status", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect(303, "http://google.com");
      });
      await request(app)
        .get("/")
        .expect("Location", "http://google.com")
        .expect(303);
    });
  });
  describe("when the request method is HEAD", () => {
    it("should ignore the body", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("http://google.com");
      });
      await request(app)
        .head("/")
        .expect(302)
        .expect("Location", "http://google.com")
        .expect(utils.shouldNotHaveBody());
    });
  });
  describe("when accepting html", () => {
    it("should respond with html", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("http://google.com");
      });
      await request(app)
        .get("/")
        .set("Accept", "text/html")
        .expect("Content-Type", /html/)
        .expect("Location", "http://google.com")
        .expect(
          302,
          "<!DOCTYPE html><head><title>Found</title></head><body><p>Found. Redirecting to http://google.com</p></body>",
        );
    });
    it("should escape the url", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("<la'me>");
      });
      await request(app)
        .get("/")
        .set("Host", "http://example.com")
        .set("Accept", "text/html")
        .expect("Content-Type", /html/)
        .expect("Location", "%3Cla'me%3E")
        .expect(
          302,
          "<!DOCTYPE html><head><title>Found</title></head><body><p>Found. Redirecting to %3Cla&#39;me%3E</p></body>",
        );
    });
    it("should not render evil javascript links in anchor href (prevent XSS)", async () => {
      const app = express();
      const xss = "javascript:eval(document.body.innerHTML=`<p>XSS</p>`);";
      const encodedXss =
        "javascript:eval(document.body.innerHTML=%60%3Cp%3EXSS%3C/p%3E%60);";
      app.use((req, res) => {
        res.redirect(xss);
      });
      await request(app)
        .get("/")
        .set("Host", "http://example.com")
        .set("Accept", "text/html")
        .expect("Content-Type", /html/)
        .expect("Location", encodedXss)
        .expect(
          302,
          "<!DOCTYPE html><head><title>Found</title></head><body><p>Found. Redirecting to " +
            encodedXss +
            "</p></body>",
        );
    });
    it("should include the redirect type", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect(301, "http://google.com");
      });
      await request(app)
        .get("/")
        .set("Accept", "text/html")
        .expect("Content-Type", /html/)
        .expect("Location", "http://google.com")
        .expect(
          301,
          "<!DOCTYPE html><head><title>Moved Permanently</title></head><body><p>Moved Permanently. Redirecting to http://google.com</p></body>",
        );
    });
  });
  describe("when accepting text", () => {
    it("should respond with text", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("http://google.com");
      });
      await request(app)
        .get("/")
        .set("Accept", "text/plain, */*")
        .expect("Content-Type", /plain/)
        .expect("Location", "http://google.com")
        .expect(302, "Found. Redirecting to http://google.com");
    });
    it("should encode the url", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect(
          'http://example.com/?param=<script>alert("hax");</script>',
        );
      });
      await request(app)
        .get("/")
        .set("Host", "http://example.com")
        .set("Accept", "text/plain, */*")
        .expect("Content-Type", /plain/)
        .expect(
          "Location",
          "http://example.com/?param=%3Cscript%3Ealert(%22hax%22);%3C/script%3E",
        )
        .expect(
          302,
          "Found. Redirecting to http://example.com/?param=%3Cscript%3Ealert(%22hax%22);%3C/script%3E",
        );
    });
    it("should include the redirect type", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect(301, "http://google.com");
      });
      await request(app)
        .get("/")
        .set("Accept", "text/plain, */*")
        .expect("Content-Type", /plain/)
        .expect("Location", "http://google.com")
        .expect(301, "Moved Permanently. Redirecting to http://google.com");
    });
  });
  describe("when accepting neither text or html", () => {
    it("should respond with an empty body", async () => {
      const app = express();
      app.use((req, res) => {
        res.redirect("http://google.com");
      });
      await request(app)
        .get("/")
        .set("Accept", "application/octet-stream")
        .expect(302)
        .expect("location", "http://google.com")
        .expect("content-length", "0")
        .expect(utils.shouldNotHaveHeader("Content-Type"))
        .expect(utils.shouldNotHaveBody());
    });
  });
});
