'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

import path from 'node:path';
const app = express();
import logger from 'morgan';
import cookieParser from '#lib/utils/cookies';
import methodOverride from '#lib/utils/method-override';
import { index } from "#examples/route-separation/site";
import { listPosts } from "#examples/route-separation/post";
import { listUsers, load, view, edit, update } from "#examples/route-separation/user";
import { pathToFileURL } from 'node:url';

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
export default app;

// Config

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));

/* istanbul ignore next */
if (isMain) {
  app.use(logger('dev'));
}

app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(import.meta.dirname, 'public')));

// General

app.get('/', index);

// User

app.get('/users', listUsers);
app.all('/user/:id{/:op}', load);
app.get('/user/:id', view);
app.get('/user/:id/view', view);
app.get('/user/:id/edit', edit);
app.put('/user/:id/edit', update);

// Posts

app.get('/posts', listPosts);

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
