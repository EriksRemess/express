import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import express from '#express';
import send from '#lib/send';
import request from 'supertest';

const fixtures = path.join(import.meta.dirname, 'fixtures');

const cases = [
  ['send', '/', 200, app => app.get('/', (req, res) => res.send('hello'))],
  ['file', '/', 200, app => app.get('/', (req, res) => res.sendFile(path.join(fixtures, 'name.txt')))],
  ['redirect', '/', 302, app => app.get('/', (req, res) => res.redirect('/next'))],
  ['error', '/', 500, app => app.get('/', (req, res, next) => next(new Error('test')))],
  ['not found', '/', 404, () => {}],
  ['static file', '/name.txt', 200, app => app.use(express.static(fixtures))],
  ['static redirect', '/static', 301, app => app.use('/static', express.static(fixtures))],
  ['send error', '/', 404, app => app.get('/', (req, res) => send(req, '/missing', { root: fixtures }).pipe(res))],
  ['send redirect', '/', 301, app => app.get('/', (req, res) => send(req, '', { root: fixtures, index: false }).pipe(res))],
];

describe('response transfer framing', () => {
  for (const [name, url, status, setup] of cases) {
    it(`should avoid conflicting framing for ${name}`, async () => {
      const app = express();
      app.use((req, res, next) => {
        res.set('Transfer-Encoding', 'chunked');
        res.set('Content-Length', '999');
        next();
      });
      setup(app);
      for (const method of ['get', 'head']) {
        await request(app)[method](url).expect(status).expect(res => {
          if (name === 'send error') {
            // The standalone send error handler clears pre-existing headers.
            assert.strictEqual(res.headers['transfer-encoding'], undefined);
            assert.notStrictEqual(res.headers['content-length'], '999');
          } else {
            assert.strictEqual(res.headers['transfer-encoding'], 'chunked');
            assert.strictEqual(res.headers['content-length'], undefined);
          }
        });
      }
    });
  }

  it('should use valid framing for static method rejection', async () => {
    const app = express();
    app.use((req, res, next) => {
      res.set('Transfer-Encoding', 'chunked');
      next();
    });
    app.use(express.static(fixtures, { fallthrough: false }));
    await request(app).post('/name.txt').expect(405).expect('Allow', 'GET, HEAD')
      .expect(res => assert.strictEqual(res.headers['content-length'], undefined));
  });
});
