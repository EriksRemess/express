import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import send from '#lib/send';

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
