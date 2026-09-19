export interface ReminderPrefs {
  enabled: boolean;
  /** "HH:MM" 24h local time */
  time: string;
}

const KEY = "reminder";
const FIRED_KEY = "reminder-last-fired";

export function loadPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ReminderPrefs>;
      if (typeof p.enabled === "boolean" && /^\d{2}:\d{2}$/.test(p.time ?? "")) {
        return { enabled: p.enabled, time: p.time as string };
      }
    }
  } catch { /* corrupted prefs → defaults */ }
  return { enabled: false, time: "09:00" };
}

export function savePrefs(p: ReminderPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function localYmd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function lastFired(): string | null {
  return localStorage.getItem(FIRED_KEY);
}

export function markFired(ymd: string): void {
  localStorage.setItem(FIRED_KEY, ymd);
}

/** Pure: fire once per day at the configured local minute, only if work remains. */
export function reminderDue(
  prefs: ReminderPrefs,
  now: Date,
  lastFiredYmd: string | null,
  hasOpenTasks: boolean,
): boolean {
  if (!prefs.enabled || !hasOpenTasks) return false;
  const hh = `${now.getHours()}`.padStart(2, "0");
  const mm = `${now.getMinutes()}`.padStart(2, "0");
  if (`${hh}:${mm}` !== prefs.time) return false;
  return lastFiredYmd !== localYmd(now);
}
