import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import express from '#express';
import createDebug from '#lib/utils/debug';

describe('debug log escaping', () => {
  it('should preserve formatting and ordinary Unicode text', async t => {
    const output = await captureDebug(t, 'review', () => {
      createDebug('review')('request %s %d', '/Rīga/日本語', 200);
    });

    assert.equal(output, 'review request /Rīga/日本語 200\n');
  });

  it('should escape control characters, Unicode separators, and literal backslashes', async t => {
    const output = await captureDebug(t, 'review', () => {
      createDebug('review')('%s', '\0\b\t\n\v\f\r\x1b\x7f\x85\x9f\u2028\u2029\\n');
    });

    assert.equal(output, 'review \\u0000\\b\\t\\n\\u000b\\f\\r\\u001b\\u007f\\u0085\\u009f\\u2028\\u2029\\\\n\n');
  });

  it('should keep multiline object formatting within one log record', async t => {
    const output = await captureDebug(t, 'review', () => {
      createDebug('review')('%o', { values: Array.from({ length: 100 }, (_, i) => i) });
    });

    assert.ok(output.includes('\\n'));
    assert.equal(output.split('\n').length, 2);
    assert.ok(output.endsWith('\n'));
  });

  it('should not format or write disabled debug messages', async t => {
    const output = await captureDebug(t, '', () => {
      createDebug('review')('%s', { toString() { throw new Error('formatted disabled message'); } });
    });

    assert.equal(output, '');
  });

  for (const [encoded, escaped] of [
    ['%0a', '\\n'],
    ['%C2%85', '\\u0085'],
    ['%E2%80%A8', '\\u2028'],
    ['%E2%80%A9', '\\u2029'],
  ]) {
    it(`should escape ${encoded} in decoded static file paths`, async t => {
      const app = express();
      app.use(express.static(fileURLToPath(new URL('./fixtures/', import.meta.url))));

      const output = await captureDebug(t, 'send', async () => {
        await request(app).get(`/missing${encoded}FORGED`).expect(404);
      });

      assert.ok(output.includes(`missing${escaped}FORGED`));
      assert.doesNotMatch(output, /[\u0085\u2028\u2029]/);
      assert.ok(output.trimEnd().split('\n').every(line => line.startsWith('send ')));
    });
  }
});

async function captureDebug(t, pattern, callback) {
  const previousDebug = process.env.DEBUG;
  let output = '';
  const write = t.mock.method(process.stderr, 'write', chunk => {
    output += chunk;
    return true;
  });

  process.env.DEBUG = pattern;
  try {
    await callback();
    return output;
  } finally {
    write.mock.restore();
    if (previousDebug === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = previousDebug;
    }
  }
}
