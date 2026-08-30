export interface QueueOperation<T = unknown> {
  id: string;
  entityKey: string;
  expectedVersion?: number;
  payload: T;
  attempts: number;
  createdAt: string;
}
export interface QueueStore {
  list(): Promise<QueueOperation[]>;
  put(operation: QueueOperation): Promise<void>;
  remove(id: string): Promise<void>;
}
export type QueueHandler = (operation: QueueOperation) => Promise<void>;

export class OfflineQueue {
  constructor(private readonly store: QueueStore) {}
  async enqueue(operation: Omit<QueueOperation, 'attempts'>): Promise<void> {
    await this.store.put({ ...operation, attempts: 0 });
  }
  async flush(handler: QueueHandler): Promise<{ completed: string[]; failed: string[] }> {
    const completed: string[] = [],
      failed: string[] = [];
    for (const operation of (await this.store.list()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
      try {
        await handler(operation);
        await this.store.remove(operation.id);
        completed.push(operation.id);
      } catch {
        await this.store.put({ ...operation, attempts: operation.attempts + 1 });
        failed.push(operation.id);
      }
    }
    return { completed, failed };
  }
}
