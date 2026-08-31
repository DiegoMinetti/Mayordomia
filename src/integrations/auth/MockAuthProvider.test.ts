import { describe, expect, it, vi } from 'vitest';
import { MockAuthProvider } from './MockAuthProvider';
import type { GoogleUser } from './types';

const u: GoogleUser = { sub: 'g-1', email: 'a@b.c' };

describe('MockAuthProvider', () => {
  it('throws on signIn without a configured user', async () => {
    const p = new MockAuthProvider();
    await expect(p.signIn()).rejects.toThrow(/no user/);
  });

  it('exposes the user via getUser only when authenticated', async () => {
    const p = new MockAuthProvider({ user: u });
    expect(p.getUser()).toBeUndefined();
    await p.signIn();
    expect(p.getUser()).toEqual(u);
  });

  it('getValidAccessToken returns a token when authenticated', async () => {
    const p = new MockAuthProvider({ user: u });
    await expect(p.getValidAccessToken()).rejects.toThrow();
    await p.signIn();
    const token = await p.getValidAccessToken();
    expect(token).toBe('mock-access-token');
  });

  it('notifies subscribers on state change', async () => {
    const p = new MockAuthProvider({ user: u });
    const listener = vi.fn();
    const unsub = p.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
    await p.signIn();
    expect(listener).toHaveBeenCalledTimes(1);
    await p.signOut();
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
    await p.signIn();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
