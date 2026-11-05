'use strict'

import express from "#express";

const isMain = import.meta.main;

const app = express();

export default app;

app.get('/', (req, res) => {
  res.send('Hello World');
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
