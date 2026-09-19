export interface Resource {
  id: string;
  url: string;
  title?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  resourceUrl?: string;
  completed: boolean;
  completedAt?: string;
}

export interface LearningDay {
  id: string;
  dayNumber: number;
  topic: string;
  goal?: string;
  estimatedMinutes?: number;
  tasks: Task[];
  resources: Resource[];
}

export interface LearningPlan {
  id: string;
  name: string;
  durationDays: number;
  createdAt: string;
  days: LearningDay[];
}

export interface ParseIssue {
  day?: number;
  line?: number;
  message: string;
}

export const EXPECTED_DAYS = 30;

/** Collapse [2,4,5,6] → "2, 4–6" for compact error messages. */
export function rangeList(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  let s = sorted[0];
  let p = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === p + 1) { p = sorted[i]; continue; }
    parts.push(s === p ? `${s}` : `${s}–${p}`);
    s = sorted[i];
    p = sorted[i];
  }
  return parts.join(", ");
}

export function uid(): string {
  const c = globalThis.crypto as undefined | { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** "3h" | "90m" | "2.5h" | "1h30m" | "45" -> minutes, else null */
export function parseTimeToMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const hm = s.match(/^(\d+(?:\.\d+)?)h(?:(\d+(?:\.\d+)?)m?)?$/);
  if (hm) {
    const h = parseFloat(hm[1]);
    const m = hm[2] ? parseFloat(hm[2]) : 0;
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return Math.round(h * 60 + m);
  }
  const m = s.match(/^(\d+(?:\.\d+)?)m(?:in(?:s)?)?$/);
  if (m) return Math.round(parseFloat(m[1]));
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  return null;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const H = (name: string) => new RegExp(`^${name}\\s*:\\s*(.*)$`, "i");

interface RawDay {
  num: number;
  line: number;
  topic?: string;
  goal?: string;
  timeRaw?: string;
  timeLine?: number;
  tasks: { title: string; line: number }[];
  badTaskLines: { text: string; line: number }[];
  resources: { url: string; title?: string; line: number }[];
  badResourceLines: { text: string; line: number }[];
}

export function parseTimetable(text: string): { plan: LearningPlan | null; errors: ParseIssue[] } {
  const errors: ParseIssue[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let planName: string | undefined;
  const rawDays: RawDay[] = [];
  let cur: RawDay | null = null;
  let section: "none" | "tasks" | "resources" = "none";

  const pushDay = (num: number, line: number) => {
    cur = { num, line, tasks: [], badTaskLines: [], resources: [], badResourceLines: [] };
    rawDays.push(cur);
    section = "none";
  };

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();
    if (!line) return;
    let m: RegExpMatchArray | null;
    if ((m = line.match(H("PLAN")))) {
      if (!planName) planName = m[1].trim() || undefined;
      return;
    }
    if (H("DURATION").test(line)) return;
    if ((m = line.match(/^DAY\s+(\d+)\s*$/i))) {
      pushDay(parseInt(m[1], 10), lineNo);
      return;
    }
    if (/^DAY\b/i.test(line)) {
      errors.push({ line: lineNo, message: `Invalid DAY header: \`${line}\` (expected \`DAY <number>\`, e.g. \`DAY 1\`)` });
      return;
    }
    if ((m = line.match(H("TIME")))) {
      if (!cur) {
        errors.push({ line: lineNo, message: `TIME outside any DAY block (line ${lineNo}): move it under a \`DAY n\` section` });
        return;
      }
      cur.timeRaw = m[1].trim(); cur.timeLine = lineNo; section = "none"; return;
    }
    if (!cur) return; // ponytail: ignore stray lines before first DAY
    if ((m = line.match(H("TOPIC")))) { cur.topic = m[1].trim(); section = "none"; return; }
    if ((m = line.match(H("GOAL")))) { cur.goal = m[1].trim(); section = "none"; return; }
    if (/^TASKS\s*:?\s*$/i.test(line)) { section = "tasks"; return; }
    if (/^RESOURCES\s*:?\s*$/i.test(line)) { section = "resources"; return; }
    if (/^TASKS\s*:/i.test(line)) {
      errors.push({ day: cur.num, line: lineNo, message: `Day ${cur.num}: TASKS: must be on its own line, with tasks as \`- …\` lines below it` });
      return;
    }
    if (/^RESOURCES\s*:/i.test(line)) {
      errors.push({ day: cur.num, line: lineNo, message: `Day ${cur.num}: RESOURCES: must be on its own line, with resources as \`- https://…\` lines below it` });
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (section === "tasks") {
      if (bullet && bullet[1].trim()) cur.tasks.push({ title: bullet[1].trim(), line: lineNo });
      else cur.badTaskLines.push({ text: line, line: lineNo });
      return;
    }
    if (section === "resources") {
      if (bullet && bullet[1].trim()) {
        const parts = bullet[1].split("|").map((p) => p.trim()).filter(Boolean);
        const urlCandidate = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        cur.resources.push({
          url: urlCandidate,
          title: parts.length > 1 ? parts.slice(0, -1).join(" | ") : undefined,
          line: lineNo,
        });
      } else cur.badResourceLines.push({ text: line, line: lineNo });
      return;
    }
    // ponytail: unknown lines outside sections are ignored, not errors
  });

  if (!planName) errors.push({ message: "Missing PLAN: add a line like `PLAN: My 30-Day Challenge`" });
  if (rawDays.length === 0) {
    errors.push({ message: "No DAY blocks found: add `DAY 1` … `DAY 30` sections" });
    return { plan: null, errors };
  }

  const seen = new Map<number, number>();
  for (const d of rawDays) {
    if (seen.has(d.num)) {
      errors.push({ day: d.num, line: d.line, message: `Day ${d.num}: duplicate day number (first seen on line ${seen.get(d.num)})` });
    } else seen.set(d.num, d.line);
    if (!Number.isInteger(d.num) || d.num < 1 || d.num > EXPECTED_DAYS) {
      errors.push({ day: d.num, line: d.line, message: `Day ${d.num}: invalid day number (expected 1–${EXPECTED_DAYS})` });
    }
    if (!d.topic) errors.push({ day: d.num, line: d.line, message: `Day ${d.num}: missing TOPIC` });
    if (d.tasks.length === 0 && d.badTaskLines.length === 0) {
      errors.push({ day: d.num, line: d.line, message: `Day ${d.num}: missing tasks (add a TASKS: section with \`-\` items)` });
    }
    for (const b of d.badTaskLines) {
      errors.push({ day: d.num, line: b.line, message: `Day ${d.num}: invalid task format — expected \`-\u00a0Task description\`, found: \`${b.text}\`` });
    }
    for (const r of d.resources) {
      if (!isValidHttpUrl(r.url)) {
        errors.push({ day: d.num, line: r.line, message: `Day ${d.num}: invalid URL: \`${r.url}\`` });
      }
    }
    for (const b of d.badResourceLines) {
      errors.push({ day: d.num, line: b.line, message: `Day ${d.num}: invalid resource format — expected \`-\u00a0https://…\`, found: \`${b.text}\`` });
    }
  }

  const missing: number[] = [];
  for (let n = 1; n <= EXPECTED_DAYS; n++) {
    if (!seen.has(n)) missing.push(n);
  }
  if (missing.length > 0) {
    errors.push({ message: `Missing days ${rangeList(missing)} (expected days 1–${EXPECTED_DAYS}; found ${rawDays.length} DAY block(s))` });
  }
  errors.push(...validateTimeLines(text));

  if (errors.length > 0) return { plan: null, errors };

  const days: LearningDay[] = rawDays
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((d) => {
      // ponytail: TIME already validated above, so parseTimeToMinutes can't fail here
      const minutes = d.timeRaw ? parseTimeToMinutes(d.timeRaw) ?? undefined : undefined;
      return {
        id: uid(),
        dayNumber: d.num,
        topic: d.topic!.trim(),
        goal: d.goal?.trim() || undefined,
        estimatedMinutes: minutes,
        tasks: d.tasks.map((t) => ({ id: uid(), title: t.title, completed: false })),
        resources: d.resources.map((r) => ({ id: uid(), url: r.url.trim(), title: r.title })),
      };
    });
  return {
    plan: {
      id: uid(),
      name: planName!.trim(),
      durationDays: EXPECTED_DAYS,
      createdAt: new Date().toISOString(),
      days,
    },
    errors,
  };
}

/** Strict pre-check for TIME lines so malformed values fail validation (§10). */
export function validateTimeLines(text: string): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let day = 0;
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const dm = line.match(/^DAY\s+(\d+)\s*$/i);
    if (dm) { day = parseInt(dm[1], 10); return; }
    const tm = line.match(H("TIME"));
    if (tm && day > 0 && parseTimeToMinutes(tm[1]) === null) {
      issues.push({ day, line: i + 1, message: `Day ${day}: invalid TIME format: \`${tm[1].trim()}\` (try "3h", "90m", "1h30m")` });
    }
  });
  return issues;
}

