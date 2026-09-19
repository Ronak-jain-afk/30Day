import { useCallback, useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import "./App.css";
import {
  computeStreaks,
  dayProgress,
  EXPECTED_DAYS,
  exportTimetable,
  intensityLevel,
  parseTimetable,
  type LearningPlan,
  type ParseIssue,
} from "./lib/timetable";
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  renamePlan,
  resetDay,
  resetPlan,
  toggleTask,
  updateDayNotes,
  updatePlanNotes,
  updateTaskNotes,
  updateTaskDetails,
  type FullDay,
  type FullPlan,
  type PlanSummary,
} from "./lib/db";
import { demoTimetable } from "./lib/demo";
import { AI_PROMPT } from "./lib/ai-prompt";
import { lastFired, loadPrefs, localYmd, markFired, reminderDue, savePrefs } from "./lib/reminders";
import appIcon from "../src-tauri/icons/128x128.png";

type View = "dashboard" | "day" | "calendar" | "progress" | "settings";
type Theme = "dark" | "light";

const todayIso = () => new Date().toISOString().slice(0, 10);
type DateFmt = "md" | "dmy" | "iso";
const loadDateFmt = (): DateFmt => {
  const v = localStorage.getItem("dateFormat");
  return v === "dmy" || v === "iso" ? v : "md";
};
const fmtDate = (iso: string, fmt: DateFmt = loadDateFmt()): string => {
  if (fmt === "iso") return iso;
  const d = new Date(`${iso}T00:00:00`);
  return fmt === "dmy"
    ? `${d.getDate()} ${d.toLocaleDateString(undefined, { month: "short" })}`
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const fmtMins = (m?: number) => {
  if (!m) return "—";
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};
const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "dark");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [plan, setPlan] = useState<FullPlan | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [dayNum, setDayNum] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, bumpDates] = useState(0);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const refreshPlans = useCallback(async () => {
    try {
      const list = await listPlans();
      setPlans(list);
      setDbError(null);
      return list;
    } catch (e) {
      setDbError(`Database unavailable (run via Tauri, not plain vite): ${String(e)}`);
      return [];
    }
  }, []);

  const refreshPlan = useCallback(async (id: string) => {
    const p = await getPlan(id);
    setPlan(p);
    return p;
  }, []);

  useEffect(() => {
    refreshPlans().then((list) => {
      if (list.length > 0) {
        setActiveId(list[0].id);
        refreshPlan(list[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPlan = async (id: string) => {
    setActiveId(id);
    await refreshPlan(id);
    setView("dashboard");
  };

  const stats = useMemo(() => {
    if (!plan) return null;
    const total = plan.days.reduce((n, d) => n + d.tasks.length, 0);
    const done = plan.days.reduce((n, d) => n + d.tasks.filter((t) => t.completed).length, 0);
    const daysDone = plan.days.filter((d) => d.tasks.length > 0 && d.tasks.every((t) => t.completed)).length;
    const streaks = computeStreaks(
      plan.days.map((d) => ({ date: d.date, completions: d.tasks.filter((t) => t.completed).length })),
    );
    const today = plan.days.find((d) => d.date === todayIso());
    // ponytail: a finished today answers "what's next?" with the next open day
    const todayDone = !today || (today.tasks.length > 0 && today.tasks.every((t) => t.completed));
    const currentDay = !todayDone && today
      ? today
      : (plan.days.find((d) => d.tasks.some((t) => !t.completed)) ?? plan.days[plan.days.length - 1]);
    const mins = plan.days.reduce((n, d) => n + (d.estimatedMinutes ?? 0), 0);
    return { total, done, pct: total ? done / total : 0, daysDone, ...streaks, currentDay, mins };
  }, [plan]);

  const openDay = (n: number) => {
    const max = plan?.days.length ?? EXPECTED_DAYS;
    setDayNum(Math.min(max, Math.max(1, n)));
    setView("day");
  };

  // Ctrl/Cmd+K palette, ← → navigate days, Esc closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") { setImportOpen(false); setExportOpen(false); setPaletteOpen(false); }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (view === "day" && e.key === "ArrowLeft") openDay(dayNum - 1);
      if (view === "day" && e.key === "ArrowRight") openDay(dayNum + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, dayNum]);

  const mutate = async (fn: () => Promise<unknown>) => {
    await fn();
    if (activeId) { await refreshPlan(activeId); await refreshPlans(); }
  };

  // Daily reminder: once per day at the set minute, only while tasks remain open.
  // Fires only while the app is running — there is no background scheduler in v1.
  useEffect(() => {
    const tick = async () => {
      try {
        const prefs = loadPrefs();
        const days = plan?.days ?? [];
        const open = days.some((d) => d.tasks.some((t) => !t.completed));
        if (!reminderDue(prefs, new Date(), lastFired(), open)) return;
        if (!(await isPermissionGranted()) && (await requestPermission()) !== "granted") return;
        const day = days.find((d) => d.tasks.some((t) => !t.completed));
        markFired(localYmd(new Date()));
        await sendNotification({
          title: "30Day",
          body: day
            ? `Day ${day.dayNumber} — ${day.topic}: ${day.tasks.filter((t) => !t.completed).length} task(s) open`
            : "Time for today's tasks",
        });
      } catch { /* reminders are best-effort; never break the app */ }
    };
    const id = window.setInterval(tick, 30_000);
    void tick();
    return () => window.clearInterval(id);
  }, [plan]);

  // ponytail: plain data + substring filter, no fuzzy-search dependency
  const palItems: PalItem[] = [
    { id: "v-dashboard", label: "Go to Dashboard", run: () => setView("dashboard") },
    { id: "v-today", label: "Go to Today", run: () => stats && openDay(stats.currentDay.dayNumber) },
    { id: "v-calendar", label: "Go to Calendar", run: () => setView("calendar") },
    { id: "v-progress", label: "Go to Progress", run: () => setView("progress") },
    { id: "v-settings", label: "Go to Settings", run: () => setView("settings") },
    { id: "a-new", label: "New plan from timetable", run: () => setImportOpen(true) },
    ...plans.map((p): PalItem => ({ id: `p-${p.id}`, label: `Open plan: ${p.name}`, run: () => openPlan(p.id) })),
    ...(plan?.days.map((d): PalItem => ({ id: `d-${d.dayNumber}`, label: `Day ${d.dayNumber} — ${d.topic}`, run: () => openDay(d.dayNumber) })) ?? []),
  ];

  if (dbError) {
    return (
      <main className="empty">
        <h1>30DAY</h1>
        <p className="muted">{dbError}</p>
        <p className="muted">Run with <code>npm run tauri dev</code> — SQLite lives in the desktop shell.</p>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src={appIcon} alt="30Day icon" width={26} height={26} />30DAY</div>
        <nav>
          <NavBtn active={view === "dashboard"} onClick={() => setView("dashboard")} label="Dashboard" />
          <NavBtn
            active={view === "day" && stats?.currentDay.dayNumber === dayNum}
            onClick={() => stats && openDay(stats.currentDay.dayNumber)}
            label="Today"
          />
          <NavBtn active={view === "calendar"} onClick={() => setView("calendar")} label="Calendar" />
          <NavBtn active={view === "progress"} onClick={() => setView("progress")} label="Progress" />
          <NavBtn active={view === "settings"} onClick={() => setView("settings")} label="Settings" />
        </nav>
        <div className="side-label">PLANS</div>
        <div className="plan-list">
          {plans.map((p) => (
            <button
              key={p.id}
              className={`plan-item${p.id === activeId ? " active" : ""}`}
              onClick={() => openPlan(p.id)}
              title={`${p.done}/${p.total} tasks`}
            >
              <span className="plan-name">{p.name}</span>
              <span className="muted">{p.total ? Math.round((p.done / p.total) * 100) : 0}%</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setImportOpen(true)}>+ New plan</button>
        <div className="kbd-hint muted small" title="Open command palette">Ctrl K — commands</div>
        {plan && stats && (
          <div className="side-foot">
            <div className="side-plan">{plan.name}</div>
            <div className="muted small">Day {stats.currentDay.dayNumber} / {plan.days.length}</div>
          </div>
        )}
      </aside>

      <main className="main">
        {!plan || !stats ? (
          view === "settings" ? (
            <SettingsView
              theme={theme}
              setTheme={setTheme}
              plan={null}
              dfmt={loadDateFmt()}
              onDfmt={(f) => { localStorage.setItem("dateFormat", f); bumpDates((t) => t + 1); }}
              onNotes={async () => {}}
              onRename={async () => {}}
              onReset={() => {}}
              onDelete={() => {}}
              onExport={() => {}}
            />
          ) : (
          <div className="empty">
            <h1>Start a 30-day challenge.</h1>
            <p className="muted">Turn any structured timetable into an interactive learning tracker.</p>
            <div className="row">
              <button className="btn primary" onClick={() => setImportOpen(true)}>Import timetable</button>
            </div>
          </div>
          )
        ) : view === "dashboard" ? (
          <Dashboard plan={plan} stats={stats} openDay={openDay} onToggle={(id, c) => mutate(() => toggleTask(id, c))} />
        ) : view === "day" ? (
          <DayView
            day={plan.days[dayNum - 1]}
            plan={plan}
            onToggle={(id, c) => mutate(() => toggleTask(id, c))}
            onNotes={(id, n) => mutate(() => updateDayNotes(id, n))}
            onTaskNotes={(id, n) => mutate(() => updateTaskNotes(id, n))}
            onTaskDetails={(id, d, m) => mutate(() => updateTaskDetails(id, d, m))}
            onPrev={() => openDay(dayNum - 1)}
            onNext={() => openDay(dayNum + 1)}
            onCompleteDay={(id) => mutate(async () => {
              const d = plan.days.find((x) => x.id === id)!;
              const open2 = d.tasks.filter((t) => !t.completed);
              if (open2.length > 0 && !window.confirm(`${open2.length} of ${d.tasks.length} tasks on Day ${d.dayNumber} are still open. Mark them all complete?`)) return;
              await Promise.all(open2.map((t) => toggleTask(t.id, true)));
            })}
            onResetDay={(id) => mutate(() => resetDay(id))}
          />
        ) : view === "calendar" ? (
          <CalendarView plan={plan} openDay={openDay} />
        ) : view === "progress" ? (
          <ProgressView plan={plan} stats={stats} openDay={openDay} />
        ) : (
          <SettingsView
            theme={theme}
            setTheme={setTheme}
            plan={plan}
            dfmt={loadDateFmt()}
            onDfmt={(f) => { localStorage.setItem("dateFormat", f); bumpDates((t) => t + 1); }}
            onNotes={(n) => mutate(() => updatePlanNotes(plan.id, n))}
            onRename={(n) => mutate(() => renamePlan(plan.id, n))}
            onReset={() => { if (window.confirm(`Reset ALL progress for “${plan.name}”? ${stats.done} completed task(s) across ${stats.daysDone} day(s) will become unchecked. Plan structure and notes stay.`)) mutate(() => resetPlan(plan.id)); }}
            onDelete={() => {
              if (!window.confirm(`Delete “${plan.name}” permanently? All ${stats.total} tasks, notes and progress will be lost. This cannot be undone.`)) return;
              mutate(() => deletePlan(plan.id)).then(async () => {
                const list = await refreshPlans();
                setActiveId(list[0]?.id ?? null);
                setPlan(list[0] ? await getPlan(list[0].id) : null);
                setView("dashboard");
              });
            }}
            onExport={() => setExportOpen(true)}
          />
        )}
      </main>

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={async (id) => {
            setImportOpen(false);
            const list = await refreshPlans();
            setPlans(list);
            setActiveId(id);
            await refreshPlan(id);
            setView("dashboard");
          }}
        />
      )}
      {exportOpen && plan && <ExportModal plan={plan} onClose={() => setExportOpen(false)} />}
      {paletteOpen && <CommandPalette items={palItems} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function NavBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button className={`nav${active ? " active" : ""}`} onClick={onClick}>{label}</button>;
}

interface PalItem {
  id: string;
  label: string;
  run: () => void;
}

function CommandPalette({ items, onClose }: { items: PalItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const needle = q.trim().toLowerCase();
  const filtered = (needle
    ? items.filter((i) => i.label.toLowerCase().includes(needle))
    : items
  ).slice(0, 12);
  const go = (i: PalItem) => { onClose(); i.run(); };
  return (
    <div className="modal-back pal-back" onClick={onClose}>
      <div className="modal pal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          className="text pal-input"
          autoFocus
          placeholder="Type a day, plan, or view…"
          aria-label="Command palette"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === "Enter" && filtered[sel]) go(filtered[sel]);
          }}
        />
        <ul className="pal-list">
          {filtered.map((i, idx) => (
            <li key={i.id}>
              <button className={`pal-item${idx === sel ? " sel" : ""}`} onClick={() => go(i)}
                onMouseEnter={() => setSel(idx)}>
                {i.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted small pal-empty">No matches</li>}
        </ul>
      </div>
    </div>
  );
}

interface Stats {
  total: number; done: number; pct: number; daysDone: number;
  current: number; longest: number; currentDay: FullDay; mins: number;
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

function Graph({ plan, openDay, big }: { plan: FullPlan; openDay: (n: number) => void; big?: boolean }) {
  return (
    <div className={`graph${big ? " big" : ""}`}>
      {plan.days.map((d) => {
        const r = dayProgress(d);
        const done = d.tasks.filter((t) => t.completed).length;
        return (
          <button
            key={d.id}
            className={`cell lv${intensityLevel(r)}`}
            title={`Day ${d.dayNumber} — ${d.topic}\n${done}/${d.tasks.length} tasks · ${Math.round(r * 100)}%`}
            aria-label={`Day ${d.dayNumber}, ${Math.round(r * 100)} percent complete`}
            onClick={() => openDay(d.dayNumber)}
          />
        );
      })}
    </div>
  );
}

function Dashboard({ plan, stats, openDay, onToggle }: {
  plan: FullPlan; stats: Stats; openDay: (n: number) => void;
  onToggle: (id: string, c: boolean) => void;
}) {
  const t = stats.currentDay;
  const done = t.tasks.filter((x) => x.completed).length;
  const upNext = plan.days.filter((d) => d.dayNumber > t.dayNumber).slice(0, 2);
  return (
    <div>
      <header className="page-head">
        <div>
          <div className="kicker">{plan.name}</div>
          <h1>Day {t.dayNumber} / {plan.days.length} — {t.topic}</h1>
        </div>
        <button className="btn primary" onClick={() => openDay(t.dayNumber)}>Continue Day {t.dayNumber}</button>
      </header>
      <div className="cards">
        <div className="card">
          <div className="kicker">OVERALL</div>
          <div className="big-num">{Math.round(stats.pct * 100)}%</div>
          <Progress pct={stats.pct} />
          <div className="muted small">{stats.done} / {stats.total} tasks · {stats.daysDone} days complete</div>
        </div>
        <div className="card">
          <div className="kicker">STREAK</div>
          <div className="big-num">{stats.current}<span className="muted small"> / best {stats.longest}</span></div>
          <div className="muted small">A day counts with ≥ 1 completed task.</div>
        </div>
        <div className="card">
          <div className="kicker">TODAY — {done}/{t.tasks.length}</div>
          <ul className="task-list">
            {t.tasks.map((task) => (
              <li key={task.id}>
                <label className="task">
                  <input type="checkbox" checked={task.completed} onChange={(e) => onToggle(task.id, e.target.checked)} />
                  <span className={task.completed ? "done" : ""}>{task.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <section>
        <div className="kicker">ACTIVITY — 30 DAYS</div>
        <Graph plan={plan} openDay={openDay} />
        <div className="legend muted small">Less <span className="swatches"><i className="cell lv0" /><i className="cell lv1" /><i className="cell lv2" /><i className="cell lv3" /><i className="cell lv4" /><i className="cell lv5" /></span> More</div>
      </section>
      {upNext.length > 0 && (
        <section>
          <div className="kicker">UP NEXT</div>
          {upNext.map((d) => (
            <button key={d.id} className="upnext" onClick={() => openDay(d.dayNumber)}>
              <span className="muted">Day {d.dayNumber} · {fmtDate(d.date)}</span>
              <span>{d.topic}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function DayView({ day, onToggle, onNotes, onTaskNotes, onTaskDetails, onPrev, onNext, onCompleteDay, onResetDay }: {
  day: FullDay | undefined;
  plan: FullPlan;
  onToggle: (id: string, c: boolean) => void;
  onNotes: (id: string, n: string) => void;
  onTaskNotes: (id: string, n: string) => void;
  onTaskDetails: (id: string, description: string, minutes: number) => void;
  onPrev: () => void; onNext: () => void;
  onCompleteDay: (id: string) => void;
  onResetDay: (id: string) => void;
}) {
  const [notes, setNotes] = useState(day?.notes ?? "");
  useEffect(() => setNotes(day?.notes ?? ""), [day?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editMins, setEditMins] = useState("");
  if (!day) return <p className="muted">No such day.</p>;
  const r = dayProgress(day);
  const done = day.tasks.filter((t) => t.completed).length;
  const expand = (t: FullDay["tasks"][number]) => {
    setExpanded(t.id);
    setEditDesc(t.description ?? "");
    setEditMins(t.estimatedMinutes ? String(t.estimatedMinutes) : "");
  };
  const saveDetails = () => {
    const t = day.tasks.find((x) => x.id === expanded);
    if (!t) { setExpanded(null); return; }
    const mins = Math.max(0, parseInt(editMins, 10) || 0);
    if (editDesc !== (t.description ?? "") || mins !== (t.estimatedMinutes ?? 0)) {
      onTaskDetails(t.id, editDesc, mins);
    }
    setExpanded(null);
  };
  return (
    <div>
      <div className="kicker">DAY {day.dayNumber} · {fmtDate(day.date)}{day.goal ? ` · ${day.goal}` : ""}</div>
      <h1>{day.topic}</h1>
      <div className="row"><Progress pct={r} /><span className="muted">{done}/{day.tasks.length} · {Math.round(r * 100)}% · ⏱ {fmtMins(day.estimatedMinutes)}</span></div>
      <section>
        <div className="kicker">TASKS</div>
        <ul className="task-list">
          {day.tasks.map((t) => (
            <li key={t.id} className="task-row">
              <label className="task">
                <input type="checkbox" checked={t.completed} onChange={(e) => onToggle(t.id, e.target.checked)} />
                <span className={t.completed ? "done" : ""}>{t.title}</span>
                {t.estimatedMinutes ? <span className="muted small">· {fmtMins(t.estimatedMinutes)}</span> : null}
              </label>
              <button className="btn ghost small-btn" onClick={() => (expanded === t.id ? setExpanded(null) : expand(t))}>
                {expanded === t.id ? "Hide" : "Details"}
              </button>
              <input
                className="inline-note"
                placeholder="task note…"
                defaultValue={t.notes}
                key={`${t.id}-${t.notes}`}
                onBlur={(e) => { if (e.target.value !== t.notes) onTaskNotes(t.id, e.target.value); }}
              />
              {expanded === t.id && (
                <div className="task-details">
                  <textarea
                    className="notes" rows={2} placeholder="Task details…"
                    aria-label={`Details for ${t.title}`}
                    value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  />
                  <div className="row">
                    <label className="muted small">Minutes <input type="number" className="text mins-input" min={0}
                      aria-label={`Estimated minutes for ${t.title}`}
                      value={editMins} onChange={(e) => setEditMins(e.target.value)} /></label>
                    <button className="btn primary" onClick={saveDetails}>Save details</button>
                    <button className="btn ghost" onClick={() => setExpanded(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      {day.resources.length > 0 && (
        <section>
          <div className="kicker">RESOURCES</div>
          {day.resources.map((res) => (
            <button key={res.id} className="link" onClick={() => openUrl(res.url)} title={res.url}>
              → {res.title || res.url}
            </button>
          ))}
        </section>
      )}
      <section>
        <div className="kicker">NOTES</div>
        <textarea
          className="notes"
          placeholder="Add notes… (Markdown-friendly, stored locally)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== day.notes) onNotes(day.id, notes); }}
          rows={5}
        />
      </section>
      <div className="row">
        <button className="btn primary" onClick={() => onCompleteDay(day.id)}>Complete day</button>
        <button className="btn" onClick={onPrev}>← Prev</button>
        <button className="btn" onClick={onNext}>Next →</button>
        <button className="btn ghost danger" onClick={() => {
          if (window.confirm(`Reset Day ${day.dayNumber} (“${day.topic}”)? ${done} completed task(s) will become unchecked. Notes stay.`)) onResetDay(day.id);
        }}>Reset day</button>
      </div>
    </div>
  );
}

function CalendarView({ plan, openDay }: { plan: FullPlan; openDay: (n: number) => void }) {
  return (
    <div>
      <h1>Calendar</h1>
      <div className="kicker">ACTIVITY — 30 DAYS</div>
      <Graph plan={plan} openDay={openDay} big />
      <table className="cal">
        <thead><tr><th>Date</th><th>Day</th><th>Topic</th><th>Done</th><th>Status</th></tr></thead>
        <tbody>
          {plan.days.map((d) => {
            const r = dayProgress(d);
            const done = d.tasks.filter((t) => t.completed).length;
            return (
              <tr key={d.id} onClick={() => openDay(d.dayNumber)} className="cal-row">
                <td className="muted">{fmtDate(d.date)}</td>
                <td>{d.dayNumber}</td>
                <td>{d.topic}</td>
                <td>{Math.round(r * 100)}%</td>
                <td>{r === 1 ? "✓ done" : done > 0 ? "… in progress" : "○ todo"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProgressView({ plan, stats, openDay }: { plan: FullPlan; stats: Stats; openDay: (n: number) => void }) {
  const best = plan.days.reduce<FullDay | null>((b, d) => (!b || dayProgress(d) > dayProgress(b) ? d : b), null);
  const rows: [string, string][] = [
    ["Overall completion", `${Math.round(stats.pct * 100)}%`],
    ["Tasks completed", `${stats.done} / ${stats.total}`],
    ["Tasks remaining", `${stats.total - stats.done}`],
    ["Days completed", `${stats.daysDone} / ${plan.days.length}`],
    ["Current streak", plural(stats.current, "day")],
    ["Longest streak", plural(stats.longest, "day")],
    ["Estimated learning time", fmtMins(stats.mins)],
    ["Most productive day", best ? `Day ${best.dayNumber} — ${best.topic}` : "—"],
  ];
  return (
    <div>
      <h1>Progress</h1>
      <Progress pct={stats.pct} />
      <table className="cal">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="muted">{k}</td>
              <td>{k === "Most productive day" && best ? <button className="link" onClick={() => openDay(best.dayNumber)}>{v}</button> : v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsView({ theme, setTheme, plan, dfmt, onDfmt, onNotes, onRename, onReset, onDelete, onExport }: {
  theme: string; setTheme: (t: "dark" | "light") => void; plan: FullPlan | null;
  dfmt: DateFmt; onDfmt: (f: DateFmt) => void;
  onNotes: (n: string) => void; onRename: (n: string) => void;
  onReset: () => void; onDelete: () => void; onExport: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  useEffect(() => setName(plan?.name ?? ""), [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rem, setRem] = useState(loadPrefs);
  const [remDenied, setRemDenied] = useState(false);
  useEffect(() => { isPermissionGranted().then((g) => setRemDenied(!g)).catch(() => {}); }, []);
  const toggleRem = async (on: boolean) => {
    if (on) {
      const ok = (await isPermissionGranted().catch(() => false)) || (await requestPermission().catch(() => "denied")) === "granted";
      setRemDenied(!ok);
      if (!ok) return;
    }
    const next = { ...rem, enabled: on };
    setRem(next);
    savePrefs(next);
  };
  return (
    <div>
      <h1>{plan ? "Plan settings" : "Settings"}</h1>
      {plan && (
      <section>
        <div className="kicker">PLAN</div>
        <div className="row">
          <input className="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" />
          <button className="btn" disabled={!name.trim() || name === plan.name} onClick={() => onRename(name.trim())}>Rename</button>
        </div>
        <div className="kicker">PLAN NOTES</div>
        <textarea className="notes" defaultValue={plan.notes} key={plan.id} rows={3}
          onBlur={(e) => { if (e.target.value !== plan.notes) onNotes(e.target.value); }} />
      </section>
      )}
      <section>
        <div className="kicker">APPEARANCE</div>
        <div className="row" role="radiogroup" aria-label="Appearance">
          {(["dark", "light"] as const).map((t) => (
            <button key={t} className={`btn${theme === t ? " primary" : ""}`} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
        <div className="kicker">DATE FORMAT</div>
        <div className="row" role="radiogroup" aria-label="Date format">
          {(["md", "dmy", "iso"] as const).map((f) => (
            <button key={f} className={`btn${dfmt === f ? " primary" : ""}`} onClick={() => onDfmt(f)}>
              {f === "md" ? "Sep 22" : f === "dmy" ? "22 Sep" : "2026-09-22"}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="kicker">REMINDERS</div>
        <label className="task">
          <input type="checkbox" checked={rem.enabled} onChange={(e) => toggleRem(e.target.checked)} />
          <span>Daily reminder</span>
        </label>
        <div className="row">
          <label className="muted small">Time <input type="time" value={rem.time}
            onChange={(e) => { const next = { ...rem, time: e.target.value }; setRem(next); savePrefs(next); }} /></label>
        </div>
        {remDenied && rem.enabled && <p className="muted small">Notifications are blocked — allow them in Windows Settings to receive reminders.</p>}
        <p className="muted small">Fires once a day while the app is open and tasks remain.</p>
      </section>
      {plan && (
      <section>
        <div className="kicker">BACKUP</div>
        <div className="row"><button className="btn" onClick={onExport}>Export timetable / JSON</button></div>
      </section>
      )}
      {plan && (
      <section>
        <div className="kicker">DANGER ZONE</div>
        <div className="row">
          <button className="btn ghost" onClick={onReset}>Reset progress</button>
          <button className="btn ghost danger" onClick={onDelete}>Delete plan</button>
        </div>
      </section>
      )}
      <p className="muted small">30Day v1.1.0 — local-first. Data lives in SQLite (<code>thirtyday.db</code>); no account, no network needed.</p>
    </div>
  );
}

function useImport(text: string) {
  return useMemo(() => {
    if (!text.trim()) return { plan: null as LearningPlan | null, errors: [] as ParseIssue[] };
    return parseTimetable(text);
  }, [text]);
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (id: string) => void }) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const { plan, errors } = useImport(text);

  const tryClose = useCallback(() => {
    if (text.trim() && !window.confirm("Discard this timetable text? Nothing has been imported yet.")) return;
    onClose();
  }, [text, onClose]);

  // Guard Escape while text is unsaved (App's handler closes modals unconditionally)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && text.trim()) {
        e.stopPropagation();
        tryClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [text, tryClose]);
  const byDay = useMemo(() => {
    const m = new Map<number | string, ParseIssue[]>();
    for (const e of errors) {
      const k = e.day ?? "general";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()].sort((a, b) => (typeof a[0] === "number" && typeof b[0] === "number" ? a[0] - b[0] : 0));
  }, [errors]);

  const doImport = async () => {
    if (!plan) return;
    setBusy(true);
    setImportError(null);
    try {
      const id = await createPlan(plan, start);
      await onImported(id);
    } catch (e) {
      setImportError(`Could not save the plan: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={tryClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import timetable">
        <h2>New plan from timetable</h2>
        <div className="row">
          <label className="muted small">Start date <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <button className="btn ghost" onClick={() => {
            if (text.trim() && !window.confirm("Replace the current timetable text with the demo?")) return;
            setText(demoTimetable());
          }}>Load demo timetable</button>
          <button className="btn ghost" title="Copy a prompt you can give to any AI to generate a timetable for this app"
            onClick={async () => { await navigator.clipboard.writeText(AI_PROMPT); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 1500); }}
          >{copiedPrompt ? "Prompt copied ✓" : "Copy AI prompt"}</button>
        </div>
        <textarea
          className="notes import-box"
          placeholder={"PLAN: My 30-Day Challenge\nDURATION: 30 days\n\nDAY 1\nTOPIC: …\nGOAL: …\nTIME: 3h\n\nTASKS:\n- …\n\nRESOURCES:\n- https://…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
        />
        {text.trim() && errors.length > 0 && (
          <div className="errors">
            <div className="kicker">IMPORT FAILED — {errors.length} ISSUE(S)</div>
            {byDay.map(([day, list]) => (
              <div key={String(day)}>
                <strong>{typeof day === "number" ? `Day ${day}` : "General"}</strong>
                <ul>{list.map((e, i) => <li key={i}>{e.message}{e.line ? ` (line ${e.line})` : ""}</li>)}</ul>
              </div>
            ))}
            <p className="muted small">Fix these issues and try again. Nothing was imported.</p>
          </div>
        )}
        {plan && (
          <div className="preview">
            <div className="kicker">IMPORT PREVIEW</div>
            <p><strong>{plan.name}</strong> — {plan.days.length} days · {plan.days.reduce((n, d) => n + d.tasks.length, 0)} tasks · ⏱ {fmtMins(plan.days.reduce((n, d) => n + (d.estimatedMinutes ?? 0), 0))}</p>
            <ul className="preview-list">
              {plan.days.map((d) => (
                <li key={d.id}><span className="muted">Day {d.dayNumber}</span> {d.topic} <span className="muted">· {d.tasks.length} tasks</span></li>
              ))}
            </ul>
          </div>
        )}
        <div className="row">
          <button className="btn ghost" onClick={tryClose}>Cancel</button>
          <button className="btn primary" disabled={!plan || busy} onClick={doImport}>{busy ? "Importing…" : "Import plan"}</button>
        </div>
        {importError && <div className="errors" role="alert"><strong>Import failed.</strong><div>{importError}</div></div>}
      </div>
    </div>
  );
}

function ExportModal({ plan, onClose }: { plan: FullPlan; onClose: () => void }) {
  const [tab, setTab] = useState<"timetable" | "json">("timetable");
  const text = tab === "timetable"
    ? exportTimetable(plan)
    : JSON.stringify({ ...plan, exportedAt: new Date().toISOString() }, null, 2);
  const [copied, setCopied] = useState(false);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export plan">
        <h2>Export — {plan.name}</h2>
        <div className="row">
          <button className={`btn${tab === "timetable" ? " primary" : ""}`} onClick={() => setTab("timetable")}>Timetable</button>
          <button className={`btn${tab === "json" ? " primary" : ""}`} onClick={() => setTab("json")}>JSON</button>
          <button
            className="btn ghost"
            onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <textarea className="notes import-box" readOnly value={text} rows={14} />
        <p className="muted small">Paste timetable text back into Import to restore. JSON is a full backup.</p>
        <div className="row"><button className="btn ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
