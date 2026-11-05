# Acceptance-test examples

These small applications are maintained as fixtures for the
[acceptance tests](../test/acceptance). Keep examples that exercise application
integration behavior, together with their views and assets.

Run the acceptance tests from the repository root after `npm install`, using
Node.js 26 or newer:

```sh
node --import ./test/support/env.js --test --test-concurrency=1 test/acceptance/*.js
```

`npm test` runs these alongside the framework tests. The acceptance tests require
no external services; the custom-view test replaces its GitHub request with a
local response.

For manual debugging, run an example and visit http://localhost:3000:

```sh
node examples/content-negotiation
```

The `#express`, `#lib/*`, and `#examples/*` imports use this repository's package
aliases, so run the examples from this checkout.

| Example | Behavior exercised | Acceptance test |
| --- | --- | --- |
| [auth](./auth) | Login, logout, sessions, and restricted routes | [auth.js](../test/acceptance/auth.js) |
| [content-negotiation](./content-negotiation) | HTML, text, and JSON response negotiation | [content-negotiation.js](../test/acceptance/content-negotiation.js) |
| [cookie-sessions](./cookie-sessions) | Cookie-backed session state | [cookie-sessions.js](../test/acceptance/cookie-sessions.js) |
| [cookies](./cookies) | Reading, setting, and clearing cookies | [cookies.js](../test/acceptance/cookies.js) |
| [downloads](./downloads) | File downloads, missing files, and path traversal rejection | [downloads.js](../test/acceptance/downloads.js) |
| [ejs](./ejs) | Template-engine registration and rendering | [ejs.js](../test/acceptance/ejs.js) |
| [error-pages](./error-pages) | Custom error pages and response formats | [error-pages.js](../test/acceptance/error-pages.js) |
| [error](./error) | Thrown errors and asynchronous `next(err)` | [error.js](../test/acceptance/error.js) |
| [hello-world](./hello-world) | Basic request and response handling | [hello-world.js](../test/acceptance/hello-world.js) |
| [markdown](./markdown) | Custom template engine and missing views | [markdown.js](../test/acceptance/markdown.js) |
| [multi-router](./multi-router) | Mounted routers and route prefixes | [multi-router.js](../test/acceptance/multi-router.js) |
| [mvc](./mvc) | Mounted applications, controllers, forms, and views | [mvc.js](../test/acceptance/mvc.js) |
| [params](./params) | Parameter loading, conversion, and errors | [params.js](../test/acceptance/params.js) |
| [resource](./resource) | Resource routes, ranges, and HTTP methods | [resource.js](../test/acceptance/resource.js) |
| [route-map](./route-map) | Nested route registration | [route-map.js](../test/acceptance/route-map.js) |
| [route-separation](./route-separation) | Separate controllers, form updates, and method overrides | [route-separation.js](../test/acceptance/route-separation.js) |
| [vhost](./vhost) | Host-based application dispatch and redirects | [vhost.js](../test/acceptance/vhost.js) |
| [view-constructor](./view-constructor) | Custom view construction and rendering | [view-constructor.js](../test/acceptance/view-constructor.js) |
| [view-locals](./view-locals) | Rendering with route, request, and response locals | [view-locals.js](../test/acceptance/view-locals.js) |
| [web-service](./web-service) | API middleware, JSON responses, and errors | [web-service.js](../test/acceptance/web-service.js) |
