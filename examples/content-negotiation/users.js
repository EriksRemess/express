'use strict'

import users from "#examples/content-negotiation/db";

export const html = (req, res) => {
  res.send(`<ul>${users.map(user => `<li>${user.name}</li>`).join('')}</ul>`);
};

export const text = (req, res) => {
  res.send(users.map(user => ` - ${user.name}\n`).join(''));
};

export const json = (req, res) => {
  res.json(users);
};
