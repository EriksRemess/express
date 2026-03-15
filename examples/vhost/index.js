'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

import logger from 'morgan';
import vhost from '#lib/utils/vhost';
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

/*
edit /etc/hosts:

127.0.0.1       foo.example.com
127.0.0.1       bar.example.com
127.0.0.1       example.com
*/

// Main server app

const main = express();

if (isMain) main.use(logger('dev'));

main.get('/', (req, res) => {
  res.send('Hello from main app!');
});

main.get('/:sub', (req, res) => {
  res.send('requested ' + req.params.sub);
});

// Redirect app

const redirect = express();

redirect.use((req, res) => {
  if (isMain) console.log(req.vhost);
  res.redirect('http://example.com:3000/' + req.vhost[0]);
});

// Vhost app

const app = express();

export default app;

app.use(vhost('*.example.com', redirect)); // Serves all subdomains via Redirect app
app.use(vhost('example.com', main)); // Serves top level domain via Main server app

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
