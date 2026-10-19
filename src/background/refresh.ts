import type { Sources, SourceName } from '../data/sources.ts';
import { tpacVisible } from '../data/tpac.ts';

export const ALARM_PERIODS: Record<string, number> = { 'refresh-data': 360, 'refresh-tpac': 15 };

export interface AlarmsLike {
  get(name: string): Promise<chrome.alarms.Alarm | undefined>;
  create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void> | void;
}

export async function ensureAlarms(alarms: AlarmsLike): Promise<void> {
  for (const [name, periodInMinutes] of Object.entries(ALARM_PERIODS)) {
    if (!(await alarms.get(name))) await alarms.create(name, { periodInMinutes, delayInMinutes: 1 });
  }
}

export async function runAlarm(name: string, sources: Sources, now: number): Promise<string[]> {
  const names: SourceName[] =
    name === 'refresh-data' ? ['specs', 'groups', 'repos', 'idlnames', 'implementations', 'mdn', 'caniuse', 'wpt']
    : name === 'refresh-tpac' && tpacVisible(now) ? ['tpac']
    : [];
  const refreshed: string[] = [];
  for (const n of names) {
    try {
      await sources.load(n, { force: true });
      refreshed.push(n);
    } catch (err) {
      console.debug(`w3c-companion: refresh of ${n} failed:`, err);
    }
  }
  return refreshed;
}
