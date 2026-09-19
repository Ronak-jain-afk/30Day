import { describe, expect, it } from "vitest";
import {
  computeStreaks,
  dayProgress,
  exportTimetable,
  intensityLevel,
  parseTimeToMinutes,
  parseTimetable,
} from "./timetable";
import { demoTimetable } from "./demo";

const mini = (body: string) =>
  `PLAN: Mini\nDURATION: 30 days\n\n` +
  Array.from({ length: 30 }, (_, i) => `DAY ${i + 1}\nTOPIC: Topic ${i + 1}\nTIME: 1h\n\nTASKS:\n- Task A\n- Task B${body.includes("RES") ? "\n\nRESOURCES:\n- https://example.com/x" : ""}`).join("\n\n");

describe("time parsing", () => {
  it("handles h/m variants", () => {
    expect(parseTimeToMinutes("3h")).toBe(180);
    expect(parseTimeToMinutes("90m")).toBe(90);
    expect(parseTimeToMinutes("2.5h")).toBe(150);
    expect(parseTimeToMinutes("1h30m")).toBe(90);
    expect(parseTimeToMinutes("1h 30m")).toBe(90);
    expect(parseTimeToMinutes("three hours")).toBeNull();
  });
});

describe("parser", () => {
  it("imports a valid 30-day timetable", () => {
    const { plan, errors } = parseTimetable(mini(""));
    expect(errors).toEqual([]);
    expect(plan?.days).toHaveLength(30);
    expect(plan?.days[0].tasks).toHaveLength(2);
  });

  it("demo timetable parses cleanly", () => {
    const { plan, errors } = parseTimetable(demoTimetable());
    expect(errors).toEqual([]);
    expect(plan?.days).toHaveLength(30);
  });

  it("detects missing PLAN, duplicate days, missing topic, bad time, bad url", () => {
    const bad = mini("").replace("PLAN: Mini\n", "").replace("TOPIC: Topic 5\n", "").replace("DAY 6\n", "DAY 5\n").replace("TIME: 1h", "TIME: three hours").replace("DAY 7\n", "DAY 7\n");
    const withUrl = bad.replace("DAY 8\nTOPIC: Topic 8", "DAY 8\nTOPIC: Topic 8\n\nRESOURCES:\n- not-a-url");
    const { plan, errors } = parseTimetable(withUrl);
    expect(plan).toBeNull();
    const msgs = errors.map((e) => e.message).join("\n");
    expect(msgs).toMatch(/Missing PLAN/);
    expect(msgs).toMatch(/duplicate day number/);
    expect(msgs).toMatch(/missing TOPIC/i);
    expect(msgs).toMatch(/invalid TIME/);
    expect(msgs).toMatch(/invalid URL/);
  });

  it("rejects invalid task bullet format", () => {
    const bad = mini("").replace("- Task A", "18. SQL Injection");
    const { plan, errors } = parseTimetable(bad);
    expect(plan).toBeNull();
    expect(errors.some((e) => /invalid task format/.test(e.message))).toBe(true);
  });

  it("roundtrips import → export → import", () => {
    const first = parseTimetable(demoTimetable());
    expect(first.plan).not.toBeNull();
    const second = parseTimetable(exportTimetable(first.plan!));
    expect(second.errors).toEqual([]);
    expect(second.plan?.days.map((d) => [d.topic, d.tasks.map((t) => t.title)])).toEqual(
      first.plan?.days.map((d) => [d.topic, d.tasks.map((t) => t.title)]),
    );
  });
});

describe("progress", () => {
  it("computes ratios and intensity levels", () => {
    expect(dayProgress({ tasks: [{ completed: true }, { completed: false }] })).toBe(0.5);
    expect([0, 0.1, 0.3, 0.6, 0.8, 1].map(intensityLevel)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("computes current/longest streaks", () => {
    const days = [
      { date: "2026-09-18", completions: 2 },
      { date: "2026-09-19", completions: 1 },
      { date: "2026-09-17", completions: 0 },
      { date: "2026-09-15", completions: 3 },
      { date: "2026-09-16", completions: 1 },
    ];
    expect(computeStreaks(days, "2026-09-19T12:00:00Z")).toEqual({ current: 2, longest: 2 });
    expect(computeStreaks(days, "2026-09-20T12:00:00Z").current).toBe(2); // today untouched keeps streak
  });
});
