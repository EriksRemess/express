'use strict'

/**
 * Module dependencies.
 */

import escapeHtml from '#lib/utils/escape-html';

import express from "#express";
import fs from 'node:fs';
import { marked } from 'marked';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const app = express();

export default app;

// register .md as an engine in express view system

app.engine('md', (path, options, fn) => {
  fs.readFile(path, 'utf8', (err, str) => {
    if (err) return fn(err);
    const html = marked.parse(str).replace(/\{([^}]+)\}/g, (_, name) => {
      return escapeHtml(options[name] || '');
    });
    fn(null, html);
  });
});

app.set('views', path.join(__dirname, 'views'));

// make it the default, so we don't need .md
app.set('view engine', 'md');

app.get('/', (req, res) => {
  res.render('index', { title: 'Markdown Example' });
});

app.get('/fail', (req, res) => {
  res.render('missing', { title: 'Markdown Example' });
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
