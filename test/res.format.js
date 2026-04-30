"use strict";

import {describe, it} from "node:test";
import after from "#test/support/after";
import express from "#express";
import request from "supertest";
import assert from "node:assert";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";
const app1 = express();
app1.use((req, res, next) => {
  res.format({
    "text/plain": () => {
      res.send("hey");
    },
    "text/html": () => {
      res.send("<p>hey</p>");
    },
    "application/json": (a, b, c) => {
      assert(req === a);
      assert(res === b);
      assert(next === c);
      res.send({
        message: "hey",
      });
    },
  });
});
app1.use((err, req, res, next) => {
  if (!err.types) throw err;
  res.status(err.status);
  res.send("Supports: " + err.types.join(", "));
});
const app2 = express();
app2.use((req, res, next) => {
  res.format({
    text: () => {
      res.send("hey");
    },
    html: () => {
      res.send("<p>hey</p>");
    },
    json: () => {
      res.send({
        message: "hey",
      });
    },
  });
});
app2.use((err, req, res, next) => {
  res.status(err.status);
  res.send("Supports: " + err.types.join(", "));
});
const app3 = express();
app3.use((req, res, next) => {
  res.format({
    text: () => {
      res.send("hey");
    },
    default: (a, b, c) => {
      assert(req === a);
      assert(res === b);
      assert(next === c);
      res.send("default");
    },
  });
});
const app4 = express();
app4.get("/", (req, res) => {
  res.format({
    text: () => {
      res.send("hey");
    },
    html: () => {
      res.send("<p>hey</p>");
    },
    json: () => {
      res.send({
        message: "hey",
      });
    },
  });
});
app4.use((err, req, res, next) => {
  res.status(err.status);
  res.send("Supports: " + err.types.join(", "));
});
const app5 = express();
app5.use((req, res, next) => {
  res.format({
    default: () => {
      res.send("hey");
    },
  });
});
describe("res", () => {
  describe(".format(obj)", () => {
    describe("with canonicalized mime types", () => {
      test(app1);
    });
    describe("with extnames", () => {
      test(app2);
    });
    describe("with parameters", () => {
      const app = express();
      app.use((req, res, next) => {
        res.format({
          "text/plain; charset=utf-8": () => {
            res.send("hey");
          },
          "text/html; foo=bar; bar=baz": () => {
            res.send("<p>hey</p>");
          },
          "application/json; q=0.5": () => {
            res.send({
              message: "hey",
            });
          },
        });
      });
      app.use((err, req, res, next) => {
        res.status(err.status);
        res.send("Supports: " + err.types.join(", "));
      });
      test(app);
    });
    describe("given .default", () => {
      it("should be invoked instead of auto-responding", async () => {
        await request(app3)
          .get("/")
          .set("Accept", "text/html")
          .expect("default");
      });
      it("should work when only .default is provided", async () => {
        await request(app5).get("/").set("Accept", "*/*").expect("hey");
      });
      it("should be able to invoke other formatter", async () => {
        const app = express();
        app.use((req, res, next) => {
          res.format({
            json: () => {
              res.send("json");
            },
            default: function () {
              res.header("x-default", "1");
              this.json();
            },
          });
        });
        await request(app)
          .get("/")
          .set("Accept", "text/plain")
          .expect(200)
          .expect("x-default", "1")
          .expect("json");
      });

      it("should ignore inherited default formatter", async () => {
        const app = express();

        app.use((req, res, next) => {
          res.format({
            text: () => {
              res.send("text");
            },
          });
        });

        app.use((err, req, res, next) => {
          res.status(err.status);
          res.send("Supports: " + err.types.join(", "));
        });

        await withObjectPrototypeProperties({
          default: (req, res) => {
            res.send("polluted");
          },
        }, async () => {
          await request(app)
            .get("/")
            .set("Accept", "application/json")
            .expect(406, "Supports: text/plain");
        });
      });

      it("should ignore inherited Accept header values", async () => {
        const app = express();

        app.use((req, res, next) => {
          const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "accept");
          let restored = false;

          function restore() {
            if (restored) {
              return;
            }

            restored = true;
            if (descriptor) {
              Object.defineProperty(Object.prototype, "accept", descriptor);
            } else {
              delete Object.prototype.accept;
            }
          }

          Object.defineProperty(Object.prototype, "accept", {
            configurable: true,
            value: "application/json",
            writable: true,
          });
          Object.setPrototypeOf(req.headers, Object.prototype);
          res.once("close", restore);
          res.once("finish", restore);
          next();
        });

        app.use((req, res) => {
          res.format({
            text: () => {
              res.send("text");
            },
            json: () => {
              res.send("json");
            },
          });
        });

        await request(app)
          .get("/")
          .expect(200, "text");
      });
    });
    describe("in router", () => {
      test(app4);
    });
    describe("in router", () => {
      const app = express();
      const router = express.Router();
      router.get("/", (req, res) => {
        res.format({
          text: () => {
            res.send("hey");
          },
          html: () => {
            res.send("<p>hey</p>");
          },
          json: () => {
            res.send({
              message: "hey",
            });
          },
        });
      });
      router.use((err, req, res, next) => {
        res.status(err.status);
        res.send("Supports: " + err.types.join(", "));
      });
      app.use(router);
      test(app);
    });
  });
});
function test(app) {
  it("should utilize qvalues in negotiation", async () => {
    await request(app)
      .get("/")
      .set("Accept", "text/html; q=.5, application/json, */*; q=.1")
      .expect({
        message: "hey",
      });
  });
  it("should allow wildcard type/subtypes", async () => {
    await request(app)
      .get("/")
      .set("Accept", "text/html; q=.5, application/*, */*; q=.1")
      .expect({
        message: "hey",
      });
  });
  it("should default the Content-Type", async () => {
    await request(app)
      .get("/")
      .set("Accept", "text/html; q=.5, text/plain")
      .expect("Content-Type", "text/plain; charset=utf-8")
      .expect("hey");
  });
  it("should set the correct charset for the Content-Type", async () => {
    await new Promise((resolve, reject) => {
      const cb = after(3, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
      request(app)
        .get("/")
        .set("Accept", "text/html")
        .expect("Content-Type", "text/html; charset=utf-8", cb);
      request(app)
        .get("/")
        .set("Accept", "text/plain")
        .expect("Content-Type", "text/plain; charset=utf-8", cb);
      request(app)
        .get("/")
        .set("Accept", "application/json")
        .expect("Content-Type", "application/json; charset=utf-8", cb);
    });
  });
  it("should Vary: Accept", async () => {
    await request(app)
      .get("/")
      .set("Accept", "text/html; q=.5, text/plain")
      .expect("Vary", "Accept");
  });
  describe("when Accept is not present", () => {
    it("should invoke the first callback", async () => {
      await request(app).get("/").expect("hey");
    });
  });
  describe("when no match is made", () => {
    it("should respond with 406 not acceptable", async () => {
      await request(app)
        .get("/")
        .set("Accept", "foo/bar")
        .expect("Supports: text/plain, text/html, application/json")
        .expect(406);
    });
  });
}
