'use strict'

/**
 * Module dependencies.
 */

import db from "#examples/mvc/db";

export const engine = 'ejs';

export function before(req, res, next) {
  const pet = db.pets[req.params.pet_id];
  if (!pet) return next('route');
  req.pet = pet;
  next();
}

export function show(req, res, next) {
  res.render('show', { pet: req.pet });
}

export function edit(req, res, next) {
  res.render('edit', { pet: req.pet });
}

export function update(req, res, next) {
  const body = req.body;
  req.pet.name = body.pet.name;
  res.message('Information updated!');
  res.redirect('/pet/' + req.pet.id);
}
