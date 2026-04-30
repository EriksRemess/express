/*!
 * express
 * MIT Licensed
 */

import { STATUS_CODES } from 'node:http';
import { getOwnOption, hasOwnOption } from '#lib/utils/options';

/**
 * Base class used to tag errors created through createError().
 */
export class HttpError extends Error {}

/**
 * Determine whether a value looks like an HTTP error instance.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHttpError(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof HttpError) {
    return true;
  }

  return value instanceof Error
    && hasOwnOption(value, 'status')
    && hasOwnOption(value, 'statusCode')
    && hasOwnOption(value, 'expose')
    && typeof getOwnOption(value, 'status') === 'number'
    && typeof getOwnOption(value, 'statusCode') === 'number'
    && getOwnOption(value, 'status') === getOwnOption(value, 'statusCode')
    && typeof getOwnOption(value, 'expose') === 'boolean';
}

function getStatusCodeClass(status) {
  return Number(String(status).charAt(0) + '00');
}

function normalizeStatus(status) {
  if (typeof status !== 'number' || Number.isNaN(status)) {
    return 500;
  }

  if (STATUS_CODES[status]) {
    return status;
  }

  const statusClass = getStatusCodeClass(status);
  if (statusClass !== 400 && statusClass !== 500) {
    return 500;
  }

  return status;
}

/**
 * Create or decorate an Error with HTTP status metadata.
 *
 * @param {...(number|string|Error|object)} args
 * @returns {HttpError}
 */
export default function createError(...args) {
  let err;
  let msg;
  let status = 500;
  let props = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const type = typeof arg;

    if (arg instanceof Error) {
      err = arg;
      status = getOwnOption(err, 'status') ?? getOwnOption(err, 'statusCode') ?? status;
      continue;
    }

    if (type === 'number' && i === 0) {
      status = arg;
      continue;
    }

    if (type === 'string') {
      msg = arg;
      continue;
    }

    if (type === 'object' && arg !== null) {
      props = arg;
      continue;
    }

    throw new TypeError(`argument #${i + 1} unsupported type ${type}`);
  }

  status = normalizeStatus(status);

  if (!err) {
    err = new Error(msg ?? STATUS_CODES[status] ?? 'Error');
    Error.captureStackTrace(err, createError);
  }

  err.status = status;
  err.statusCode = status;
  err.expose = status < 500;

  if (!(err instanceof HttpError)) {
    Object.setPrototypeOf(err, HttpError.prototype);
  }

  for (const key of Object.keys(props)) {
    if (key !== 'status' && key !== 'statusCode') {
      err[key] = props[key];
    }
  }

  return err;
}
