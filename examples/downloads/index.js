'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const app = express();

export default app;

// path to where the files are stored on disk
const FILES_DIR = path.join(__dirname, 'files');

app.get('/', (req, res) => {
  res.send('<ul>' +
    '<li>Download <a href="/files/notes/groceries.txt">notes/groceries.txt</a>.</li>' +
    '<li>Download <a href="/files/amazing.txt">amazing.txt</a>.</li>' +
    '<li>Download <a href="/files/missing.txt">missing.txt</a>.</li>' +
    '<li>Download <a href="/files/CCTV大赛上海分赛区.txt">CCTV大赛上海分赛区.txt</a>.</li>' +
    '</ul>')
});

// /files/* is accessed via req.params[0]
// but here we name it :file
app.get('/files/*file', (req, res, next) => {
  res.download(req.params.file.join('/'), { root: FILES_DIR }, err => {
    if (!err) return; // file sent
    if (err.status !== 404) return next(err); // non-404 error
    // file for download not found
    res.statusCode = 404;
    res.send('Cant find that file, sorry!');
  });
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
