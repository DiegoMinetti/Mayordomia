const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class ApiException extends Error { constructor(code, message) { super(message); this.code = code; } }
const sandbox = { ApiError: { badRequest(code, message) { return new ApiException(code, message); } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '..', 'Validation.gs'), 'utf8'), sandbox);
const V = sandbox.Validation;

assert.equal(V.email(' PERSON@EXAMPLE.COM ', 'email'), 'person@example.com');
assert.equal(V.safeText(' <b>hola</b> ', 'text', 30), 'bhola/b');
assert.throws(() => V.id('../bad', 'id'), /inválido/);
assert.throws(() => V.publicRequest({ website: 'bot' }), /Solicitud inválida/);
assert.equal(V.publicRequest({ publicToken: 'abcdef12', type: 'SUPPORT', requesterName: 'Ana', description: 'Ayuda' }).type, 'SUPPORT');
console.log('validation.test.js: OK');
