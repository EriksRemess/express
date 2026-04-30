"use strict";

export async function withObjectPrototypeProperties(properties, callback) {
  const previous = new Map();

  for (const name of Object.keys(properties)) {
    previous.set(name, Object.getOwnPropertyDescriptor(Object.prototype, name));
    Object.defineProperty(Object.prototype, name, {
      configurable: true,
      value: properties[name],
      writable: true,
    });
  }

  try {
    return await callback();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) {
        Object.defineProperty(Object.prototype, name, descriptor);
      } else {
        delete Object.prototype[name];
      }
    }
  }
}
