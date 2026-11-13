import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from '#express';
import request from 'supertest';

function pad(router, middleware = false) {
  for (let i = 0; i < 16; i++) {
    if (middleware) {
      router.use(`/unrelated/${i}`, (req, res, next) => next(new Error('wrong prefix')));
    } else {
      router.get(`/unrelated/${i}`, (req, res) => res.status(500).end());
    }
  }
}

describe('static layers in mixed routers', () => {
  it('keeps duplicate routes, dynamic barriers, method changes and route skips in order', async () => {
    const app = express();
    const hits = [];
    app.use((req, res, next) => next());
    pad(app);
    app.get('/value', (req, res, next) => { hits.push('first'); next('route'); });
    app.get('/value', (req, res, next) => { hits.push('second'); next(); });
    app.get('/:name', (req, res, next) => { hits.push(req.params.name); req.method = 'POST'; next(); });
    pad(app);
    app.get('/value', (req, res) => res.status(500).end());
    app.post('/value', (req, res) => res.json(hits));
    await request(app).get('/value').expect(200, ['first', 'second', 'value']);
  });

  it('resumes after a URL rewrite without revisiting earlier routes', async () => {
    const app = express();
    app.use((req, res, next) => next());
    pad(app);
    app.get('/new', (req, res) => res.status(500).end());
    app.get('/old', (req, res, next) => { req.url = '/new?changed=1'; next(); });
    app.get('/old', (req, res) => res.status(500).end());
    app.get('/new', (req, res) => res.json({ url: req.url, original: req.originalUrl }));
    await request(app).get('/old').expect(200, { url: '/new?changed=1', original: '/old' });
  });

  it('resumes from the static-only path after a rewrite', async () => {
    const app = express();
    pad(app);
    app.get('/old', (req, res, next) => { req.url = '/new'; next(); });
    app.get('/new', (req, res) => res.send('new'));
    await request(app).get('/old').expect(200, 'new');
  });

  it('keeps overlapping prefixes in registration order and restores mount state', async () => {
    const app = express();
    const hits = [];
    pad(app, true);
    for (const prefix of ['/a/b', '/a', '/a/b', '/a/b/c', '/a/bb']) {
      app.use(prefix, (req, res, next) => {
        hits.push([prefix, req.baseUrl, req.url]);
        next();
      });
    }
    app.get('/a/b/c', (req, res) => res.json({ hits, base: req.baseUrl, url: req.url }));
    await request(app).get('/a/b/c?x=1').expect(200, {
      hits: [
        ['/a/b', '/a/b', '/c?x=1'],
        ['/a', '/a', '/b/c?x=1'],
        ['/a/b', '/a/b', '/c?x=1'],
        ['/a/b/c', '/a/b/c', '/?x=1'],
      ],
      base: '', url: '/a/b/c?x=1',
    });
  });

  it('rechecks prefixes after middleware rewrites the remaining URL', async () => {
    const app = express();
    pad(app, true);
    app.use('/a', (req, res, next) => { req.url = '/new'; next(); });
    app.use('/a/old', (req, res) => res.status(500).end());
    app.use('/a/new', (req, res) => res.send(req.baseUrl));
    await request(app).get('/a/old').expect(200, '/a/new');
  });

  it('preserves parameter decoding errors and matching error middleware', async () => {
    const app = express();
    app.use((req, res, next) => next());
    pad(app);
    app.get('/value/:id', (req, res) => res.status(500).end());
    pad(app, true);
    app.use('/value', (error, req, res, next) => res.status(error.status).send(error.message));
    await request(app).get('/value/%FF').expect(400, "Failed to decode param '%FF'");
  });

  it('preserves error propagation, recovery and next(router)', async () => {
    const app = express();
    const router = express.Router();
    pad(router, true);
    router.use('/value', (req, res, next) => next(new Error('failure')));
    pad(router, true);
    router.use('/value', (err, req, res, next) => { req.recovered = err.message; next(); });
    router.use('/value', (req, res, next) => next('router'));
    router.use('/value', (req, res) => res.status(500).end());
    app.use('/api', router);
    app.get('/api/value', (req, res) => res.send(req.recovered));
    await request(app).get('/api/value').expect(200, 'failure');
  });

  it('collects OPTIONS and preserves implicit and explicit HEAD handling', async () => {
    const app = express();
    app.use((req, res, next) => next());
    pad(app);
    app.get('/value', (req, res) => res.set('X-Handler', 'get').send('get'));
    app.post('/value', (req, res) => res.end());
    app.route('/explicit').get((req, res) => res.status(500).end())
      .head((req, res) => res.set('X-Handler', 'head').end());
    await request(app).options('/value').expect('Allow', 'GET, HEAD, POST').expect(200, 'GET, HEAD, POST');
    await request(app).head('/value').expect('X-Handler', 'get').expect(200);
    await request(app).head('/explicit').expect('X-Handler', 'head').expect(200);
  });

  it('sees routes registered after a request has already been dispatched', async () => {
    const app = express();
    app.use((req, res, next) => next());
    pad(app);
    app.get('/old', (req, res) => res.send('old'));
    await request(app).get('/old').expect(200, 'old');
    app.get('/new', (req, res) => res.send('new'));
    await request(app).get('/new').expect(200, 'new');
  });

  it('retains root, array and regular expression middleware as scan barriers', async () => {
    const app = express();
    const hits = [];
    pad(app, true);
    app.use(['/other', '/'], (req, res, next) => { hits.push('array'); next(); });
    pad(app, true);
    app.use(/^\/value/, (req, res, next) => { hits.push('regexp'); next(); });
    pad(app);
    app.get(['/other', '/value'], (req, res) => res.json(hits));
    await request(app).get('/value').expect(200, ['array', 'regexp']);
  });

  for (const strict of [false, true]) {
    for (const caseSensitive of [false, true]) {
      it(`preserves route and prefix slash/case rules with strict=${strict}, caseSensitive=${caseSensitive}`, async () => {
        const router = express.Router({ strict, caseSensitive });
        router.use((req, res, next) => next());
        pad(router);
        router.get('/Value', (req, res) => res.end('route'));
        pad(router, true);
        router.use('/Mount///', (req, res) => res.end('prefix'));

        for (const [url, expected] of [
          ['/Value', 'route'], ['/value', caseSensitive ? 'missing' : 'route'],
          ['/Value/', strict ? 'missing' : 'route'], ['/Value//', 'missing'],
          ['/Mount/child', 'prefix'], ['/MountX/child', 'missing'],
          ['/mount/child', caseSensitive ? 'missing' : 'prefix'],
        ]) {
          const actual = await new Promise((resolve, reject) => router.handle(
            { url, method: 'GET' }, { end: resolve }, err => err ? reject(err) : resolve('missing'),
          ));
          assert.equal(actual, expected, url);
        }
      });
    }
  }

  it('preserves non-Unicode regular expression case folding', async () => {
    for (const [registered, requested, matches] of [
      ['/σ', '/ς', true], ['/k', '/K', false], ['/s', '/ſ', false], ['/İ', '/i', false],
    ]) {
      for (const middleware of [false, true]) {
        const router = express.Router();
        router.use((req, res, next) => next());
        pad(router, middleware);
        router[middleware ? 'use' : 'get'](registered, (req, res) => res.end('matched'));
        const actual = await new Promise((resolve, reject) => router.handle(
          { url: requested, method: 'GET' }, { end: resolve }, err => err ? reject(err) : resolve('missing'),
        ));
        assert.equal(actual, matches ? 'matched' : 'missing');
      }
    }
  });
});
