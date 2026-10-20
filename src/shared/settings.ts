export interface Settings {
  usedBy: boolean;
  // Whether selecting text in a spec shows a Comment button.
  reviewButton: boolean;
}

export const DEFAULT_SETTINGS: Settings = { usedBy: true, reviewButton: true };

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
