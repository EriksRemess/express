'use strict'

// install redis first:
// https://redis.io/

// then:
// $ npm install redis
// $ redis-server

/**
 * Module dependencies.
 */

import express from "#express";

import path from 'node:path';
import redis from 'redis';
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const db = redis.createClient();
const app = express();

app.use(express.static(path.join(import.meta.dirname, 'public')));

// npm install redis

/**
 * Redis Initialization
 */

async function initializeRedis() {
  try {
    // connect to Redis

    await db.connect();

    // populate search

    await db.sAdd('ferret', 'tobi');
    await db.sAdd('ferret', 'loki');
    await db.sAdd('ferret', 'jane');
    await db.sAdd('cat', 'manny');
    await db.sAdd('cat', 'luna');
  } catch (err) {
    console.error('Error initializing Redis:', err);
    process.exit(1);
  }
}

/**
 * GET search for :query.
 */

app.get('/search/{:query}', (req, res, next) => {
  const query = req.params.query || '';
  db.sMembers(query)
    .then((vals) => res.send(vals))
    .catch((err) => {
      console.error(`Redis error for query "${query}":`, err);
      next(err);
    });
});

/**
 * GET client javascript. Here we use sendFile()
 * because serving import.meta.dirname with the static() middleware
 * would also mean serving our server "index.js" and the "search.jade"
 * template.
 */

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, 'client.js'));
});

/**
 * Start the Server
 */

(async () => {
  await initializeRedis();
  if (isMain) {
    app.listen(3000);
    console.log('Express started on port 3000');
  }
})();
