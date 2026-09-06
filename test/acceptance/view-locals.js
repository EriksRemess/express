import { describe, it } from 'node:test';
import request from 'supertest';
import app from '#examples/view-locals/index';

describe('view-locals', () => {
  for (const path of ['/', '/middleware', '/middleware-locals']) {
    it(`should render the user list at ${path}`, async () => {
      await request(app).get(path).expect(200)
        .expect(/<strong>Tobi<\/strong>/)
        .expect(/<strong>Loki<\/strong>/)
        .expect(/<strong>Jane<\/strong>/);
    });
  }
});
