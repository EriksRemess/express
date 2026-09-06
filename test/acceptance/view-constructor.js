import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { Readable } from 'node:stream';
import request from 'supertest';
import app from '#examples/view-constructor/index';

describe('view-constructor', () => {
  it('should render a fetched template through the custom view', async t => {
    const paths = [];
    t.mock.method(https, 'request', (options, callback) => {
      assert.equal(options.host, 'raw.githubusercontent.com');
      paths.push(options.path);
      return {
        end() {
          callback(Readable.from(['# {title}\n\nTemplate body.']));
        },
      };
    });

    await request(app).get('/').expect(200)
      .expect(/<h1>Example<\/h1>/)
      .expect(/<p>Template body\.<\/p>/);
    assert.deepEqual(paths, ['/expressjs/express/master/examples/markdown/views/index.md']);
  });
});
