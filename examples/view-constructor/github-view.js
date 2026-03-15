'use strict'

/**
 * Module dependencies.
 */

import https from 'node:https';

import path from 'node:path';
const extname = path.extname;

/**
 * Expose `GithubView`.
 */

export default GithubView;

/**
 * Custom view that fetches and renders
 * remove github templates. You could
 * render templates from a database etc.
 */

class GithubView {
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

  render(options, fn) {
    const self = this;
    const opts = {
      host: 'raw.githubusercontent.com',
      port: 443,
      path: this.path,
      method: 'GET'
    };

    https.request(opts, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', str => { buf += str });
      res.on('end', () => {
        self.engine(buf, options, fn);
      });
    }).end();
  }
}
