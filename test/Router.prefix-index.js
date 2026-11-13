import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Router from '#lib/router/index';

function pad(router, middleware = false) {
  for (let i = 0; i < 16; i++) {
    router[middleware ? 'use' : 'get'](`/unrelated/${i}/:id`, (req, res) => {
      res.end('wrong prefix');
    });
  }
}

function dispatch(router, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    router.handle({ url, method }, { end: resolve }, err => err ? reject(err) : resolve('missing'));
  });
}

describe('literal prefixes in dynamic route indexes', () => {
  it('matches the first, middle and last registered prefixes', async () => {
    const router = Router();
    for (let i = 0; i < 16; i++) {
      router.get(`/items/${i}/:id`, (req, res) => res.end([i, req.params.id]));
    }
    for (const i of [0, 7, 15]) {
      assert.deepEqual(await dispatch(router, `/items/${i}/hello%20world`), [i, 'hello world']);
    }
  });

  it('preserves duplicate prefixes, parameter callbacks and next(route) order', async () => {
    const router = Router();
    const hits = [];
    pad(router);
    router.param('id', (req, res, next, id) => { hits.push(id); next(); });
    router.get('/items/:id/first', (req, res) => res.end('wrong suffix'));
    router.get('/items/:id/last', (req, res, next) => { hits.push('first'); next('route'); });
    router.get('/items/:id/last', (req, res) => res.end({ hits, params: { ...req.params } }));
    assert.deepEqual(await dispatch(router, '/items/hello%20world/last'), {
      hits: ['hello world', 'first'], params: { id: 'hello world' },
    });
  });

  it('reselects prefixes after URL and method rewrites', async () => {
    const router = Router();
    pad(router);
    router.post('/new/:id', (req, res) => res.end('earlier route'));
    router.get('/old/:id', (req, res, next) => { req.url = '/new/42'; req.method = 'POST'; next(); });
    router.get('/new/:id', (req, res) => res.end('wrong method'));
    router.post('/new/:id', (req, res) => res.end(req.params.id));
    assert.equal(await dispatch(router, '/old/7'), '42');
  });

  it('keeps overlapping dynamic and static mounts in registration order', async () => {
    const router = Router();
    const hits = [];
    pad(router, true);
    for (const path of ['/items/:id', '/items', '/items/*parts']) {
      router.use(path, (req, res, next) => {
        hits.push([path, req.baseUrl, req.url, { ...req.params }]);
        next();
      });
    }
    router.get('/items/:id/child', (req, res) => res.end(hits));
    assert.deepEqual(await dispatch(router, '/items/42/child?q=1'), [
      ['/items/:id', '/items/42', '/child?q=1', { id: '42' }],
      ['/items', '/items', '/42/child?q=1', {}],
      ['/items/*parts', '/items/42/child', '/?q=1', { parts: ['42', 'child'] }],
    ]);
  });

  it('does not skip decoding failures on a matching prefix', async () => {
    const router = Router();
    pad(router);
    router.get('/items/:id', (req, res) => res.end('unexpected'));
    await assert.rejects(dispatch(router, '/items/%FF'), { status: 400, message: "Failed to decode param '%FF'" });
    assert.equal(await dispatch(router, '/other/%FF'), 'missing');
  });

  it('keeps patterns without a required prefix as scan barriers', async () => {
    for (const path of ['/:id', '{/items}/:id', ['/items/:id', '/:id'], /^\/([^/]+)$/]) {
      const router = Router();
      pad(router);
      router.get(path, (req, res) => res.end('matched'));
      pad(router);
      assert.equal(await dispatch(router, '/value'), 'matched');
    }
  });

  it('sees dynamic routes registered after dispatch', async () => {
    const router = Router();
    pad(router);
    assert.equal(await dispatch(router, '/new/42'), 'missing');
    router.get('/new/:id', (req, res) => res.end(req.params.id));
    assert.equal(await dispatch(router, '/new/42'), '42');
  });

  it('preserves matches as groups grow and their prefix distribution changes', async () => {
    const router = Router();
    for (let i = 0; i < 16; i++) {
      router.get(`/items/:id/action-${i}`, (req, res) => res.end(i));
      assert.equal(await dispatch(router, `/items/42/action-${i}`), i);
    }
    for (let i = 0; i < 16; i++) {
      router.get(`/other/${i}/:id`, (req, res) => res.end(req.params.id));
      assert.equal(await dispatch(router, `/other/${i}/42`), '42');
    }
    assert.equal(await dispatch(router, '/items/42/action-0'), 0);
    assert.equal(await dispatch(router, '/items/42/action-15'), 15);
    router.get('/items/:id/last', (req, res) => res.end('last'));
    assert.equal(await dispatch(router, '/items/42/last'), 'last');
    router.get('/new/:id', (req, res) => res.end(req.params.id));
    assert.equal(await dispatch(router, '/new/42'), '42');
    assert.equal(await dispatch(router, '/items/42/action-0'), 0);
  });

  it('sees routes appended while an asynchronous handler is running', async () => {
    const router = Router();
    pad(router);
    router.get('/old/:id', async (req, res, next) => {
      await Promise.resolve();
      router.get('/new/:id', (req, res) => res.end(req.params.id));
      req.url = '/new/42';
      next();
    });
    assert.equal(await dispatch(router, '/old/7'), '42');
  });

  it('preserves implicit HEAD and collects OPTIONS across dynamic matches', async () => {
    const router = Router();
    pad(router);
    router.get('/items/:id', (req, res) => res.end('get'));
    router.post('/items/:id', (req, res) => res.end('post'));
    assert.equal(await dispatch(router, '/items/42', 'HEAD'), 'get');

    const headers = {};
    const body = await new Promise((resolve, reject) => {
      router.handle({ url: '/items/42', method: 'OPTIONS' }, {
        setHeader(name, value) { headers[name] = value; },
        getHeader(name) { return headers[name]; },
        end: resolve,
      }, err => reject(err || new Error('missing OPTIONS response')));
    });
    assert.equal(body, 'GET, HEAD, POST');
    assert.equal(headers.Allow, body);
  });

  for (const strict of [false, true]) {
    for (const caseSensitive of [false, true]) {
      it(`retains dynamic path semantics with strict=${strict}, caseSensitive=${caseSensitive}`, async () => {
        const cases = [
          ['/Items/:id', '/Items/42', { id: '42' }],
          ['/Items/:id', '/ItemsX/42', 'missing'],
          ['/Items/:id', '/items/42', caseSensitive ? 'missing' : { id: '42' }],
          ['/Items/:id', '/Items/42/', strict ? 'missing' : { id: '42' }],
          ['/Items/:id', '/Items/42//', 'missing'],
          ['/Items/ab:id', '/Items/abc', { id: 'c' }],
          ['/Items/{foo}/:id', '/Items//42', { id: '42' }],
          ['/Items/name{.:ext}', '/Items/name', {}],
          ['/Items/name{.:ext}', '/Items/name.txt', { ext: 'txt' }],
          ['/Items\\+/:id', '/Items+/42', { id: '42' }],
          ['/Items/\\:literal/:id', '/Items/:literal/42', { id: '42' }],
          ['/Items/:"quoted name"', '/Items/42', { 'quoted name': '42' }],
          ['/Items/*parts', '/Items/a%2Fb/c', { parts: ['a/b', 'c'] }],
          ['//:id', '//42', { id: '42' }],
          ['/σ/:id', '/ς/42', caseSensitive ? 'missing' : { id: '42' }],
          ['/k/:id', '/K/42', 'missing'],
        ];
        for (const [path, url, expected] of cases) {
          const router = Router({ strict, caseSensitive });
          pad(router);
          router.get(path, (req, res) => res.end({ ...req.params }));
          assert.deepEqual(await dispatch(router, url), expected, `${path}: ${url}`);
        }
      });
    }
  }
});