export function exportTimetable(plan: LearningPlan): string {
  const out: string[] = [`PLAN: ${plan.name}`, `DURATION: ${plan.durationDays} days`, ""];
  const sorted = plan.days.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  sorted.forEach((d, i) => {
    out.push(`DAY ${d.dayNumber}`, `TOPIC: ${d.topic}`);
    if (d.goal) out.push(`GOAL: ${d.goal}`);
    if (d.estimatedMinutes) {
      const h = Math.floor(d.estimatedMinutes / 60);
      const m = d.estimatedMinutes % 60;
      out.push(`TIME: ${h ? `${h}h` : ""}${m ? `${m}m` : ""}`.trim() || "TIME: 0m");
    }
    out.push("", "TASKS:");
    for (const t of d.tasks) out.push(`- ${t.title}`);
    if (d.resources.length > 0) {
      out.push("", "RESOURCES:");
      for (const r of d.resources) out.push(`- ${r.title ? `${r.title} | ${r.url}` : r.url}`);
    }
    if (i < sorted.length - 1) out.push("", "");
  });
  return out.join("\n") + "\n";
}

export function dayProgress(day: { tasks: { completed: boolean }[] }): number {
  if (day.tasks.length === 0) return 0;
  return day.tasks.filter((t) => t.completed).length / day.tasks.length;
}

/** 0% → 0, 1–24% → 1, 25–49% → 2, 50–74% → 3, 75–99% → 4, 100% → 5 */
export function intensityLevel(ratio: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  completions: number; // tasks completed that day (≥1 counts toward streak)
}

export function computeStreaks(days: DayActivity[], todayIso?: string): { current: number; longest: number } {
  const sorted = days.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const active = new Set(sorted.filter((d) => d.completions > 0).map((d) => d.date));
  const dayMs = 86_400_000;
  const toMs = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
  let longest = 0;
  let run = 0;
  let prev = -1;
  for (const d of sorted) {
    if (!active.has(d.date)) { run = 0; prev = -1; continue; }
    const ms = toMs(d.date);
    run = prev >= 0 && ms - prev === dayMs ? run + 1 : 1;
    prev = ms;
    if (run > longest) longest = run;
  }
  const today = (todayIso ?? new Date().toISOString()).slice(0, 10);
  let current = 0;
  let cursor = toMs(today);
  if (!active.has(today)) cursor -= dayMs; // streak stays alive if today is untouched so far
  while (active.has(new Date(cursor).toISOString().slice(0, 10))) {
    current++;
    cursor -= dayMs;
  }
  return { current, longest };
}
