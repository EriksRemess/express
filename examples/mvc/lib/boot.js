'use strict'

/**
 * Module dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from "#express";

const RESERVED_EXPORTS = new Set(['name', 'prefix', 'engine', 'before']);

export default async (parent, options) => {
  const dir = path.join(import.meta.dirname, '..', 'controllers');
  const verbose = options.verbose;

  for (const entryName of fs.readdirSync(dir)) {
    const file = path.join(dir, entryName);
    if (!fs.statSync(file).isDirectory()) continue;

    if (verbose) {
      console.log('\n   %s:', entryName);
    }

    const moduleUrl = pathToFileURL(path.join(file, 'index.js')).href;
    const obj = await import(moduleUrl);
    const controllerName = obj.name || entryName;
    const prefix = obj.prefix || '';
    const app = express();

    // allow specifying the view engine
    if (obj.engine) app.set('view engine', obj.engine);
    app.set('views', path.join(import.meta.dirname, '..', 'controllers', controllerName, 'views'));

    // generate routes based on the exported methods
    for (const key of Object.keys(obj)) {
      if (RESERVED_EXPORTS.has(key)) continue;

      let method;
      let url;
      switch (key) {
        case 'show':
          method = 'get';
          url = '/' + controllerName + '/:' + controllerName + '_id';
          break;
        case 'list':
          method = 'get';
          url = '/' + controllerName + 's';
          break;
        case 'edit':
          method = 'get';
          url = '/' + controllerName + '/:' + controllerName + '_id/edit';
          break;
        case 'update':
          method = 'put';
          url = '/' + controllerName + '/:' + controllerName + '_id';
          break;
        case 'create':
          method = 'post';
          url = '/' + controllerName;
          break;
        case 'index':
          method = 'get';
          url = '/';
          break;
        default:
          /* istanbul ignore next */
          throw new Error('unrecognized route: ' + controllerName + '.' + key);
      }

      const handler = obj[key];
      const routePath = prefix + url;

      if (obj.before) {
        app[method](routePath, obj.before, handler);
        if (verbose) {
          console.log('     %s %s -> before -> %s', method.toUpperCase(), routePath, key);
        }
      } else {
        app[method](routePath, handler);
        if (verbose) {
          console.log('     %s %s -> %s', method.toUpperCase(), routePath, key);
        }
      }
    }

    // mount the app
    parent.use(app);
  }
};
