'use strict'

// faux model

export default class User {
  constructor(name, age, species) {
    this.name = name;
    this.age = age;
    this.species = species;
  }
}

User.all = fn => {
  // process.nextTick makes sure this function API
  // behaves in an asynchronous manner, like if it
  // was a real DB query to read all users.
  process.nextTick(() => {
    fn(null, users);
  });
};

User.count = fn => {
  process.nextTick(() => {
    fn(null, users.length);
  });
};

// faux database

const users = [];

users.push(new User('Tobi', 2, 'ferret'));
users.push(new User('Loki', 1, 'ferret'));
users.push(new User('Jane', 6, 'ferret'));
users.push(new User('Luna', 1, 'cat'));
users.push(new User('Manny', 1, 'cat'));
