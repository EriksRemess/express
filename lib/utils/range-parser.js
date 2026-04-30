/*!
 * express
 * MIT Licensed
 */

import { getOwnOption } from './options.js';

/**
 * Parse a Range header `str` relative to the given resource `size`.
 *
 * Returns:
 * - `undefined` when no header is provided (handled by caller),
 * - `-2` when syntactically invalid,
 * - `-1` when unsatisfiable,
 * - array of ranges with `.type` property otherwise.
 *
 * @param {number} size
 * @param {string} str
 * @param {object} [options]
 * @param {boolean} [options.combine=false]
 * @returns {number|Array}
 */
export default function parseRange(size, str, options) {
  if (typeof str !== 'string') {
    throw new TypeError('argument str must be a string');
  }

  const index = str.indexOf('=');
  if (index === -1) {
    return -2;
  }

  const parts = str.slice(index + 1).split(',');
  const ranges = [];
  ranges.type = str.slice(0, index);

  for (let i = 0; i < parts.length; i++) {
    const range = parts[i].split('-');
    let start = Number.parseInt(range[0], 10);
    let end = Number.parseInt(range[1], 10);

    // -nnn
    if (Number.isNaN(start)) {
      start = size - end;
      end = size - 1;
    // nnn-
    } else if (Number.isNaN(end)) {
      end = size - 1;
    }

    // limit last-byte-pos to current length
    if (end > size - 1) {
      end = size - 1;
    }

    // invalid or unsatisfiable
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
      continue;
    }

    ranges.push({ start, end });
  }

  if (ranges.length < 1) {
    return -1;
  }

  return getOwnOption(options, 'combine')
    ? combineRanges(ranges)
    : ranges;
}

/**
 * Combine overlapping and adjacent ranges.
 *
 * @param {Array<{start:number,end:number}>} ranges
 * @returns {Array<{start:number,end:number}>}
 */
function combineRanges(ranges) {
  const ordered = ranges.map(mapWithIndex).sort(sortByRangeStart);
  let j = 0;

  for (let i = 1; i < ordered.length; i++) {
    const range = ordered[i];
    const current = ordered[j];

    if (range.start > current.end + 1) {
      ordered[++j] = range;
    } else if (range.end > current.end) {
      current.end = range.end;
      current.index = Math.min(current.index, range.index);
    }
  }

  ordered.length = j + 1;

  const combined = ordered.sort(sortByRangeIndex).map(mapWithoutIndex);
  combined.type = ranges.type;
  return combined;
}

function mapWithIndex(range, index) {
  return {
    start: range.start,
    end: range.end,
    index,
  };
}

function mapWithoutIndex(range) {
  return {
    start: range.start,
    end: range.end,
  };
}

function sortByRangeIndex(a, b) {
  return a.index - b.index;
}

function sortByRangeStart(a, b) {
  return a.start - b.start;
}
