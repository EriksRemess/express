import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import parseurl, { getProtohost, originalurl } from '#lib/utils/parseurl';

describe('parseurl', () => {
  for (const prefix of ['', 'http://example.com', 'https://[::1]:8443']) {
    for (const path of ['/public/../admin/secret', '/public/%2e%2e/admin/secret', '/public\\..\\admin/secret']) {
      it(`should preserve the raw pathname in ${prefix}${path}`, () => {
        const url = `${prefix}${path}?next=/a/../b#fragment?ignored`;
        const req = { url, originalUrl: url };

        for (const parsed of [parseurl(req), originalurl(req)]) {
          assert.equal(parsed.pathname, path);
          assert.equal(parsed.search, '?next=/a/../b');
          assert.equal(parsed.query, 'next=/a/../b');
          assert.equal(parsed.path, `${path}?next=/a/../b`);
          assert.equal(parsed._raw, url);
        }
      });
    }
  }

  it('should separate authority from query and fragment when the path is empty', () => {
    for (const suffix of ['', '?next=/a', '#/a', '?next=/a#/b']) {
      const url = `http://example.com${suffix}`;
      assert.equal(getProtohost(url), 'http://example.com');
      assert.equal(parseurl({ url }).pathname, '/');
    }
  });

  it('should not treat URLs within an origin-form path or query as an authority', () => {
    for (const url of ['/proxy/http://example.com/a', '/proxy?url=http://example.com/a']) {
      assert.equal(getProtohost(url), undefined);
    }
  });

  it('should refresh the cache when the URL changes without changing originalUrl', () => {
    const req = { url: 'http://example.com/a/../b?x=1' };
    req.originalUrl = req.url;
    const first = parseurl(req);
    assert.equal(parseurl(req), first);
    req.url = 'http://example.com/c/../d?x=2';
    assert.equal(parseurl(req).pathname, '/c/../d');
    assert.equal(originalurl(req).pathname, '/a/../b');
  });
});
