'use strict'

import express from "#express";
import apiv1 from "#examples/multi-router/controllers/api_v1";
import apiv2 from "#examples/multi-router/controllers/api_v2";
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const app = express();

export default app;

app.use('/api/v1', apiv1);
app.use('/api/v2', apiv2);

app.get('/', (req, res) => {
  res.send('Hello from root route.')
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
