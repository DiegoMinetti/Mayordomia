import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from './AuthContext';
import { MockAuthProvider } from './MockAuthProvider';
import { useAuth } from './useAuth';
import type { GoogleUser } from './types';

const fakeUser: GoogleUser = { sub: 'g-1', email: 'test@example.com', name: 'Test' };

function Probe() {
  const { isAuthenticated, isLoading, user, error, status } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="error">{error?.code ?? ''}</span>
    </div>
  );
}

describe('useAuth with MockAuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes unauthenticated state initially', () => {
    const provider = new MockAuthProvider();
    render(
      <AuthContextProvider provider={provider}>
        <Probe />
      </AuthContextProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('reflects authenticated state when signIn succeeds', async () => {
    const provider = new MockAuthProvider({ user: fakeUser });
    render(
      <AuthContextProvider provider={provider}>
        <Probe />
      </AuthContextProvider>,
    );
    await act(async () => {
      await provider.signIn();
    });
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('email').textContent).toBe('test@example.com');
  });

  it('reverts to unauthenticated after signOut', async () => {
    const provider = new MockAuthProvider({ user: fakeUser });
    render(
      <AuthContextProvider provider={provider}>
        <Probe />
      </AuthContextProvider>,
    );
    await act(async () => {
      await provider.signIn();
    });
    expect(screen.getByTestId('auth').textContent).toBe('true');
    await act(async () => {
      await provider.signOut();
    });
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('throws when useAuth is used outside a provider', () => {
    // Suppress the React error log for this expected failure.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/AuthContextProvider/);
    errSpy.mockRestore();
  });
});
