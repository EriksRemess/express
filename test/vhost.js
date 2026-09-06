"use strict";

import { describe, it } from "node:test";
import express from "#express";
import request from "supertest";
import vhost from "#lib/utils/vhost";

describe("vhost()", () => {
  for (const hostname of [
    /example\.com|admin\.local/,
    /^example\.com|admin\.local/,
    /example\.com|admin\.local$/,
    /^example\.com|admin\.local$/,
  ]) {
    it(`should match the entire hostname for every alternative in ${hostname}`, async () => {
      const app = express();
      app.use(vhost(hostname, (req, res) => res.send("matched")));

      for (const host of ["example.com", "admin.local", "EXAMPLE.COM"]) {
        await request(app).get("/").set("Host", host).expect(200, "matched");
      }
      for (const host of ["example.com.evil.test", "evil-admin.local", "evil-example.com", "admin.local.evil.test"]) {
        await request(app).get("/").set("Host", host).expect(404);
      }
    });
  }

  it("should preserve capture indexes when anchoring regex alternatives", async () => {
    const app = express();
    app.use(vhost(/(www|admin)\.(example\.com|example\.org)/g, (req, res) => {
      res.json({ count: req.vhost.length, prefix: req.vhost[0], domain: req.vhost[1] });
    }));

    for (const host of ["www.example.com", "www.example.com", "admin.example.org"]) {
      await request(app).get("/").set("Host", host).expect(200, {
        count: 2,
        prefix: host.split(".")[0],
        domain: host.slice(host.indexOf(".") + 1),
      });
    }
  });

  it("should not match malformed host port suffixes", async () => {
    const app = express();

    app.use(vhost("example.com", (req, res) => {
      res.send("matched");
    }));
    app.use((req, res) => {
      res.sendStatus(404);
    });

    await request(app)
      .get("/")
      .set("Host", "example.com:443@evil.test")
      .expect(404);
  });

  it('should match against req.hostname when "trust proxy" is enabled', async () => {
    const app = express();

    app.enable("trust proxy");
    app.use(vhost("*.example.com", (req, res) => {
      res.json({
        host: req.vhost.host,
        hostname: req.vhost.hostname,
        subdomain: req.vhost[0],
      });
    }));
    app.use((req, res) => {
      res.sendStatus(404);
    });

    await request(app)
      .get("/")
      .set("Host", "localhost")
      .set("X-Forwarded-Host", "foo.example.com:8443")
      .expect(200, {
        host: "foo.example.com:8443",
        hostname: "foo.example.com",
        subdomain: "foo",
      });
  });

  it("should keep using the Host header when proxy is not trusted", async () => {
    const app = express();

    app.set("trust proxy", "10.0.0.1");
    app.use(vhost("*.example.com", (req, res) => {
      res.send(req.vhost.hostname);
    }));
    app.use((req, res) => {
      res.sendStatus(404);
    });

    await request(app)
      .get("/")
      .set("Host", "foo.example.com")
      .set("X-Forwarded-Host", "bar.example.com")
      .expect(200, "foo.example.com");
  });

  it("should ignore inherited Host header values", async () => {
    const app = express();

    app.use((req, res, next) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "host");
      let restored = false;

      function restore() {
        if (restored) {
          return;
        }

        restored = true;
        if (descriptor) {
          Object.defineProperty(Object.prototype, "host", descriptor);
        } else {
          delete Object.prototype.host;
        }
      }

      Object.defineProperty(Object.prototype, "host", {
        configurable: true,
        value: "foo.example.com",
        writable: true,
      });
      delete req.headers.host;
      Object.setPrototypeOf(req.headers, Object.prototype);
      res.once("close", restore);
      res.once("finish", restore);
      next();
    });
    app.use(vhost("*.example.com", (req, res) => {
      res.send("matched");
    }));
    app.use((req, res) => {
      res.sendStatus(404);
    });

    await request(app)
      .get("/")
      .expect(404);
  });
});
