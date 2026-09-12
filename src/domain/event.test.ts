import { describe, expect, it } from 'vitest';
import {
  formatEventRange,
  groupByDay,
  isOngoing,
  isPast,
  isSoon,
  isUpcoming,
  type EventDto,
} from './event';

const NOW = new Date('2026-09-14T10:00:00Z'); // 07:00 local in America/Argentina/Buenos_Aires (UTC-3)

function makeEvent(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: 'e1',
    organizationId: 'o1',
    name: 'Culto principal',
    kind: 'SERVICE',
    startAt: '2026-09-14T22:00:00Z', // 19:00 local
    endAt: '2026-09-14T23:30:00Z', // 20:30 local
    allDay: false,
    status: 'PUBLISHED',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'u1',
    updatedAt: '2026-09-01T00:00:00Z',
    updatedBy: 'u1',
    version: 1,
    ...overrides,
  };
}

describe('formatEventRange', () => {
  it('renders today + time for a same-day timed event today', () => {
    const e = makeEvent();
    const out = formatEventRange(e, NOW);
    expect(out).toMatch(/^Hoy \d{2}:\d{2}–\d{2}:\d{2}$/);
  });

  it('renders a future date for a same-day timed event not today', () => {
    const e = makeEvent({
      startAt: '2026-09-18T22:00:00Z',
      endAt: '2026-09-18T23:30:00Z',
    });
    const out = formatEventRange(e, NOW);
    expect(out).toMatch(/vie \d{1,2} sep \d{2}:\d{2}–\d{2}:\d{2}/i);
  });

  it('renders a single day label for an all-day same-day event today', () => {
    const e = makeEvent({
      allDay: true,
      startAt: '2026-09-14T00:00:00Z',
      endAt: '2026-09-14T23:59:59Z',
    });
    expect(formatEventRange(e, NOW)).toBe('Hoy');
  });

  it('renders "Mañana" for an all-day event on the next day', () => {
    const e = makeEvent({
      allDay: true,
      startAt: '2026-09-15T00:00:00Z',
      endAt: '2026-09-15T23:59:59Z',
    });
    expect(formatEventRange(e, NOW)).toBe('Mañana');
  });

  it('renders a range for a multi-day timed event', () => {
    const e = makeEvent({
      startAt: '2026-09-20T22:00:00Z',
      endAt: '2026-09-22T23:00:00Z',
    });
    const out = formatEventRange(e, NOW);
    expect(out).toMatch(/–/);
  });
});

describe('time predicates', () => {
  it('isUpcoming is true when startAt > now', () => {
    const e = makeEvent({ startAt: '2026-09-15T22:00:00Z', endAt: '2026-09-15T23:00:00Z' });
    expect(isUpcoming(e, NOW)).toBe(true);
    expect(isPast(e, NOW)).toBe(false);
    expect(isOngoing(e, NOW)).toBe(false);
  });

  it('isPast is true when endAt < now', () => {
    const e = makeEvent({ startAt: '2026-09-10T22:00:00Z', endAt: '2026-09-10T23:00:00Z' });
    expect(isPast(e, NOW)).toBe(true);
    expect(isUpcoming(e, NOW)).toBe(false);
  });

  it('isOngoing is true when now is between startAt and endAt', () => {
    const e = makeEvent({ startAt: '2026-09-14T09:00:00Z', endAt: '2026-09-14T11:00:00Z' });
    expect(isOngoing(e, NOW)).toBe(true);
    expect(isPast(e, NOW)).toBe(false);
    expect(isUpcoming(e, NOW)).toBe(false);
  });

  it('isSoon catches events within a window, including ongoing ones', () => {
    const inOneHour = makeEvent({ startAt: '2026-09-14T11:00:00Z', endAt: '2026-09-14T12:00:00Z' });
    const inOneDay = makeEvent({ startAt: '2026-09-15T22:00:00Z', endAt: '2026-09-15T23:00:00Z' });
    const ongoing = makeEvent({ startAt: '2026-09-14T09:00:00Z', endAt: '2026-09-14T11:00:00Z' });
    expect(isSoon(inOneHour, 2 * 60 * 60 * 1000, NOW)).toBe(true);
    expect(isSoon(ongoing, 2 * 60 * 60 * 1000, NOW)).toBe(true);
    expect(isSoon(inOneDay, 2 * 60 * 60 * 1000, NOW)).toBe(false);
  });
});

describe('groupByDay', () => {
  it('groups events by local calendar day, preserving first-seen order within a day', () => {
    const today1 = makeEvent({
      id: 'a',
      startAt: '2026-09-14T22:00:00Z',
      endAt: '2026-09-14T23:00:00Z',
    });
    const today2 = makeEvent({
      id: 'b',
      startAt: '2026-09-14T23:00:00Z',
      endAt: '2026-09-15T00:00:00Z',
    });
    const tomorrow = makeEvent({
      id: 'c',
      startAt: '2026-09-15T22:00:00Z',
      endAt: '2026-09-15T23:00:00Z',
    });
    const buckets = groupByDay([tomorrow, today1, today2], NOW);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label).toBe('Hoy');
    expect(buckets[0].events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(buckets[1].label).toBe('Mañana');
    expect(buckets[1].events.map((e) => e.id)).toEqual(['c']);
  });

  it('returns an empty array when given no events', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});
