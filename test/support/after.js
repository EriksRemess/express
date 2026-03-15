/**
 * Minimal replacement for the "after" package used in tests.
 *
 * Calls `done` once after `count` successful invocations, or immediately on the first error.
 */
export default function after(count, done) {
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError('after count must be a positive integer');
  }

  let pending = count;
  let finished = false;

  return (err) => {
    if (finished) {
      return;
    }

    if (err) {
      finished = true;
      done(err);
      return;
    }

    pending -= 1;
    if (pending === 0) {
      finished = true;
      done(null);
    }
  };
}
