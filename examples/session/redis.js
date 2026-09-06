'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

import logger from 'morgan';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });
client.on('error', console.error);
await client.connect();

const app = express();

app.use(logger('dev'));

// Populates req.session
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'keyboard cat',
  store: new RedisStore({ client })
}));

app.get('/', (req, res) => {
  let body = '';
  if (req.session.views) {
    ++req.session.views;
  } else {
    req.session.views = 1;
    body += '<p>First time visiting? view this page in several browsers :)</p>';
  }
  res.send(body + '<p>viewed <strong>' + req.session.views + '</strong> times.</p>');
});

const server = app.listen(Number(process.env.PORT ?? 3000), () => {
  console.log('Express app started on port ' + server.address().port);
});
