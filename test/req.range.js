"use strict";
import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";

describe("req", () => {
  describe(".range(size)", () => {
    it("should return parsed ranges", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.range(120));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-50,51-100")
        .expect(200, '[{"start":0,"end":50},{"start":51,"end":100}]');
    });

    it("should cap to the given size", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.range(75));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-100")
        .expect(200, '[{"start":0,"end":74}]');
    });

    it("should cap to the given size when open-ended", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.range(75));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-")
        .expect(200, '[{"start":0,"end":74}]');
    });

    it("should have a .type", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.range(120).type);
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-100")
        .expect(200, '"bytes"');
    });

    it("should accept any type", async () => {
      const app = express();

      app.use((req, res) => {
        res.json(req.range(120).type);
      });

      await request(app)
        .get("/")
        .set("Range", "users=0-2")
        .expect(200, '"users"');
    });

    it("should return undefined if no range", async () => {
      const app = express();

      app.use((req, res) => {
        res.send(String(req.range(120)));
      });

      await request(app).get("/").expect(200, "undefined");
    });
  });

  describe(".range(size, options)", () => {
    describe('with "combine: true" option', () => {
      it("should return combined ranges", async () => {
        const app = express();

        app.use((req, res) => {
          res.json(
            req.range(120, {
              combine: true,
            }),
          );
        });

        await request(app)
          .get("/")
          .set("Range", "bytes=0-50,51-100")
          .expect(200, '[{"start":0,"end":100}]');
      });
    });

    it("should ignore inherited combine option", async () => {
      const app = express();

      app.use((req, res) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "combine");
        let restored = false;

        function restore() {
          if (restored) {
            return;
          }

          restored = true;
          if (descriptor) {
            Object.defineProperty(Object.prototype, "combine", descriptor);
          } else {
            delete Object.prototype.combine;
          }
        }

        Object.defineProperty(Object.prototype, "combine", {
          configurable: true,
          value: true,
          writable: true,
        });
        res.once("close", restore);
        res.once("finish", restore);
        res.json(req.range(120, {}));
      });

      await request(app)
        .get("/")
        .set("Range", "bytes=0-50,51-100")
        .expect(200, '[{"start":0,"end":50},{"start":51,"end":100}]');
    });
  });
});
