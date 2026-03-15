'use strict'

/**
 * Module dependencies.
 */

import express from "#express";
import { Buffer } from 'node:buffer';
import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import session from 'express-session';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const app = express();
const pbkdf2 = promisify(pbkdf2Callback);
const HASH_ITERATIONS = 310000;
const HASH_KEYLEN = 32;
const HASH_DIGEST = 'sha256';

export default app;

// config

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(express.urlencoded())
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use((req, res, next) => {
  const err = req.session.error;
  const msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

// placeholder database

const users = {
  tj: { name: 'tj' }
};

const hashPassword = async (password, salt = randomBytes(16).toString('hex')) => {
  const derived = await pbkdf2(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST);
  return { hash: derived.toString('hex'), salt };
};

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)
const initUsers = (async () => {
  const { hash, salt } = await hashPassword('foobar');
  // store the salt & hash in the "db"
  users.tj.salt = salt;
  users.tj.hash = hash;
})();


// Authenticate using our plain-object database of doom!

async function authenticate(name, pass) {
  await initUsers;
  if (isMain) console.log('authenticating %s:%s', name, pass);
  const user = users[name];
  // query the db for the given username
  if (!user) return null;
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  const { hash } = await hashPassword(pass, user.salt);
  const actual = Buffer.from(hash, 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
    return user;
  }

  return null;
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/restricted', restrict, (req, res) => {
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get('/logout', (req, res) => {
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res, next) => {
  if (!req.body) return res.sendStatus(400);

  try {
    const user = await authenticate(req.body.username, req.body.password);
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => (err ? reject(err) : resolve()));
      });

      // Store the user's primary key
      // in the session store to be retrieved,
      // or in this case the entire user object
      req.session.user = user;
      req.session.success = 'Authenticated as ' + user.name
        + ' click to <a href="/logout">logout</a>. '
        + ' You may now access <a href="/restricted">/restricted</a>.';
      return res.redirect(req.get('Referrer') || '/');
    }

    req.session.error = 'Authentication failed, please check your '
      + ' username and password.'
      + ' (use "tj" and "foobar")';
    return res.redirect('/login');
  } catch (err) {
    return next(err);
  }
});

/* istanbul ignore next */
if (isMain) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
