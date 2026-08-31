// Lightweight smoke test for the Apps Script Notifications module.
// Verifies the module loads, exposes the expected surface, and rejects
// invalid kinds without needing a full SpreadsheetApp environment.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ApiException extends Error { constructor(code, message) { super(message); this.code = code; this.message = message; } }
const apiError = {
  badRequest(code, message) { return new ApiException(code, message); },
  notFound(entity) { return new ApiException('NOT_FOUND', entity + ' no encontrado'); },
  internal(code, message) { return new ApiException(code, message); },
};

const sandbox = {
  ApiError: apiError,
  console,
  // SheetsRepository / Validation / Utilities are stubbed so we can exercise
  // just the public surface that doesn't need a Spreadsheet backend.
  Validation: {
    object: () => ({}),
    string: (v) => String(v || ''),
    id: (v) => String(v || ''),
    enumValue: (v, label, allowed) => {
      if (!allowed.includes(v)) throw apiError.badRequest('VALIDATION_ERROR', label + ' inválido');
      return v;
    },
    safeText: (v) => String(v || ''),
    email: (v) => String(v || '').toLowerCase(),
  },
  SheetsRepository: {
    rows: () => [],
    findOne: () => null,
    append: () => undefined,
    db: () => ({ getSheetByName: () => null }),
  },
  Utilities: { getUuid: () => 'uuid-test' },
};
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'Notifications.gs'), 'utf8'),
  sandbox,
);
const N = sandbox.Notifications;

assert.equal(typeof N.listMine, 'function', 'listMine exported');
assert.equal(typeof N.markRead, 'function', 'markRead exported');
assert.equal(typeof N.markAllRead, 'function', 'markAllRead exported');
assert.equal(typeof N.unreadCount, 'function', 'unreadCount exported');
assert.equal(typeof N.publish, 'function', 'publish exported');

// publish should validate the kind and reject unknown values.
assert.throws(
  () => N.publish({ kind: 'NOPE', title: 'x' }, { auth: { organizationId: 'o1', user: { id: 'u1' }, permissions: ['notification.manage'] } }),
  /inválido/,
);

// publish should accept a known kind and return an id.
const out = N.publish(
  {
    kind: 'REQUEST_APPROVED',
    title: 'Solicitud aprobada',
    body: 'OK',
    link: '/requests/r1',
    entityType: 'Request',
    entityId: 'r1',
  },
  { auth: { organizationId: 'o1', user: { id: 'u1' }, permissions: ['notification.manage'] } },
);
assert.equal(out.id, 'uuid-test');

console.log('notifications.test.cjs: OK');
