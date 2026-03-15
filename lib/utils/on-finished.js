/*!
 * express
 * MIT Licensed
 */

import { AsyncResource } from 'node:async_hooks';

const kOnFinished = Symbol('onFinishedListener');

function defer(fn, ...args) {
  setImmediate(fn, ...args);
}

function wrap(fn) {
  const resource = new AsyncResource(fn.name || 'bound-anonymous-fn');
  return (...args) => {
    resource.runInAsyncScope(fn, null, ...args);
  };
}

/**
 * Check whether a request or response message has already finished.
 *
 * @param {object} msg
 * @returns {boolean|undefined}
 */
export function isFinished(msg) {
  const socket = msg.socket;

  if (typeof msg.finished === 'boolean') {
    return Boolean(msg.finished || (socket && !socket.writable));
  }

  if (typeof msg.complete === 'boolean') {
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable));
  }

  return undefined;
}

function createListener(msg) {
  function listener(err) {
    if (msg[kOnFinished] === listener) {
      msg[kOnFinished] = null;
    }

    if (!listener.queue) {
      return;
    }

    const queue = listener.queue;
    listener.queue = null;

    for (let i = 0; i < queue.length; i++) {
      queue[i](err, msg);
    }
  }

  listener.queue = [];
  return listener;
}

function attachFinishedListener(msg, callback) {
  let done = false;
  let removeMsgListeners = null;
  let removeSocketListeners = null;

  const cleanup = () => {
    if (removeMsgListeners) {
      removeMsgListeners();
      removeMsgListeners = null;
    }

    if (removeSocketListeners) {
      removeSocketListeners();
      removeSocketListeners = null;
    }
  };

  const onFinish = (err) => {
    if (done) {
      return;
    }

    done = true;
    cleanup();
    callback(err);
  };

  const onSocket = (socket) => {
    msg.off('socket', onSocket);

    if (done || removeSocketListeners) {
      return;
    }

    const onSocketError = (err) => {
      onFinish(err);
    };

    const onSocketClose = () => {
      onFinish();
    };

    socket.once('error', onSocketError);
    socket.once('close', onSocketClose);

    removeSocketListeners = () => {
      socket.off('error', onSocketError);
      socket.off('close', onSocketClose);
    };
  };

  const onMsgFinish = () => {
    onFinish();
  };

  const onMsgEnd = () => {
    onFinish();
  };

  msg.once('finish', onMsgFinish);
  msg.once('end', onMsgEnd);
  msg.on('socket', onSocket);

  removeMsgListeners = () => {
    msg.off('finish', onMsgFinish);
    msg.off('end', onMsgEnd);
    msg.off('socket', onSocket);
  };

  if (msg.socket) {
    onSocket(msg.socket);
  }

  if (isFinished(msg) !== false) {
    defer(onFinish);
  }
}

function attachListener(msg, listener) {
  let attached = msg[kOnFinished];

  if (!attached || !attached.queue) {
    attached = createListener(msg);
    msg[kOnFinished] = attached;
    attachFinishedListener(msg, attached);
  }

  attached.queue.push(listener);
}

/**
 * Register a listener to run when a request or response is finished.
 *
 * @param {object} msg
 * @param {Function} listener
 * @returns {object}
 */
export default function onFinished(msg, listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('listener must be a function');
  }

  if (isFinished(msg) !== false) {
    defer(listener, null, msg);
    return msg;
  }

  attachListener(msg, wrap(listener));
  return msg;
}
