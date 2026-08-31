/**
 * Minimal node-based smoke test for `Operations.applyReturnCondition_` so
 * the Apps Script port and the TypeScript implementation stay in sync.
 *
 * Run from the repo root: `node apps-script/tests/operations.test.cjs`
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ApiException extends Error { constructor(code, message) { super(message); this.code = code; } }
const sandbox = {
  ApiError: {
    badRequest: (code, message) => new ApiException(code, message),
    forbidden: () => new ApiException('FORBIDDEN', 'forbidden'),
    notFound: () => new ApiException('NOT_FOUND', 'not found'),
    conflict: (code, message) => new ApiException(code, message),
    internal: (code, message) => new ApiException(code, message),
  },
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'Operations.gs'), 'utf8');
vm.runInContext(src, sandbox);
const O = sandbox.Operations;

const cases = [
  {
    condition: 'OK',
    expected: { newStatus: 'AVAILABLE', movementType: 'RETURN', autoCreateMaintenance: false, permanentlyLost: false },
  },
  {
    condition: 'DAMAGED',
    expected: { newStatus: 'BROKEN', movementType: 'RETURN', autoCreateMaintenance: true, permanentlyLost: false },
  },
  {
    condition: 'LOST',
    expected: { newStatus: 'MISSING', movementType: 'ADJUST', autoCreateMaintenance: false, permanentlyLost: true },
  },
];

for (const c of cases) {
  const result = O.applyReturnCondition_({
    currentStatus: 'IN_USE',
    inventoryType: 'SERIALIZED',
    condition: c.condition,
  });
  assert.equal(result.newStatus, c.expected.newStatus, `${c.condition} newStatus`);
  assert.equal(result.movementType, c.expected.movementType, `${c.condition} movementType`);
  assert.equal(result.autoCreateMaintenance, c.expected.autoCreateMaintenance, `${c.condition} autoCreateMaintenance`);
  assert.equal(result.permanentlyLost, c.expected.permanentlyLost, `${c.condition} permanentlyLost`);
  if (c.condition === 'DAMAGED') {
    assert.equal(result.autoMaintenanceKind, 'CORRECTIVE', 'DAMAGED autoMaintenanceKind');
    assert.equal(result.autoMaintenanceSeverity, 'MEDIUM', 'DAMAGED autoMaintenanceSeverity');
  }
}

console.log('operations.test.cjs: OK');
