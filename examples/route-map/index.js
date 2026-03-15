'use strict'

/**
 * Module dependencies.
 */

import escapeHtml from '#lib/utils/escape-html';

import express from "#express";
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const verbose = process.env.NODE_ENV !== 'test';

const app = express();

export default app;

app.map = (a, route) => {
  route = route || '';
  for (const key in a) {
    switch (typeof a[key]) {
      // { '/path': { ... }}
      case 'object':
        app.map(a[key], route + key);
        break;
      // get: () =>{ ... }
      case 'function':
        if (verbose) console.log('%s %s', key, route);
        app[key](route, a[key]);
        break;
    }
  }
};

const users = {
  list: (req, res) =>{
    res.send('user list');
  },

  get: (req, res) =>{
    res.send('user ' +  escapeHtml(req.params.uid))
  },

  delete: (req, res) =>{
    res.send('delete users');
  }
};

const pets = {
  list: (req, res) =>{
    res.send('user ' + escapeHtml(req.params.uid) + '\'s pets')
  },

  delete: (req, res) =>{
    res.send('delete ' + escapeHtml(req.params.uid) + '\'s pet ' + escapeHtml(req.params.pid))
  }
};

app.map({
  '/users': {
    get: users.list,
    delete: users.delete,
    '/:uid': {
      get: users.get,
      '/pets': {
        get: pets.list,
        '/:pid': {
          delete: pets.delete
        }
      }
    }
  }
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
