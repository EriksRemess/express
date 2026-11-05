'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

const isMain = import.meta.main;

const app = express();

export default app;

// Ad-hoc example resource method

app.resource = function(path, obj) {
  this.get(path, obj.index);
  this.get(path + '/:a..:b{.:format}', (req, res) => {
    const a = parseIndex(req.params.a);
    const b = parseIndex(req.params.b);
    if (a === undefined || b === undefined || a > b) {
      return res.status(400).send('Invalid range');
    }
    const format = req.params.format;
    obj.range(req, res, a, b, format);
  });
  this.get(path + '/:id', obj.show);
  this.delete(path + '/:id', (req, res) => {
    const id = parseIndex(req.params.id);
    if (id === undefined) return res.status(400).send('Invalid user ID');
    obj.destroy(req, res, id);
  });
};

function parseIndex(value) {
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && String(index) === value
    ? index : undefined;
}

// Fake records

const users = [
  { name: 'tj' }
  , { name: 'ciaran' }
  , { name: 'aaron' }
  , { name: 'guillermo' }
  , { name: 'simon' }
  , { name: 'tobi' }
];

// Fake controller.

const User = {
  index: (req, res) =>{
    res.send(users);
  },
  show: (req, res) =>{
    const user = users.find((user, index) => String(index) === req.params.id);
    res.send(user || { error: 'Cannot find user' });
  },
  destroy: (req, res, id) =>{
    const destroyed = id in users;
    delete users[id];
    res.send(destroyed ? 'destroyed' : 'Cannot find user');
  },
  range: (req, res, a, b, format) =>{
    const range = users.slice(a, b + 1);
    switch (format) {
      case 'json':
        res.send(range);
        break;
      case 'html':
      default:
        const html = '<ul>' + range.map(user => {
          return '<li>' + user.name + '</li>';
        }).join('\n') + '</ul>';
        res.send(html);
        break;
    }
  }
};

// curl http://localhost:3000/users     -- responds with all users
// curl http://localhost:3000/users/1   -- responds with user 1
// curl http://localhost:3000/users/9   -- responds with error
// curl http://localhost:3000/users/1..3 -- responds with several users
// curl -X DELETE http://localhost:3000/users/1  -- deletes the user

app.resource('/users', User);

app.get('/', (req, res) => {
  res.send([
    '<h1>Examples:</h1> <ul>'
    , '<li>GET /users</li>'
    , '<li>GET /users/1</li>'
    , '<li>GET /users/3</li>'
    , '<li>GET /users/1..3</li>'
    , '<li>GET /users/1..3.json</li>'
    , '<li>DELETE /users/4</li>'
    , '</ul>'
  ].join('\n'));
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
