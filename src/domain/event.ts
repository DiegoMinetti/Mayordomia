/**
 * Event domain types and helpers.
 *
 * The DTOs mirror the JSON shape returned by the Apps Script `events.*`
 * endpoints. They stay loose so the gateway can evolve (e.g. add a column
 * in the Events sheet) without forcing a frontend release.
 *
 * Time fields are always ISO 8601 strings in UTC. Local presentation is
 * done by the helpers below, which take an optional `now` so tests can be
 * deterministic.
 */

import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es, type Locale } from 'date-fns/locale';

export type EventKind = 'SERVICE' | 'REHEARSAL' | 'CLASS' | 'MEETING' | 'OTHER';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type EventResponsibility = 'LEAD' | 'SUPPORT' | 'INFO';
export type EventPeopleRole = 'LEAD' | 'SUPPORT' | 'ATTENDEE';

export interface EventDto {
  id: string;
  organizationId: string;
  siteId?: string;
  name: string;
  description?: string;
  kind: EventKind;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrenceRule?: string;
  parentEventId?: string;
  status: EventStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface EventAreaDto {
  id: string;
  organizationId: string;
  eventId: string;
  areaId: string;
  responsibility: EventResponsibility;
}

export interface EventResourceDto {
  id: string;
  organizationId: string;
  eventId: string;
  resourceId: string;
  quantity: number;
}

export interface EventPersonDto {
  id: string;
  organizationId: string;
  eventId: string;
  personId: string;
  role: EventPeopleRole;
}

export interface EventTemplateDto {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  defaultAreas?: string[];
  defaultResources?: Record<string, number>;
}

/** Joined payload returned by `events.get`. */
export interface EventDetailDto extends EventDto {
  areas: EventAreaDto[];
  resources: EventResourceDto[];
  people: EventPersonDto[];
  template?: EventTemplateDto;
}

export interface EventFilters {
  siteId?: string;
  status?: EventStatus;
  kind?: EventKind;
  startAfter?: string;
  endBefore?: string;
}

/**
 * Renders a human-friendly range:
 *  - all-day, same day  -> "Hoy" / "Vie 14 nov"
 *  - same day timed     -> "Hoy 19:00–20:30" / "Vie 14 nov 19:00–20:30"
 *  - multi-day          -> "15 nov – 17 nov"
 *
 * All-day events use the UTC calendar date of `startAt` as the canonical
 * "event day" (so a stored `2026-09-14T00:00:00Z` is Sept 14 everywhere).
 * The "Hoy"/"Mañana" label compares the user's local date against that
 * UTC date.
 */
export function formatEventRange(
  event: Pick<EventDto, 'startAt' | 'endAt' | 'allDay'>,
  now: Date = new Date(),
): string {
  const start = parseISO(event.startAt);
  const end = parseISO(event.endAt);

  if (event.allDay) {
    const startUtcKey = utcDayKey_(start);
    const endUtcKey = utcDayKey_(end);
    if (startUtcKey === endUtcKey) {
      const dayLabel = allDayLabel_(startUtcKey, now);
      return dayLabel;
    }
    return `${formatUtcDay_(startUtcKey, 'd MMM', { locale: es })} – ${formatUtcDay_(endUtcKey, 'd MMM', { locale: es })}`;
  }

  if (isSameDay(start, end)) {
    const dayLabel = isSameDay(start, now)
      ? 'Hoy'
      : isSameDay(start, startOfDay(addDays_(now, 1)))
        ? 'Mañana'
        : format(start, 'EEE d MMM', { locale: es });
    return `${dayLabel} ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
  }
  return `${format(start, 'd MMM HH:mm', { locale: es })} – ${format(end, 'd MMM HH:mm', { locale: es })}`;
}

/** True when startAt > now. */
export function isUpcoming(
  event: Pick<EventDto, 'startAt' | 'endAt'>,
  now: Date = new Date(),
): boolean {
  return parseISO(event.startAt).getTime() > now.getTime();
}

/** True when endAt < now. */
export function isPast(
  event: Pick<EventDto, 'startAt' | 'endAt'>,
  now: Date = new Date(),
): boolean {
  return parseISO(event.endAt).getTime() < now.getTime();
}

/** True when now is between startAt and endAt (inclusive on the left). */
export function isOngoing(
  event: Pick<EventDto, 'startAt' | 'endAt'>,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  return parseISO(event.startAt).getTime() <= t && t < parseISO(event.endAt).getTime();
}

/** True when the event is in the next `withinMs` milliseconds (or already started but not ended). */
export function isSoon(
  event: Pick<EventDto, 'startAt' | 'endAt'>,
  withinMs: number,
  now: Date = new Date(),
): boolean {
  if (isOngoing(event, now)) return true;
  const start = parseISO(event.startAt).getTime();
  return start >= now.getTime() && start - now.getTime() <= withinMs;
}

export interface DayBucket<T extends Pick<EventDto, 'startAt'>> {
  /** ISO date (yyyy-MM-dd) in the local timezone. */
  key: string;
  /** Midnight local. */
  date: Date;
  /** Human label: "Hoy", "Mañana" or "Vie 14 nov". */
  label: string;
  events: T[];
}

/**
 * Groups events by local calendar day, preserving the order of first appearance.
 * Useful for the agenda view. Uses `date-fns` startOfDay.
 */
export function groupByDay<T extends Pick<EventDto, 'startAt' | 'allDay'>>(
  events: T[],
  now: Date = new Date(),
): DayBucket<T>[] {
  const buckets = new Map<string, DayBucket<T>>();
  for (const e of events) {
    // For all-day events, the "event day" is the UTC date of startAt.
    // For timed events, it's the local calendar day of startAt.
    const d = parseISO(e.startAt);
    const key = e.allDay ? utcDayKey_(d) : format(startOfDay(d), 'yyyy-MM-dd');
    const day = e.allDay ? new Date(`${key}T00:00:00Z`) : startOfDay(d);
    let bucket = buckets.get(key);
    if (!bucket) {
      const isToday = e.allDay ? utcDayKey_(now) === key : isSameDay(day, now);
      const isTomorrow = e.allDay
        ? utcDayKey_(addDays_(now, 1)) === key
        : isSameDay(day, addDays_(now, 1));
      const label = isToday
        ? 'Hoy'
        : isTomorrow
          ? 'Mañana'
          : format(day, "EEE d 'de' MMM", { locale: es });
      bucket = { key, date: day, label, events: [] };
      buckets.set(key, bucket);
    }
    bucket.events.push(e);
  }
  return [...buckets.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function addDays_(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Returns the UTC calendar date key (yyyy-MM-dd) for a Date. */
function utcDayKey_(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function allDayLabel_(utcKey: string, now: Date): string {
  const todayKey = utcDayKey_(now);
  const tomorrowKey = utcDayKey_(addDays_(now, 1));
  if (utcKey === todayKey) return 'Hoy';
  if (utcKey === tomorrowKey) return 'Mañana';
  return formatUtcDay_(utcKey, "EEE d 'de' MMM", { locale: es });
}

function formatUtcDay_(utcKey: string, fmt: string, opts: { locale: Locale }): string {
  // Parse the UTC key as a UTC midnight so `format` operates in UTC.
  const [y, m, d] = utcKey.split('-').map(Number);
  return format(new Date(Date.UTC(y, m - 1, d)), fmt, opts);
}
