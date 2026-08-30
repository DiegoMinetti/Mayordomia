import { describe, expect, it } from 'vitest';
import { planCalendarSync, stableEventHash } from './calendarSync';
import { OfflineQueue, type QueueOperation, type QueueStore } from './offlineQueue';

describe('calendar sync', () => {
  it('never overwrites an external change silently', () => {
    const local = { title: 'Local', startAt: 'a', endAt: 'b' };
    const remote = { title: 'Externamente editado', startAt: 'a', endAt: 'b' };
    const link = {
      lastPublishedHash: stableEventHash({ title: 'Anterior', startAt: 'a', endAt: 'b' }),
    } as never;
    expect(planCalendarSync(local, link, remote)).toBe('EXTERNAL_CHANGE');
  });
});
describe('offline queue', () => {
  it('retains failed operations and increments attempts', async () => {
    const data: QueueOperation[] = [];
    const store: QueueStore = {
      list: async () => data,
      put: async (x) => {
        const i = data.findIndex((v) => v.id === x.id);
        if (i < 0) data.push(x);
        else data.splice(i, 1, x);
      },
      remove: async (id) => {
        const i = data.findIndex((x) => x.id === id);
        if (i >= 0) data.splice(i, 1);
      },
    };
    const queue = new OfflineQueue(store);
    await queue.enqueue({ id: '1', entityKey: 'request:1', payload: {}, createdAt: '2026-01-01' });
    expect(
      await queue.flush(async () => {
        throw new Error('offline');
      }),
    ).toEqual({ completed: [], failed: ['1'] });
    expect(data[0].attempts).toBe(1);
  });
});
