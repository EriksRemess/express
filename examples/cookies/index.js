'use strict'

/**
 * Module dependencies.
 */

import express from "#express";

const app = express();

export default app;
import logger from 'morgan';
import cookieParser from '#lib/utils/cookies';
import { pathToFileURL } from "node:url";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

// custom log format
if (process.env.NODE_ENV !== 'test') app.use(logger(':method :url'))

// parses request cookies, populating
// req.cookies and req.signedCookies
// when the secret is passed, used
// for signing the cookies.
app.use(cookieParser('my secret here'));

// parses x-www-form-urlencoded
app.use(express.urlencoded())

app.get('/', (req, res) => {
  if (req.cookies.remember) {
    res.send('Remembered :). Click to <a href="/forget">forget</a>!.');
  } else {
    res.send('<form method="post"><p>Check to <label>'
      + '<input type="checkbox" name="remember"/> remember me</label> '
      + '<input type="submit" value="Submit"/>.</p></form>');
  }
});

app.get('/forget', (req, res) => {
  res.clearCookie('remember');
  res.redirect(req.get('Referrer') || '/');
});

app.post('/', (req, res) => {
  const minute = 60000;

  if (req.body && req.body.remember) {
    res.cookie('remember', 1, { maxAge: minute })
  }

  res.redirect(req.get('Referrer') || '/');
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
