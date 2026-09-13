import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('googleapis', () => {
  const tokeninfo = vi.fn().mockResolvedValue({
    data: { email: 'a@b.com', email_verified: 'true' },
  });
  const userinfoGet = vi.fn().mockResolvedValue({
    data: { email: 'a@b.com', name: 'Alice', picture: '', sub: 'sub-1' },
  });
  const oauth2 = vi.fn(() => ({ tokeninfo, userinfo: { get: userinfoGet } }));
  return { google: { oauth2 } };
});

import { register, dispatch, _reset, _routeCount } from '../src/router/index.js';
import type { Repository } from '../src/repository/index.js';
import { makeAuditService } from '../src/audit/service.js';
import { ApiException } from '../src/errors.js';

function fakeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    raw: {} as never,
    spreadsheetId: 'ss-1',
    rows: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    append: vi.fn().mockResolvedValue(undefined),
    updateWhere: vi.fn().mockResolvedValue(false),
    close: vi.fn(),
    ...overrides,
  };
}

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
  level: 'info',
} as never;

describe('router', () => {
  beforeEach(() => _reset());

  it('rejects unknown actions with NOT_FOUND', async () => {
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    await expect(dispatch({ action: 'nope' }, { repo, audit })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects requests without a valid envelope', async () => {
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    await expect(dispatch(null as never, { repo, audit })).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
  });

  it('runs handlers without auth when no options', async () => {
    register('ping.pong', {}, () => ({ pong: true }));
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    const result = await dispatch({ action: 'ping.pong' }, { repo, audit });
    expect(result).toEqual({ pong: true });
    expect(_routeCount()).toBe(1);
  });

  it('throws UNAUTHORIZED when auth option is set but no token', async () => {
    register('auth.required', { auth: true }, () => ({ ok: true }));
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    await expect(
      dispatch({ action: 'auth.required', organizationId: 'org_123456' }, { repo, audit }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('forwards payload and ctx to handlers', async () => {
    const handler = vi.fn().mockReturnValue({ ok: true });
    register('echo', {}, handler);
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    await dispatch({ action: 'echo', payload: { hello: 'world' } }, { repo, audit });
    expect(handler).toHaveBeenCalledWith(
      { hello: 'world' },
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('audits when option is set and auth resolved', async () => {
    const repo = fakeRepo({
      findOne: vi
        .fn()
        .mockResolvedValue({
          id: 'u-1',
          organizationId: 'org_123456',
          email: 'a@b.com',
          status: 'ACTIVE',
        }),
      rows: vi.fn().mockResolvedValue([]),
    });
    const audit = makeAuditService(repo, silentLogger);
    const appendSpy = vi.spyOn(audit, 'record');
    register('audited.action', { auth: true, audit: true }, () => ({ ok: true }));
    await dispatch(
      { action: 'audited.action', organizationId: 'org_123456', auth: { accessToken: 'tok' } },
      { repo, audit },
    );
    expect(appendSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'audited.action' }));
  });

  it('rejects invalid organizationId with VALIDATION_ERROR', async () => {
    register('check', { auth: true }, () => ({ ok: true }));
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    await expect(
      dispatch({ action: 'check', organizationId: 'short' }, { repo, audit }),
    ).rejects.toBeInstanceOf(ApiException);
  });
});
