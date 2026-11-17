import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import { ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import send from '#lib/send';

it('forwards a file listener exception during conditional revalidation', () => {
  const file = path.join(import.meta.dirname, 'fixtures', 'nums.txt');
  const req = { method: 'GET', headers: { 'if-none-match': '*' } };
  const stream = send(req, file);
  stream.res = new ServerResponse(req);
  const failure = Object.freeze(new Error('file notification failed'));
  let reported;
  stream.on('file', () => { throw failure; });
  stream.on('error', err => { reported = err; });
  stream.send(file, fs.statSync(file));
  assert.equal(reported, failure);
  assert.equal(stream.res.writableEnded, false);
});

it('closes the opened descriptor before reporting a header setup error', async () => {
  const file = path.join(import.meta.dirname, 'fixtures', 'nums.txt');
  const stream = send({ headers: {} }, file);
  const failure = new Error('header setup failed');
  stream.on('headers', () => { throw failure; });
  const error = new Promise(resolve => stream.once('error', resolve));
  const fd = fs.openSync(file, 'r');
  try {
    stream.sendOpenedFile(file, fs.fstatSync(fd), fd);
  } catch (err) {
    fs.closeSync(fd);
    throw err;
  }
  assert.equal(await error, failure);
  assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' });
});

it('closes the opened descriptor when the read stream rejects an option', async () => {
  const file = path.join(import.meta.dirname, 'fixtures', 'nums.txt');
  const req = { method: 'GET', headers: {} };
  const stream = send(req, file, { highWaterMark: -1 });
  stream.res = new ServerResponse(req);
  const error = new Promise(resolve => stream.once('error', resolve));
  const fd = fs.openSync(file, 'r');
  try {
    stream.sendOpenedFile(file, fs.fstatSync(fd), fd);
  } catch (err) {
    fs.closeSync(fd);
    throw err;
  }
  assert.equal((await error).code, 'ERR_INVALID_ARG_VALUE');
  assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' });
});

it('rejects invalid file offsets before starting a transfer', () => {
  for (const options of [{ start: 3, end: 1 }, { start: -1 }, { end: 0.5 }]) {
    assert.throws(() => send({ headers: {} }, '/file.txt', options), RangeError);
  }
});

it('keeps an empty file transfer empty when the file grows after stat', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-send-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'growing.txt');
  fs.writeFileSync(file, '');
  const req = { method: 'GET', headers: {} };
  const stream = send(req, file);
  const headers = new Map();
  let written = 0;
  const sink = new Writable({
    write(chunk, encoding, callback) { written += chunk.length; callback(); },
  });
  sink.finished = false;
  sink.getHeader = name => headers.get(name);
  sink.setHeader = (name, value) => headers.set(name, value);
  stream.on('headers', () => fs.appendFileSync(file, 'new data'));
  const done = finished(sink);
  stream.pipe(sink);
  await done;
  assert.equal(headers.get('Content-Length'), 0);
  assert.equal(written, 0);
});

describe('send root resolution', () => {
  for (const missingRoot of [false, true]) {
    it(`should preserve separate async stores during overlapping ${missingRoot ? 'failed' : 'successful'} root lookups`, async (t) => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'express-send-context-'));
      const root = path.join(tempRoot, 'root');
      const filePath = path.join(root, 'file.txt');
      const storage = new AsyncLocalStorage();

      t.after(() => {
        storage.disable();
        fs.rmSync(tempRoot, { recursive: true, force: true });
      });

      if (!missingRoot) {
        fs.mkdirSync(root);
        fs.writeFileSync(filePath, 'file contents');
      }

      const stores = [{ requestId: 'first' }, { requestId: 'second' }, undefined];
      // Start all lookups in one turn so they overlap without timing assumptions.
      const results = await Promise.all(stores.map(store => storage.run(store, () => {
        return new Promise(resolve => {
          const stream = send({ headers: {} }, '/file.txt', { root });
          stream.withinRoot(filePath, (error, contained, realPath) => {
            resolve({ error, contained, realPath, store: storage.getStore() });
          });
        });
      })));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        assert.strictEqual(result.store, stores[i]);
        assert.strictEqual(result.contained, !missingRoot);

        if (missingRoot) {
          assert.strictEqual(result.error.code, 'ENOENT');
          assert.strictEqual(result.realPath, undefined);
        } else {
          assert.strictEqual(result.error, null);
          assert.strictEqual(result.realPath, fs.realpathSync(filePath));
        }
      }
    });
  }
});
