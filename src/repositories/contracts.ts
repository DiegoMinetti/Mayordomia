import type { Entity, UUID } from '../domain/models';

export interface VersionedRepository<T extends Entity> {
  get(id: UUID): Promise<T | undefined>;
  list(organizationId: UUID): Promise<T[]>;
  create(entity: T): Promise<T>;
  /** Must reject stale expectedVersion values. */
  update(
    id: UUID,
    expectedVersion: number,
    patch: Partial<Omit<T, 'id' | 'organizationId' | 'version'>>,
  ): Promise<T>;
}
export class ConcurrencyError extends Error {
  constructor() {
    super('Entity was modified by another actor');
    this.name = 'ConcurrencyError';
  }
}

export interface CounterRepository {
  next(organizationId: UUID, namespace: string, year?: number): Promise<number>;
}

export function humanCode(prefix: string, sequence: number, year?: number): string {
  if (sequence < 1 || !Number.isInteger(sequence))
    throw new Error('Sequence must be a positive integer');
  return [prefix, year, String(sequence).padStart(year ? 5 : 6, '0')]
    .filter((x) => x !== undefined)
    .join('-');
}
