/**
 * Module dependencies.
 * @private
 */

import assert from "node:assert";

import http from "node:http";
import {Buffer} from "node:buffer";

/**
 * Module exports.
 * @public
 */

export {shouldHaveBody};

export {shouldHaveHeader};
export {shouldNotHaveBody};
export {shouldNotHaveHeader};
export {rawRequest};
export {shouldSkipQuery};

/**
 * Assert that a supertest response has a specific body.
 *
 * @param {Buffer} buf
 * @returns {function}
 */

function shouldHaveBody(buf) {
  return res => {
    const body = !Buffer.isBuffer(res.body) ? Buffer.from(res.text) : res.body;
    assert.ok(body, "response has body");
    assert.strictEqual(body.toString("hex"), buf.toString("hex"));
  };
}

/**
 * Assert that a supertest response does have a header.
 *
 * @param {string} header Header name to check
 * @returns {function}
 */

function shouldHaveHeader(header) {
  return res => {
    assert.ok(
      header.toLowerCase() in res.headers,
      "should have header " + header,
    );
  };
}

/**
 * Assert that a supertest response does not have a body.
 *
 * @returns {function}
 */

function shouldNotHaveBody() {
  return res => {
    assert.ok(res.text === "" || res.text === undefined);
  };
}

/**
 * Assert that a supertest response does not have a header.
 *
 * @param {string} header Header name to check
 * @returns {function}
 */
function shouldNotHaveHeader(header) {
  return res => {
    assert.ok(
      !(header.toLowerCase() in res.headers),
      "should not have header " + header,
    );
  };
}

function rawRequest(app, options, callback) {
  if (typeof options === "string") {
    options = { path: options };
  }

  const requestOptions = {
    method: "GET",
    host: "127.0.0.1",
    ...options,
  };
  const server = typeof app === "function" ? http.createServer(app) : app;
  let settled = false;

  server.listen(0, "127.0.0.1", () => {
    requestOptions.port = server.address().port;

    const req = http.request(requestOptions, res => {
      const chunks = [];

      res.on("data", chunk => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        finish(null, {
          headers: res.headers,
          statusCode: res.statusCode,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.on("error", finish);
    req.end();
  });

  server.on("error", finish);

  function finish(err, res) {
    if (settled) {
      return;
    }

    settled = true;
    server.close(closeErr => {
      callback(err || closeErr, res);
    });
  }
}

function getMajorVersion(versionString) {
  return versionString.split(".")[0];
}

function shouldSkipQuery(versionString) {
  // Skipping HTTP QUERY tests below Node 22, QUERY wasn't fully supported by Node until 22
  // we could update this implementation to run on supported versions of 21 once they exist
  // upstream tracking https://github.com/nodejs/node/issues/51562
  // express tracking issue: https://github.com/expressjs/express/issues/5615
  return Number(getMajorVersion(versionString)) < 22;
}

export default {
  rawRequest,
  shouldHaveBody,
  shouldHaveHeader,
  shouldNotHaveBody,
  shouldNotHaveHeader,
  shouldSkipQuery
};
