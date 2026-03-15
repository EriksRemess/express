"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import assert from "node:assert";
import url from "node:url";

describe("res", () => {
  describe(".location(url)", () => {
    it("should set the header", async () => {
      const app = express();

      app.use((req, res) => {
        res.location("http://google.com/").end();
      });

      await request(app)
        .get("/")
        .expect("Location", "http://google.com/")
        .expect(200);
    });

    it("should preserve trailing slashes when not present", async () => {
      const app = express();

      app.use((req, res) => {
        res.location("http://google.com").end();
      });

      await request(app)
        .get("/")
        .expect("Location", "http://google.com")
        .expect(200);
    });

    it('should encode "url"', async () => {
      const app = express();

      app.use((req, res) => {
        res.location("https://google.com?q=\u2603 §10").end();
      });

      await request(app)
        .get("/")
        .expect("Location", "https://google.com?q=%E2%98%83%20%C2%A710")
        .expect(200);
    });

    it("should encode data uri", async () => {
      const app = express();
      app.use((req, res) => {
        res.location("data:text/javascript,export default () => { }").end();
      });

      await request(app)
        .get("/")
        .expect(
          "Location",
          "data:text/javascript,export%20default%20()%20=%3E%20%7B%20%7D",
        )
        .expect(200);
    });

    it("should consistently handle non-string input: boolean", async () => {
      const app = express();
      app.use((req, res) => {
        res.location(true).end();
      });

      await request(app).get("/").expect("Location", "true").expect(200);
    });

    it("should consistently handle non-string inputs: object", async () => {
      const app = express();
      app.use((req, res) => {
        res.location({}).end();
      });

      await request(app)
        .get("/")
        .expect("Location", "[object%20Object]")
        .expect(200);
    });

    it("should consistently handle non-string inputs: array", async () => {
      const app = express();
      app.use((req, res) => {
        res.location([]).end();
      });

      await request(app).get("/").expect("Location", "").expect(200);
    });

    it("should consistently handle empty string input", async () => {
      const app = express();
      app.use((req, res) => {
        res.location("").end();
      });

      await request(app).get("/").expect("Location", "").expect(200);
    });

    if (typeof URL !== "undefined") {
      it("should accept an instance of URL", async () => {
        const app = express();

        app.use((req, res) => {
          res.location(new URL("http://google.com/")).end();
        });

        await request(app)
          .get("/")
          .expect("Location", "http://google.com/")
          .expect(200);
      });
    }
  });

  describe("location header encoding", () => {
    function createRedirectServerForDomain(domain) {
      const app = express();
      app.use((req, res) => {
        const host = url.parse(req.query.q, false, true).host;
        // This is here to show a basic check one might do which
        // would pass but then the location header would still be bad
        if (host !== domain) {
          res.status(400).end("Bad host: " + host + " !== " + domain);
        }
        res.location(req.query.q).end();
      });
      return app;
    }

    async function testRequestedRedirect(app, inputUrl, expected, expectedHost) {
      // Encode uri because old supertest does not and is required
      // to test older node versions. New supertest doesn't re-encode
      // so this works in both.
      const res = await request(app)
        .get("/?q=" + encodeURIComponent(inputUrl))
        .expect("") // No body.
        .expect(200)
        .expect("Location", expected);

      // Parse the hosts from the input URL and the Location header
      const inputHost = url.parse(inputUrl, false, true).host;
      const locationHost = url.parse(res.headers["location"], false, true).host;

      assert.strictEqual(locationHost, expectedHost);

      // Assert that the hosts are the same
      if (inputHost !== locationHost) {
        throw new Error(
          "Hosts do not match: " + inputHost + " !== " + locationHost,
        );
      }

      return res;
    }

    it('should not touch already-encoded sequences in "url"', async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "https://google.com?q=%A710",
        "https://google.com?q=%A710",
        "google.com",
      );
    });

    it("should consistently handle relative urls", async () => {
      const app = createRedirectServerForDomain(null);
      await testRequestedRedirect(app, "/foo/bar", "/foo/bar", null);
    });

    it("should not encode urls in such a way that they can bypass redirect allow lists", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "http://google.com\\@apple.com",
        "http://google.com\\@apple.com",
        "google.com",
      );
    });

    it("should not be case sensitive", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "HTTP://google.com\\@apple.com",
        "HTTP://google.com\\@apple.com",
        "google.com",
      );
    });

    it("should work with https", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "https://google.com\\@apple.com",
        "https://google.com\\@apple.com",
        "google.com",
      );
    });

    it("should correctly encode schemaless paths", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "//google.com\\@apple.com/",
        "//google.com\\@apple.com/",
        "google.com",
      );
    });

    it("should keep backslashes in the path", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "https://google.com/foo\\bar\\baz",
        "https://google.com/foo\\bar\\baz",
        "google.com",
      );
    });

    it("should escape header splitting for old node versions", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "http://google.com\\@apple.com/%0d%0afoo:%20bar",
        "http://google.com\\@apple.com/%0d%0afoo:%20bar",
        "google.com",
      );
    });

    it("should encode unicode correctly", async () => {
      const app = createRedirectServerForDomain(null);
      await testRequestedRedirect(app, "/%e2%98%83", "/%e2%98%83", null);
    });

    it("should encode unicode correctly even with a bad host", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "http://google.com\\@apple.com/%e2%98%83",
        "http://google.com\\@apple.com/%e2%98%83",
        "google.com",
      );
    });

    it("should work correctly despite using deprecated url.parse", async () => {
      const app = createRedirectServerForDomain("google.com");
      await testRequestedRedirect(
        app,
        "https://google.com'.bb.com/1.html",
        "https://google.com'.bb.com/1.html",
        "google.com",
      );
    });

    it("should encode file uri path", async () => {
      const app = createRedirectServerForDomain("");
      await testRequestedRedirect(
        app,
        "file:///etc\\passwd",
        "file:///etc\\passwd",
        "",
      );
    });
  });
});
