import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '#examples/view-constructor/index';

describe('view-constructor', () => {
  it('should render a fetched template through the custom view', async t => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      urls.push(url);
      return new Response('# {title}\n\nTemplate body.');
    });

    await request(app).get('/').expect(200)
      .expect(/<h1>Example<\/h1>/)
      .expect(/<p>Template body\.<\/p>/);
    assert.deepEqual(urls, ['https://raw.githubusercontent.com/expressjs/express/master/examples/markdown/views/index.md']);
  });

  it('should pass network failures to the error handler', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
    await request(app).get('/').expect(500, /Network unavailable/);
  });

  it('should reject HTTP error responses', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('Not found', { status: 404 }));
    await request(app).get('/').expect(500, /Failed to fetch view \(HTTP 404\)/);
  });

  it('should pass interrupted downloads to the error handler', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('Download interrupted')); }
    })));
    await request(app).get('/').expect(500, /Download interrupted/);
  });
});
