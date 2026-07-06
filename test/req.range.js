"use strict";
import assert from "node:assert";
import {describe, it} from "node:test";
import express from "#express";
import parseRange from "#lib/utils/range-parser";
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

describe("range-parser", () => {
  const corpus = [
    {
      expected: ranges("bytes", [0, 0], [9, 9], [5, 9]),
      size: 10,
      source: "bytes=0-0,-1,5-",
    },
    {
      expected: ranges("bytes", [0, 2]),
      size: 10,
      source: "bytes=5-3, 0-2",
    },
    {
      expected: ranges("bytes", [0, 4], [10, 12]),
      options: { combine: true },
      size: 20,
      source: "bytes=0-2,2-4,10-12",
    },
    {
      expected: ranges("items", [0, 1], [3, 3]),
      size: 5,
      source: "items=0-1, 3-3",
    },
  ];

  for (const { expected, options, size, source } of corpus) {
    it(`parses ${source}`, () => {
      assert.deepStrictEqual(parseRange(size, source, options), expected);
    });
  }

  const unsatisfiableCorpus = [
    { size: 10, source: "bytes=999-" },
    { size: 10, source: "bytes=-0" },
    { size: 0, source: "bytes=0-" },
  ];

  for (const { size, source } of unsatisfiableCorpus) {
    it(`returns -1 for unsatisfiable ${source}`, () => {
      assert.strictEqual(parseRange(size, source), -1);
    });
  }

  const invalidCorpus = [
    "bytes",
    "bytes=-",
    "bytes=0-1-2",
    "bytes=1x-2",
  ];

  for (const source of invalidCorpus) {
    it(`returns -2 for malformed ${source}`, () => {
      assert.strictEqual(parseRange(10, source), -2);
    });
  }
});

function ranges(type, ...pairs) {
  const result = pairs.map(([start, end]) => ({ start, end }));

  result.type = type;
  return result;
}
