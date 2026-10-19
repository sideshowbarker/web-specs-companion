import { describe, it, expect, vi } from 'vitest';
import { ensureAlarms, runAlarm } from '../src/background/refresh.ts';
import type { Sources } from '../src/data/sources.ts';

describe('ensureAlarms', () => {
  it('creates only the alarms that are missing', async () => {
    const existing = new Set(['refresh-data']);
    const alarms = {
      get: vi.fn(async (name: string) => (existing.has(name) ? ({ name, scheduledTime: 0 } as chrome.alarms.Alarm) : undefined)),
      create: vi.fn(),
    };
    await ensureAlarms(alarms);
    expect(alarms.create).toHaveBeenCalledTimes(1);
    expect(alarms.create).toHaveBeenCalledWith('refresh-tpac', { periodInMinutes: 15, delayInMinutes: 1 });
  });
});

describe('runAlarm', () => {
  const sources = () => ({ load: vi.fn(async () => ({ data: [], fetchedAt: 0, origin: 'live' })) }) as unknown as Sources & { load: ReturnType<typeof vi.fn> };

  it('force-refreshes the daily sources, skipping any that fail', async () => {
    const s = sources();
    s.load.mockImplementation(async (name: string) => {
      if (name === 'groups') throw new Error('offline');
      return { data: [], fetchedAt: 0, origin: 'live' };
    });
    expect(await runAlarm('refresh-data', s, 0)).toEqual(['specs', 'repos', 'idlnames', 'implementations', 'mdn']);
    expect(s.load).toHaveBeenCalledWith('specs', { force: true });
  });

  it('refreshes the TPAC calendar only during the TPAC window', async () => {
    const s = sources();
    expect(await runAlarm('refresh-tpac', s, Date.parse('2026-10-27T10:00:00Z'))).toEqual(['tpac']);
    expect(await runAlarm('refresh-tpac', s, Date.parse('2026-11-05T10:00:00Z'))).toEqual([]);
  });
});
