import type { CalendarEventLink } from '../domain/models';

export interface CalendarSnapshot {
  title: string;
  startAt: string;
  endAt: string;
  description?: string;
}
export type CalendarSyncDecision = 'CREATE' | 'NOOP' | 'UPDATE_REMOTE' | 'EXTERNAL_CHANGE';
export const stableEventHash = (event: CalendarSnapshot): string =>
  JSON.stringify([event.title, event.startAt, event.endAt, event.description ?? '']);

export function planCalendarSync(
  local: CalendarSnapshot,
  link?: CalendarEventLink,
  remote?: CalendarSnapshot,
): CalendarSyncDecision {
  if (!link || !remote) return 'CREATE';
  const localHash = stableEventHash(local);
  const remoteHash = stableEventHash(remote);
  if (localHash === remoteHash) return 'NOOP';
  if (remoteHash !== link.lastPublishedHash) return 'EXTERNAL_CHANGE';
  return 'UPDATE_REMOTE';
}
