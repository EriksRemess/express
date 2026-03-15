'use strict'

// Fake user database

const users = [
  { name: 'TJ', email: 'tj@vision-media.ca' },
  { name: 'Tobi', email: 'tobi@vision-media.ca' }
];

export const listUsers = (req, res) => {
  res.render('users', { title: 'Users', users: users });
};

export const load = (req, res, next) => {
  const id = req.params.id;
  req.user = users[id];
  if (req.user) {
    next();
  } else {
    const err = new Error('cannot find user ' + id);
    err.status = 404;
    next(err);
  }
};

export const view = (req, res) => {
  res.render('users/view', {
    title: 'Viewing user ' + req.user.name,
    user: req.user
  });
};

export const edit = (req, res) => {
  res.render('users/edit', {
    title: 'Editing user ' + req.user.name,
    user: req.user
  });
};

export const update = (req, res) => {
  // Normally you would handle all kinds of
  // validation and save back to the db
  const user = req.body.user;
  req.user.name = user.name;
  req.user.email = user.email;
  res.redirect(req.get('Referrer') || '/');
};
