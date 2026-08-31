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
