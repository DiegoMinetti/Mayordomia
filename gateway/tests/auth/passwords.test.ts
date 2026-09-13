import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/passwords.js';

describe('auth.passwords', () => {
  it('hashes a password to a bcrypt-shaped string', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('hunter2-but-real');
    expect(await verifyPassword('hunter2-but-real', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('hunter2-but-real');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects passwords shorter than 8 chars', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/al menos 8 caracteres/);
  });

  it('rejects empty/null hashes gracefully', async () => {
    expect(await verifyPassword('whatever', '')).toBe(false);
  });
});
