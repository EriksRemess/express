'use strict'

/**
 * Module dependencies.
 */

import db from "#examples/mvc/db";

export const engine = 'hbs';

export function before(req, res, next) {
  const id = req.params.user_id;
  if (!id) return next();
  // pretend to query a database...
  process.nextTick(() => {
    req.user = db.users[id];
    // cant find that user
    if (!req.user) return next('route');
    // found it, move on to the routes
    next();
  });
}

export function list(req, res, next) {
  res.render('list', { users: db.users });
}

export function edit(req, res, next) {
  res.render('edit', { user: req.user });
}

export function show(req, res, next) {
  res.render('show', { user: req.user });
}

export function update(req, res, next) {
  const body = req.body;
  req.user.name = body.user.name;
  res.message('Information updated!');
  res.redirect('/user/' + req.user.id);
}
