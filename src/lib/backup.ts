import { dateForDay, getDb } from "./db";
import { isValidHttpUrl, uid } from "./timetable";

export interface BackupTask {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  resourceUrl?: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface BackupDay {
  dayNumber: number;
  date?: string;
  topic: string;
  goal?: string;
  estimatedMinutes?: number;
  notes?: string;
  tasks: BackupTask[];
  resources: { url: string; title?: string }[];
}

export interface PlanBackup {
  name: string;
  startDate: string;
  notes?: string;
  days: BackupDay[];
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Parse + strictly validate exported JSON. Throws a human-readable Error. */
export function fullPlanFromBackup(json: unknown): PlanBackup {
  const bad = (m: string): Error => new Error(`Backup invalid: ${m}`);
  const root = typeof json === "string" ? (JSON.parse(json) as unknown) : json;
  if (!isRec(root)) throw bad("expected a JSON object");
  if (typeof root.name !== "string" || !root.name.trim()) throw bad("missing plan name");
  if (typeof root.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(root.startDate)) {
    throw bad("missing or malformed startDate (expected YYYY-MM-DD)");
  }
  if (!Array.isArray(root.days) || root.days.length === 0) throw bad("no days found");
  const seen = new Set<number>();
  const days: BackupDay[] = root.days.map((rd: unknown, i: number) => {
    if (!isRec(rd)) throw bad(`day index ${i} is not an object`);
    const n = rd.dayNumber;
    if (!Number.isInteger(n) || (n as number) < 1) throw bad(`day index ${i} has a bad dayNumber`);
    if (seen.has(n as number)) throw bad(`duplicate day number ${n}`);
    seen.add(n as number);
    if (typeof rd.topic !== "string" || !rd.topic.trim()) throw bad(`day ${n}: missing topic`);
    if (!Array.isArray(rd.tasks)) throw bad(`day ${n}: tasks must be an array`);
    const tasks: BackupTask[] = rd.tasks.map((rt: unknown, k: number) => {
      if (!isRec(rt) || typeof rt.title !== "string" || !rt.title.trim()) {
        throw bad(`day ${n}, task ${k + 1}: missing title`);
      }
      return {
        title: rt.title,
        description: typeof rt.description === "string" ? rt.description : undefined,
        estimatedMinutes: typeof rt.estimatedMinutes === "number" ? rt.estimatedMinutes : undefined,
        resourceUrl: typeof rt.resourceUrl === "string" ? rt.resourceUrl : undefined,
        completed: rt.completed === true,
        completedAt: typeof rt.completedAt === "string" ? rt.completedAt : undefined,
        notes: typeof rt.notes === "string" ? rt.notes : undefined,
      };
    });
    const resources: BackupDay["resources"] = Array.isArray(rd.resources)
      ? rd.resources.map((rr: unknown, k: number) => {
          if (!isRec(rr) || typeof rr.url !== "string" || !isValidHttpUrl(rr.url)) {
            throw bad(`day ${n}, resource ${k + 1}: invalid URL`);
          }
          return { url: rr.url, title: typeof rr.title === "string" ? rr.title : undefined };
        })
      : [];
    return {
      dayNumber: n as number,
      date: typeof rd.date === "string" ? rd.date : undefined,
      topic: (rd.topic as string).trim(),
      goal: typeof rd.goal === "string" && rd.goal.trim() ? rd.goal : undefined,
      estimatedMinutes: typeof rd.estimatedMinutes === "number" ? rd.estimatedMinutes : undefined,
      notes: typeof rd.notes === "string" ? rd.notes : undefined,
      tasks,
      resources,
    };
  });
  return {
    name: (root.name as string).trim(),
    startDate: root.startDate as string,
    notes: typeof root.notes === "string" ? root.notes : undefined,
    days: days.sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

/** Restore a backup with fresh ids. Day dates are recomputed from startDate. */
export async function importBackup(data: PlanBackup, startDate?: string): Promise<string> {
  const db = await getDb();
  const planId = uid();
  const start = startDate ?? data.startDate;
  await db.execute("INSERT INTO plans (id, name, start_date, created_at, notes) VALUES ($1, $2, $3, $4, $5)", [
    planId, data.name, start, new Date().toISOString(), data.notes ?? "",
  ]);
  for (const d of data.days) {
    const dayId = uid();
    await db.execute(
      "INSERT INTO days (id, plan_id, day_number, date, topic, goal, estimated_minutes, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [dayId, planId, d.dayNumber, dateForDay(start, d.dayNumber), d.topic, d.goal ?? "", d.estimatedMinutes ?? 0, d.notes ?? ""],
    );
    let pos = 0;
    for (const t of d.tasks) {
      await db.execute(
        "INSERT INTO tasks (id, day_id, title, description, estimated_minutes, resource_url, notes, position, completed, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [uid(), dayId, t.title, t.description ?? "", t.estimatedMinutes ?? 0, t.resourceUrl ?? "", t.notes ?? "", pos++, t.completed ? 1 : 0, t.completedAt ?? null],
      );
    }
    for (const r of d.resources) {
      await db.execute("INSERT INTO resources (id, day_id, url, title) VALUES ($1,$2,$3,$4)", [
        uid(), dayId, r.url, r.title ?? "",
      ]);
    }
  }
  return planId;
}
