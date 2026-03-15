'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

import GithubView from "#examples/view-constructor/github-view";
import {parse} from 'marked';
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const app = express();

export default app;

// register .md as an engine in express view system
app.engine('md', (str, options, fn) => {
  try {
    let html = parse(str);
    html = html.replace(/\{([^}]+)\}/g, (_, name) => {
      return options[name] || '';
    });
    fn(null, html);
  } catch(err) {
    fn(err);
  }
});

// pointing to a particular github repo to load files from it
app.set('views', 'expressjs/express');

// register a new view constructor
app.set('view', GithubView);

app.get('/', (req, res) => {
  // rendering a view relative to the repo.
  // app.locals, res.locals, and locals passed
  // work like they normally would
  res.render('examples/markdown/views/index.md', { title: 'Example' });
});

app.get('/Readme.md', (req, res) => {
  // rendering a view from https://github.com/expressjs/express/blob/master/Readme.md
  res.render('Readme.md');
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
