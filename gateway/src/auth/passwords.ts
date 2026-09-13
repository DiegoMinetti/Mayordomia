/**
 * Password hashing — bcrypt via bcryptjs (pure JS, no native build).
 *
 * Cost factor 12 is the current sweet spot for ~250ms hashes on a Pi 4.
 * Future-proof: bumping to 13/14 doubles the work without breaking existing hashes
 * (bcrypt encodes the cost in the hash itself).
 */
import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  if (plain.length > 256) {
    throw new Error('La contraseña no puede tener más de 256 caracteres');
  }
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
