/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import createDebug from "debug";

const require = createRequire(import.meta.url)
const debug = createDebug("express:view")

/**
 * Module variables.
 * @private
 */

const dirname = path.dirname;
const basename = path.basename;
const extname = path.extname;
const join = path.join;
const resolve = path.resolve;

/**
 * Initialize a new `View` with the given `name`.
 *
 * Options:
 *
 *   - `defaultEngine` the default template engine name
 *   - `engines` template engine require() cache
 *   - `root` root path for view lookup
 *
 * @param {string} name
 * @param {object} options
 * @public
 */

class View {
  constructor(name, options) {
    const opts = options || {};

    this.defaultEngine = opts.defaultEngine;
    this.ext = extname(name);
    this.name = name;
    this.root = opts.root;

    if (!this.ext && !this.defaultEngine) {
      throw new Error('No default engine was specified and no extension was provided.');
    }

    let fileName = name;

    if (!this.ext) {
      // get extension from default engine name
      this.ext = this.defaultEngine[0] !== '.'
        ? '.' + this.defaultEngine
        : this.defaultEngine;

      fileName += this.ext;
    }

    if (!opts.engines[this.ext]) {
      // load engine
      const mod = this.ext.slice(1);
      debug('require "%s"', mod)

      // default engine export
      const fn = require(mod).__express;

      if (typeof fn !== 'function') {
        throw new Error('Module "' + mod + '" does not provide a view engine.')
      }

      opts.engines[this.ext] = fn
    }

    // store loaded engine
    this.engine = opts.engines[this.ext];

    // lookup path
    this.path = this.lookup(fileName);
  }

  /**
   * Lookup view by the given `name`
   *
   * @param {string} name
   * @private
   */

  lookup(name) {
    let path;
    const roots = [].concat(this.root);

    debug('lookup "%s"', name);

    for (let i = 0; i < roots.length && !path; i++) {
      const root = roots[i];

      // resolve the path
      const loc = resolve(root, name);
      const dir = dirname(loc);
      const file = basename(loc);

      // resolve the file
      path = this.resolve(dir, file);
    }

    return path;
  }

  /**
   * Render with the given options.
   *
   * @param {object} options
   * @param {function} callback
   * @private
   */

  render(options, callback) {
    let sync = true;

    debug('render "%s"', this.path);

    // render, normalizing sync callbacks
    this.engine(this.path, options, function onRender() {
      if (!sync) {
        return callback.apply(this, arguments);
      }

      // copy arguments
      const args = new Array(arguments.length);
      const cntx = this;

      for (let i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      // force callback to be async
      return process.nextTick(function renderTick() {
        return callback.apply(cntx, args);
      });
    });

    sync = false;
  }

  /**
   * Resolve the file within the given directory.
   *
   * @param {string} dir
   * @param {string} file
   * @private
   */

  resolve(dir, file) {
    const ext = this.ext;

    // <path>.<ext>
    let path = join(dir, file);
    let stat = tryStat(path);

    if (stat && stat.isFile()) {
      return path;
    }

    // <path>/index.<ext>
    path = join(dir, basename(file, ext), 'index' + ext);
    stat = tryStat(path);

    if (stat && stat.isFile()) {
      return path;
    }
  }
}

export default View;

/**
 * Return a stat, maybe.
 *
 * @param {string} path
 * @return {fs.Stats}
 * @private
 */

function tryStat(path) {
  debug('stat "%s"', path);

  try {
    return fs.statSync(path);
  } catch {
    return undefined;
  }
}
