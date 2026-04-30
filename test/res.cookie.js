"use strict";

import {describe, it} from "node:test";
import express from "#express";
import request from "supertest";
import cookieParser from "#lib/utils/cookies";
import { withObjectPrototypeProperties } from "#test/support/object-prototype";
describe("res", () => {
  describe(".cookie(name, object)", () => {
    it("should generate a JSON cookie", async () => {
      const app = express();
      app.use((req, res) => {
        res
          .cookie("user", {
            name: "tobi",
          })
          .end();
      });
      await request(app)
        .get("/")
        .expect("Set-Cookie", "user=j%3A%7B%22name%22%3A%22tobi%22%7D; Path=/")
        .expect(200);
    });
  });
  describe(".cookie(name, string)", () => {
    it("should set a cookie", async () => {
      const app = express();
      app.use((req, res) => {
        res.cookie("name", "tobi").end();
      });
      await request(app)
        .get("/")
        .expect("Set-Cookie", "name=tobi; Path=/")
        .expect(200);
    });
    it("should allow multiple calls", async () => {
      const app = express();
      app.use((req, res) => {
        res.cookie("name", "tobi");
        res.cookie("age", 1);
        res.cookie("gender", "?");
        res.end();
      });
      await request(app)
        .get("/")
        .expect(
          "Set-Cookie",
          "name=tobi; Path=/,age=1; Path=/,gender=%3F; Path=/",
        )
        .expect(200);
    });
  });
  describe(".cookie(name, string, options)", () => {
    it("should ignore inherited options", async () => {
      await withObjectPrototypeProperties({
        httpOnly: true,
        signed: true,
      }, async () => {
        const app = express();

        app.use((req, res) => {
          res.cookie("name", "tobi", {});
          res.end();
        });

        await request(app)
          .get("/")
          .expect("Set-Cookie", "name=tobi; Path=/")
          .expect(200);
      });
    });
    it("should set params", async () => {
      const app = express();
      app.use((req, res) => {
        res.cookie("name", "tobi", {
          httpOnly: true,
          secure: true,
        });
        res.end();
      });
      await request(app)
        .get("/")
        .expect("Set-Cookie", "name=tobi; Path=/; HttpOnly; Secure")
        .expect(200);
    });
    describe("expires", () => {
      it("should throw on invalid date", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            expires: new Date(NaN),
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(500, /option expires is invalid/);
      });
    });
    describe("partitioned", () => {
      it("should set partitioned", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            partitioned: true,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", "name=tobi; Path=/; Partitioned")
          .expect(200);
      });
    });
    describe("maxAge", () => {
      it("should set relative expires", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            maxAge: 1000,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /name=tobi; Max-Age=1; Path=\/; Expires=/)
          .expect(200);
      });
      it("should set max-age", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            maxAge: 1000,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /Max-Age=1/);
      });
      it("should not mutate the options object", async () => {
        const app = express();
        const options = {
          maxAge: 1000,
        };
        const optionsCopy = {
          ...options,
        };
        app.use((req, res) => {
          res.cookie("name", "tobi", options);
          res.json(options);
        });
        await request(app).get("/").expect(200, optionsCopy);
      });
      it("should not throw on null", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            maxAge: null,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Set-Cookie", "name=tobi; Path=/");
      });
      it("should not throw on undefined", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            maxAge: undefined,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(200)
          .expect("Set-Cookie", "name=tobi; Path=/");
      });
      it("should throw an error with invalid maxAge", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            maxAge: "foobar",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(500, /option maxAge is invalid/);
      });
    });
    describe("priority", () => {
      it("should set low priority", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            priority: "low",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /Priority=Low/)
          .expect(200);
      });
      it("should set medium priority", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            priority: "medium",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /Priority=Medium/)
          .expect(200);
      });
      it("should set high priority", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            priority: "high",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /Priority=High/)
          .expect(200);
      });
      it("should throw with invalid priority", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            priority: "foobar",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(500, /option priority is invalid/);
      });
    });
    describe("sameSite", () => {
      it("should set strict from boolean true", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            sameSite: true,
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /SameSite=Strict/)
          .expect(200);
      });

      it("should set lax", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            sameSite: "lax",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /SameSite=Lax/)
          .expect(200);
      });

      it("should set none", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            sameSite: "none",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect("Set-Cookie", /SameSite=None/)
          .expect(200);
      });

      it("should throw with invalid sameSite", async () => {
        const app = express();
        app.use((req, res) => {
          res.cookie("name", "tobi", {
            sameSite: "bogus",
          });
          res.end();
        });
        await request(app)
          .get("/")
          .expect(500, /option sameSite is invalid/);
      });
    });
    describe("signed", () => {
      it("should generate a signed JSON cookie", async () => {
        const app = express();
        app.use(cookieParser("foo bar baz"));
        app.use((req, res) => {
          res
            .cookie(
              "user",
              {
                name: "tobi",
              },
              {
                signed: true,
              },
            )
            .end();
        });
        await request(app)
          .get("/")
          .expect(
            "Set-Cookie",
            "user=s%3Aj%3A%7B%22name%22%3A%22tobi%22%7D.K20xcwmDS%2BPb1rsD95o5Jm5SqWs1KteqdnynnB7jkTE; Path=/",
          )
          .expect(200);
      });
    });
    describe("signed without secret", () => {
      it("should throw an error", async () => {
        const app = express();
        app.use(cookieParser());
        app.use((req, res) => {
          res
            .cookie("name", "tobi", {
              signed: true,
            })
            .end();
        });
        await request(app)
          .get("/")
          .expect(500, /secret\S+ required for signed cookies/);
      });
    });
    describe(".signedCookie(name, string)", () => {
      it("should set a signed cookie", async () => {
        const app = express();
        app.use(cookieParser("foo bar baz"));
        app.use((req, res) => {
          res
            .cookie("name", "tobi", {
              signed: true,
            })
            .end();
        });
        await request(app)
          .get("/")
          .expect(
            "Set-Cookie",
            "name=s%3Atobi.xJjV2iZ6EI7C8E5kzwbfA9PVLl1ZR07UTnuTgQQ4EnQ; Path=/",
          )
          .expect(200);
      });
    });
  });
});
