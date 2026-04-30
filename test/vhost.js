"use strict";

import { describe, it } from "node:test";
import express from "#express";
import request from "supertest";
import vhost from "#lib/utils/vhost";

describe("vhost()", () => {
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
