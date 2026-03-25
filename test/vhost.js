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
});
