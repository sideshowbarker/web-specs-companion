export interface Settings {
  usedBy: boolean;
}

export const DEFAULT_SETTINGS: Settings = { usedBy: true };

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get('settings')).settings as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.local.set({ settings: { ...(await getSettings()), ...patch } });
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) cb({ ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Partial<Settings>) });
  });
}
