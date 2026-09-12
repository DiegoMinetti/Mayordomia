import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { DataClient } from './DataClient';
import type { EventDto, GatewayResponse } from './types';

function envelopeOk<T>(data: T): GatewayResponse<T> {
  return { ok: true, data };
}
function envelopeErr(code: string, message = 'x'): GatewayResponse<never> {
  return { ok: false, error: { code, message } };
}

function installFetchMock(responder: (action: string, payload: unknown) => unknown) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { action: string; payload: unknown };
    return { json: async () => responder(body.action, body.payload) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const SAMPLE_EVENT: EventDto = {
  id: 'e1',
  organizationId: 'org-1',
  siteId: 'site-1',
  name: 'Culto',
  kind: 'SERVICE',
  startAt: '2026-09-14T22:00:00Z',
  endAt: '2026-09-14T23:30:00Z',
  allDay: false,
  status: 'PUBLISHED',
  createdAt: '2026-09-01T00:00:00Z',
  createdBy: 'u1',
  updatedAt: '2026-09-01T00:00:00Z',
  updatedBy: 'u1',
  version: 1,
};

describe('DataClient events endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listEvents returns events from the gateway envelope', async () => {
    installFetchMock((action) => {
      if (action === 'events.list') return envelopeOk({ events: [SAMPLE_EVENT] });
      return envelopeErr('NOT_FOUND');
    });
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    const events = await client.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('e1');
  });

  it('listEvents passes filters to the gateway payload', async () => {
    const fetchMock = installFetchMock((action) => {
      if (action === 'events.list') return envelopeOk({ events: [] });
      return envelopeErr('NOT_FOUND');
    });
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    await client.listEvents({ siteId: 'site-1', status: 'PUBLISHED' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.payload).toMatchObject({ siteId: 'site-1', status: 'PUBLISHED' });
  });

  it('listEvents returns an empty array when the gateway errors', async () => {
    installFetchMock(() => envelopeErr('FORBIDDEN'));
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    const events = await client.listEvents();
    expect(events).toEqual([]);
  });

  it('getEvent returns the joined detail envelope', async () => {
    installFetchMock((action) => {
      if (action === 'events.get')
        return envelopeOk({
          event: {
            ...SAMPLE_EVENT,
            areas: [],
            resources: [],
            people: [],
          },
        });
      return envelopeErr('NOT_FOUND');
    });
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    const event = await client.getEvent('e1');
    expect(event?.id).toBe('e1');
    expect(event?.areas).toEqual([]);
  });

  it('getEvent returns undefined when the gateway errors', async () => {
    installFetchMock(() => envelopeErr('NOT_FOUND'));
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    const event = await client.getEvent('missing');
    expect(event).toBeUndefined();
  });

  it('upcomingEvents returns the events payload', async () => {
    installFetchMock((action, payload) => {
      if (action === 'events.upcoming') {
        const days = (payload as { days: number }).days;
        return envelopeOk({ events: days === 7 ? [SAMPLE_EVENT] : [] });
      }
      return envelopeErr('NOT_FOUND');
    });
    const gw = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const client = new DataClient(gw, { organizationId: 'org-1' });
    const seven = await client.upcomingEvents(7);
    const sixty = await client.upcomingEvents(60);
    expect(seven).toHaveLength(1);
    expect(sixty).toEqual([]);
  });

  it('mock mode for events.list returns deterministic events', async () => {
    const gw = new GatewayClient({
      appsScriptUrl: '',
      getAccessToken: vi.fn(),
    });
    const client = new DataClient(gw, { organizationId: 'org-mock' });
    const events = await client.listEvents();
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.every((e) => e.organizationId === 'org-mock')).toBe(true);
  });
});
