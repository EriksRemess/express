/*!
 * express
 * MIT Licensed
 */

import { STATUS_CODES } from 'node:http';

export class HttpError extends Error {}

export function isHttpError(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof HttpError) {
    return true;
  }

  return value instanceof Error
    && typeof value.status === 'number'
    && typeof value.statusCode === 'number'
    && value.status === value.statusCode
    && typeof value.expose === 'boolean';
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
      status = err.status ?? err.statusCode ?? status;
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

  for (const key in props) {
    if (key !== 'status' && key !== 'statusCode') {
      err[key] = props[key];
    }
  }

  return err;
}
