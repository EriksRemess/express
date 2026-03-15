'use strict'

/**
 * Module dependencies.
 */

import db from "#examples/mvc/db";

export const name = 'pet';
export const prefix = '/user/:user_id';

export function create(req, res, next) {
  const id = req.params.user_id;
  const user = db.users[id];
  const body = req.body;
  if (!user) return next('route');
  const pet = { name: body.pet.name };
  pet.id = db.pets.push(pet) - 1;
  user.pets.push(pet);
  res.message('Added pet ' + body.pet.name);
  res.redirect('/user/' + id);
}
