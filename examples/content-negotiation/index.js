'use strict'

import express from "#express";
import users from "#examples/content-negotiation/db";
import { html, text, json } from "#examples/content-negotiation/users";
import { pathToFileURL } from 'node:url';

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
const app = express();

export default app;

// so either you can deal with different types of formatting
// for expected response in index.js
app.get('/', (req, res) => {
  res.format({
    html: () => {
      res.send(`<ul>${users.map(user => `<li>${user.name}</li>`).join('')}</ul>`);
    },
    text: () => {
      res.send(users.map(user => ` - ${user.name}\n`).join(''));
    },
    json: () => {
      res.json(users);
    },
  });
});

// or you could write a tiny middleware like
// this to add a layer of abstraction
// and make things a bit more declarative:

app.get('/users', (req, res) => {
  res.format({ html, text, json });
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
