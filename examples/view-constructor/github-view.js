'use strict'

/**
 * Module dependencies.
 */

import path from 'node:path';
const extname = path.extname;

/**
 * Custom view that fetches and renders
 * remote github templates. You could
 * render templates from a database etc.
 */

export default class GithubView {
  constructor(name, options) {
    this.name = name;
    options = options || {};
    this.engine = options.engines[extname(name)];
    // "root" is the app.set('views') setting, however
    // in your own implementation you could ignore this
    this.path = '/' + options.root + '/master/' + name;
  }

  /**
   * Render the view.
   */

  async render(options, fn) {
    let html;
    try {
      const response = await fetch('https://raw.githubusercontent.com' + this.path, {
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        throw new Error('Failed to fetch view (HTTP ' + response.status + ')');
      }
      const source = await response.text();
      html = await new Promise((resolve, reject) => {
        this.engine(source, options, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (err) {
      fn(err);
      return;
    }
    fn(null, html);
  }
}
