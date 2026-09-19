import Database from "@tauri-apps/plugin-sql";
import type { LearningDay, LearningPlan, Resource, Task } from "./timetable";
import { uid } from "./timetable";

let cached: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!cached) cached = await Database.load("sqlite:thirtyday.db");
  return cached;
}

export function dateForDay(startDate: string, dayNumber: number): string {
  const ms = new Date(`${startDate}T00:00:00Z`).getTime() + (dayNumber - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface PlanSummary {
  id: string;
  name: string;
  start_date: string;
  created_at: string;
  notes: string;
  total: number;
  done: number;
}

export interface FullDay extends LearningDay {
  date: string;
  notes: string;
  tasks: (Task & { notes: string; position: number })[];
  resources: (Resource & { title?: string })[];
}

export interface FullPlan extends Omit<LearningPlan, "days"> {
  startDate: string;
  notes: string;
  days: FullDay[];
}

export async function listPlans(): Promise<PlanSummary[]> {
  const db = await getDb();
  const plans = await db.select<{ id: string; name: string; start_date: string; created_at: string; notes: string }[]>(
    "SELECT id, name, start_date, created_at, notes FROM plans ORDER BY created_at DESC",
  );
  return Promise.all(
    plans.map(async (p) => {
      const rows = await db.select<{ total: number; done: number }[]>(
        `SELECT COUNT(*) AS total, COALESCE(SUM(t.completed), 0) AS done
         FROM tasks t JOIN days d ON d.id = t.day_id WHERE d.plan_id = $1`,
        [p.id],
      );
      return { ...p, total: rows[0]?.total ?? 0, done: rows[0]?.done ?? 0 };
    }),
  );
}

export async function getPlan(planId: string): Promise<FullPlan | null> {
  const db = await getDb();
  const plans = await db.select<{ id: string; name: string; start_date: string; created_at: string; notes: string }[]>(
    "SELECT id, name, start_date, created_at, notes FROM plans WHERE id = $1",
    [planId],
  );
  if (plans.length === 0) return null;
  const p = plans[0];
  const days = await db.select<{
    id: string; day_number: number; date: string; topic: string; goal: string;
    estimated_minutes: number; notes: string;
  }[]>("SELECT * FROM days WHERE plan_id = $1 ORDER BY day_number", [planId]);
  const full: FullDay[] = await Promise.all(
    days.map(async (d) => {
      const tasks = await db.select<{
        id: string; title: string; description: string; estimated_minutes: number;
        resource_url: string; notes: string; position: number; completed: number; completed_at: string | null;
      }[]>("SELECT * FROM tasks WHERE day_id = $1 ORDER BY position", [d.id]);
      const resources = await db.select<{ id: string; url: string; title: string }[]>(
        "SELECT * FROM resources WHERE day_id = $1",
        [d.id],
      );
      return {
        id: d.id,
        dayNumber: d.day_number,
        date: d.date,
        topic: d.topic,
        goal: d.goal || undefined,
        estimatedMinutes: d.estimated_minutes || undefined,
        notes: d.notes,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description || undefined,
          estimatedMinutes: t.estimated_minutes || undefined,
          resourceUrl: t.resource_url || undefined,
          notes: t.notes,
          position: t.position,
          completed: t.completed === 1,
          completedAt: t.completed_at ?? undefined,
        })),
        resources: resources.map((r) => ({ id: r.id, url: r.url, title: r.title || undefined })),
      };
    }),
  );
  return {
    id: p.id, name: p.name, durationDays: full.length, createdAt: p.created_at,
    startDate: p.start_date, notes: p.notes, days: full,
  };
}

export async function createPlan(parsed: LearningPlan, startDate: string): Promise<string> {
  const db = await getDb();
  const planId = uid();
  await db.execute("INSERT INTO plans (id, name, start_date, created_at, notes) VALUES ($1, $2, $3, $4, '')", [
    planId, parsed.name, startDate, new Date().toISOString(),
  ]);
  for (const d of parsed.days) {
    const dayId = uid();
    await db.execute(
      "INSERT INTO days (id, plan_id, day_number, date, topic, goal, estimated_minutes, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,'')",
      [dayId, planId, d.dayNumber, dateForDay(startDate, d.dayNumber), d.topic, d.goal ?? "", d.estimatedMinutes ?? 0],
    );
    let pos = 0;
    for (const t of d.tasks) {
      await db.execute(
        "INSERT INTO tasks (id, day_id, title, description, estimated_minutes, resource_url, notes, position, completed) VALUES ($1,$2,$3,'',0,'','',$4,0)",
        [uid(), dayId, t.title, pos++],
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

export async function toggleTask(taskId: string, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed = $1, completed_at = $2 WHERE id = $3", [
    completed ? 1 : 0,
    completed ? new Date().toISOString() : null,
    taskId,
  ]);
}

export async function updateDayNotes(dayId: string, notes: string): Promise<void> {
  await (await getDb()).execute("UPDATE days SET notes = $1 WHERE id = $2", [notes, dayId]);
}

export async function updateTaskNotes(taskId: string, notes: string): Promise<void> {
  await (await getDb()).execute("UPDATE tasks SET notes = $1 WHERE id = $2", [notes, taskId]);
}

export async function updateTaskDetails(taskId: string, description: string, estimatedMinutes: number): Promise<void> {
  await (await getDb()).execute("UPDATE tasks SET description = $1, estimated_minutes = $2 WHERE id = $3", [
    description, Math.max(0, Math.round(estimatedMinutes) || 0), taskId,
  ]);
}

export async function updatePlanNotes(planId: string, notes: string): Promise<void> {
  await (await getDb()).execute("UPDATE plans SET notes = $1 WHERE id = $2", [notes, planId]);
}

export async function renamePlan(planId: string, name: string): Promise<void> {
  await (await getDb()).execute("UPDATE plans SET name = $1 WHERE id = $2", [name, planId]);
}

export async function resetDay(dayId: string): Promise<void> {
  await (await getDb()).execute("UPDATE tasks SET completed = 0, completed_at = NULL WHERE day_id = $1", [dayId]);
}

export async function resetPlan(planId: string): Promise<void> {
  await (await getDb()).execute(
    "UPDATE tasks SET completed = 0, completed_at = NULL WHERE day_id IN (SELECT id FROM days WHERE plan_id = $1)",
    [planId],
  );
}

export async function deletePlan(planId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE day_id IN (SELECT id FROM days WHERE plan_id = $1)", [planId]);
  await db.execute("DELETE FROM resources WHERE day_id IN (SELECT id FROM days WHERE plan_id = $1)", [planId]);
  await db.execute("DELETE FROM days WHERE plan_id = $1", [planId]);
  await db.execute("DELETE FROM plans WHERE id = $1", [planId]);
}
