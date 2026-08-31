var Router = (function () {
  var routes = {};
  function register(action, options, handler) { routes[action] = { options: options || {}, handler: handler }; }
  function dispatch(request, event, context) {
    var route = routes[request.action]; if (!route) throw ApiError.notFound('Acción');
    var ctx = context;
    if (route.options.auth) {
      var orgId = Validation.id(request.organizationId, 'organizationId'); ctx.auth = AuthService.context(event, orgId, request.auth || {});
      if (route.options.permission) AuthService.requirePermission(ctx.auth, route.options.permission);
    } else if (route.options.identity) {
      // Identity-only auth: verify the Google token but do NOT require org membership.
      // Used for first-time bootstrap where the user has no org yet.
      ctx.identity = AuthService.verifyIdentity(request.auth || {});
    }
    var result = route.handler(request.payload || {}, ctx);
    if (route.options.audit && ctx.auth) AuditService.record({ organizationId: ctx.auth.organizationId, actorId: ctx.auth.user.id, actorType: 'USER', action: request.action, requestId: ctx.requestId });
    return result;
  }
  return { register: register, dispatch: dispatch };
})();

Router.register('requests.createPublic', {}, function (payload, ctx) { return PublicRequests.create(payload, ctx); });
Router.register('system.health', { auth: true, permission: 'config.manage' }, function () { return HealthService.check(); });
Router.register('system.migrate', { auth: true, permission: 'config.manage', audit: true }, function () { return Schema.migrate(); });
Router.register('emails.enqueue', { auth: true, permission: 'notification.manage', audit: true }, function (payload, ctx) { payload.organizationId = ctx.auth.organizationId; return EmailQueue.enqueue(payload); });
Router.register('emails.process', { auth: true, permission: 'notification.manage', audit: true }, function () { return EmailQueue.processBatch(); });
// Bootstrap and discovery routes. `identity` (not `auth`) means we verify the
// Google token but skip the org membership check, so the very first user of a
// new organization can create the org.
Router.register('bootstrap.organization', { identity: true, audit: true }, function (payload, ctx) { return Bootstrap.organization(payload, ctx); });
Router.register('org.listMine', { identity: true }, function (payload, ctx) { return Bootstrap.listMine(payload, ctx); });
// Catalog read endpoints (org, sites, users, roles). Auth required; permission
// gate is intentionally lax in this PR (just auth.member) — fine-grained
// permission routing lands once write endpoints exist.
Router.register('catalog.organization', { auth: true }, function (payload, ctx) { return Catalog.organization(payload, ctx); });
Router.register('catalog.listOrganizations', { auth: true }, function (payload, ctx) { return Catalog.listOrganizations(payload, ctx); });
Router.register('catalog.listSites', { auth: true }, function (payload, ctx) { return Catalog.listSites(payload, ctx); });
Router.register('catalog.listUsers', { auth: true }, function (payload, ctx) { return Catalog.listUsers(payload, ctx); });
Router.register('catalog.listRoles', { auth: true }, function (payload, ctx) { return Catalog.listRoles(payload, ctx); });
// PR 1A — Requests: list/get require `request.review`; approve/reject
// require the matching scope permission (`request.approve.area` / `.general`).
// All write paths check `expectedVersion` for optimistic concurrency.
Router.register('requests.list', { auth: true, permission: 'request.review' }, function (payload, ctx) { return Requests.list(payload, ctx); });
Router.register('requests.get', { auth: true, permission: 'request.review' }, function (payload, ctx) { return Requests.get(payload, ctx); });
Router.register('requests.approve', { auth: true, audit: true }, function (payload, ctx) { return Requests.approve(payload, ctx); });
Router.register('requests.reject', { auth: true, audit: true }, function (payload, ctx) { return Requests.reject(payload, ctx); });
// PR 1B — Recursos / Espacios (read endpoints). All require auth and scope
// to the caller's organization; write paths land in a follow-up PR.
Router.register('resources.list', { auth: true }, function (payload, ctx) { return Resources.list(payload, ctx); });
Router.register('resources.get', { auth: true }, function (payload, ctx) { return Resources.get(payload, ctx); });
Router.register('resources.listLocations', { auth: true }, function (payload, ctx) { return Resources.listLocations(payload, ctx); });
Router.register('resources.getLocation', { auth: true }, function (payload, ctx) { return Resources.getLocation(payload, ctx); });
Router.register('resources.listReservations', { auth: true }, function (payload, ctx) { return Resources.listReservations(payload, ctx); });
Router.register('resources.listMovements', { auth: true }, function (payload, ctx) { return Resources.listMovements(payload, ctx); });
Router.register('resources.checkAvailability', { auth: true }, function (payload, ctx) { return Resources.checkAvailability(payload, ctx); });
// PR 1C — Eventos (read endpoints). Auth required; reads are scoped to the
// caller's organization in Events.gs. Write endpoints land in a follow-up PR.
Router.register('events.list', { auth: true }, function (payload, ctx) { return Events.list(payload, ctx); });
Router.register('events.get', { auth: true }, function (payload, ctx) { return Events.get(payload, ctx); });
Router.register('events.upcoming', { auth: true }, function (payload, ctx) { return Events.upcoming(payload, ctx); });
