/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

import { EventEmitter } from "node:events";
import bodyParser from "#lib/body-parser/index";
import Router from "#lib/router/index";
import mixin from "#lib/utils/merge-descriptors";
import serveStatic from "#lib/serve-static";
import application from "#lib/application";
import request from "#lib/request";
import response from "#lib/response";

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */

const createApplication = () => {
  const app = (req, res, next) => {
    app.handle(req, res, next);
  };

  mixin(app, EventEmitter.prototype, false)
  mixin(app, application, false)

  // expose the prototype that will get set on requests
  app.request = Object.create(request, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  // expose the prototype that will get set on responses
  app.response = Object.create(response, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  app.init()
  return app
}

createApplication.application = application
createApplication.request = request
createApplication.response = response
createApplication.Route = Router.Route
createApplication.Router = Router
createApplication.json = bodyParser.json
createApplication.raw = bodyParser.raw
createApplication.static = serveStatic
createApplication.text = bodyParser.text
createApplication.urlencoded = bodyParser.urlencoded

export default createApplication;
