import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { hashPublicToken, makeRateLimiter } from '../src/requests/public.js';

describe('public requests', () => {
  describe('hashPublicToken', () => {
    it('produces a stable base64url hash matching SHA-256 of token+pepper', () => {
      const token = 'tok_abc123';
      const pepper = 'pepper_xyz';
      const expected = createHash('sha256').update(token + pepper).digest('base64url');
      expect(hashPublicToken(token, pepper)).toBe(expected);
    });

    it('uses url-safe base64 (no +/= padding)', () => {
      const hash = hashPublicToken('a'.repeat(40), 'p');
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('changes when pepper changes', () => {
      const t = 'tok';
      expect(hashPublicToken(t, 'p1')).not.toBe(hashPublicToken(t, 'p2'));
    });
  });

  describe('rate limiter', () => {
    it('allows the first request and rejects the (max+1)-th', () => {
      const rl = makeRateLimiter({ windowMs: 60_000, max: 3 });
      expect(() => {
        rl.assertAllowed('k');
        rl.assertAllowed('k');
        rl.assertAllowed('k');
      }).not.toThrow();
      expect(() => rl.assertAllowed('k')).toThrow(/Demasiadas/);
    });

    it('isolates buckets per key', () => {
      const rl = makeRateLimiter({ windowMs: 60_000, max: 1 });
      rl.assertAllowed('a');
      expect(() => rl.assertAllowed('a')).toThrow();
      expect(() => rl.assertAllowed('b')).not.toThrow();
    });

    it('resets after the window elapses (synthetic clock)', () => {
      const now = 1_000_000;
      const origNow = Date.now;
      Date.now = () => now;
      try {
        const rl = makeRateLimiter({ windowMs: 1000, max: 1 });
        rl.assertAllowed('k');
        expect(() => rl.assertAllowed('k')).toThrow();
        Date.now = () => now + 1001;
        expect(() => rl.assertAllowed('k')).not.toThrow();
      } finally {
        Date.now = origNow;
      }
    });
  });
});
