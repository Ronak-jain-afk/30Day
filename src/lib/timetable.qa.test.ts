import { describe, expect, it } from "vitest";
import {
  computeStreaks,
  dayProgress,
  exportTimetable,
  parseTimetable,
  rangeList,
} from "./timetable";

/** Build a valid 30-day timetable with per-day overrides. */
function build(
  n = 30,
  day: (i: number) => string = (i) => `DAY ${i}\nTOPIC: Topic ${i}\nTIME: 1h\n\nTASKS:\n- Task A\n- Task B`,
  head = "PLAN: QA\nDURATION: 30 days\n\n",
) {
  return head + Array.from({ length: n }, (_, k) => day(k + 1)).join("\n\n");
}
const msgs = (t: string) => parseTimetable(t).errors.map((e) => e.message).join("\n");

describe("whitespace tolerance", () => {
  it("accepts lowercase, tabs, leading spaces, space-before-colon", () => {
    const t = "  plan :  Spaced  \n\n\nduration:30 days\n\n\tday 1\ntopic : T1\ngoal: G\ntime: 2h\n\ntasks:\n- a\n\nresources:\n- https://example.com/a\n\n" +
      Array.from({ length: 29 }, (_, k) => `DAY ${k + 2}\nTOPIC: T${k + 2}\nTASKS:\n- a`).join("\n\n");
    const { plan, errors } = parseTimetable(t);
    expect(errors).toEqual([]);
    expect(plan?.name).toBe("Spaced");
    expect(plan?.days[0].estimatedMinutes).toBe(120);
  });

  it("accepts CRLF and extra blank lines", () => {
    const t = build().replace(/\n/g, "\r\n").replace(/TASKS:/g, "\n\n\nTASKS:\n\n");
    expect(parseTimetable(t).errors).toEqual([]);
  });

  it("accepts days out of order and normalizes them", () => {
    const days = Array.from({ length: 30 }, (_, k) => 30 - k);
    const t = "PLAN: QA\n\n" + days.map((i) => `DAY ${i}\nTOPIC: T${i}\nTASKS:\n- a`).join("\n\n");
    const { plan, errors } = parseTimetable(t);
    expect(errors).toEqual([]);
    expect(plan?.days.map((d) => d.dayNumber)).toEqual(Array.from({ length: 30 }, (_, k) => k + 1));
  });
});

describe("validation failures", () => {
  it("flags malformed DAY headers instead of dropping them", () => {
    const { plan, errors } = parseTimetable(build(30, (i) => (i === 4 ? "DAY four\nTOPIC: T4\nTASKS:\n- a" : `DAY ${i}\nTOPIC: T${i}\nTASKS:\n- a`)));
    expect(plan).toBeNull();
    expect(errors.map((e) => e.message).join("\n")).toMatch(/DAY four/);
  });

  it("flags inline TASKS:/RESOURCES: content instead of dropping it", () => {
    const t = build(30, (i) =>
      i === 2 ? `DAY 2\nTOPIC: T2\nTASKS: - inline task\n\nRESOURCES: https://example.com/x` : `DAY ${i}\nTOPIC: T${i}\nTASKS:\n- a`,
    );
    const { plan, errors } = parseTimetable(t);
    expect(plan).toBeNull();
    expect(errors.map((e) => e.message).join("\n")).toMatch(/TASKS/);
  });

  it("rejects 31 days and 29 days", () => {
    expect(parseTimetable(build(31)).plan).toBeNull();
    expect(msgs(build(31))).toMatch(/invalid day number|exactly 30/);
    const missing = parseTimetable(build(29));
    expect(missing.plan).toBeNull();
    expect(missing.errors.map((e) => e.message).join("\n")).toMatch(/Missing days 30/);
  });

  it("rejects bad URLs and bad TIME with line numbers", () => {
    const t = build(30, (i) =>
      i === 3 ? `DAY 3\nTOPIC: T3\nTIME: whenever\nTASKS:\n- a\n\nRESOURCES:\n- ftp://example.com/x\n- not a url` : `DAY ${i}\nTOPIC: T${i}\nTASKS:\n- a`,
    );
    const { plan, errors } = parseTimetable(t);
    expect(plan).toBeNull();
    const timeLine = t.split("\n").findIndex((l) => l.includes("whenever")) + 1;
    expect(errors.some((e) => /TIME/.test(e.message) && e.line === timeLine)).toBe(true);
    expect(errors.filter((e) => /URL/.test(e.message))).toHaveLength(2);
  });

  it("handles long names, many tasks, many resources", () => {
    const longTopic = "T".repeat(300);
    const longTask = "x".repeat(500);
    const tasks = Array.from({ length: 12 }, (_, k) => `- ${longTask}-${k}`).join("\n");
    const res = Array.from({ length: 5 }, (_, k) => `- R${k} | https://example.com/r${k}`).join("\n");
    const t = build(30, (i) =>
      i === 1 ? `DAY 1\nTOPIC: ${longTopic}\nTASKS:\n${tasks}\n\nRESOURCES:\n${res}` : `DAY ${i}\nTOPIC: T${i}\nTASKS:\n- a`,
    );
    const { plan, errors } = parseTimetable(t);
    expect(errors).toEqual([]);
    expect(plan?.days[0].tasks).toHaveLength(12);
    expect(plan?.days[0].resources).toHaveLength(5);
    expect(plan?.days[0].resources[0]).toMatchObject({ title: "R0", url: "https://example.com/r0" });
  });

  it("labels TIME outside any DAY block clearly", () => {
    const t = "PLAN: QA\nTIME: 3h\n\n" + Array.from({ length: 30 }, (_, k) => `DAY ${k + 1}\nTOPIC: T${k + 1}\nTASKS:\n- a`).join("\n\n");
    const { errors } = parseTimetable(t);
    expect(errors.some((e) => /outside any DAY/.test(e.message))).toBe(true);
  });
});

describe("missing-day ranges", () => {
  it("collapses consecutive missing days", () => {
    expect(rangeList([2, 4, 5, 6, 30])).toBe("2, 4–6, 30");
    const { errors } = parseTimetable(build(29));
    expect(errors.some((e) => e.message === "Missing days 30 (expected days 1–30; found 29 DAY block(s))")).toBe(true);
  });
});

describe("progress fractions", () => {  it.each([
    [0, 0], [1, 0.2], [2, 0.4], [3, 0.6], [4, 0.8], [5, 1],
  ])("%i/5 = %s", (done, pct) => {
    const tasks = Array.from({ length: 5 }, (_, k) => ({ completed: k < done }));
    expect(dayProgress({ tasks })).toBe(pct);
  });
});

describe("streak edge cases", () => {
  const D = (date: string, completions: number) => ({ date, completions });
  it("today only → current 1", () => {
    expect(computeStreaks([D("2026-09-19", 1)], "2026-09-19T12:00:00Z")).toEqual({ current: 1, longest: 1 });
  });
  it("skip yesterday → current counts only contiguous run", () => {
    const days = [D("2026-09-17", 1), D("2026-09-19", 1)];
    expect(computeStreaks(days, "2026-09-19T12:00:00Z")).toEqual({ current: 1, longest: 1 });
  });
  it("uncompleting the only task breaks the streak", () => {
    const days = [D("2026-09-18", 1), D("2026-09-19", 0)];
    expect(computeStreaks(days, "2026-09-19T12:00:00Z")).toEqual({ current: 1, longest: 1 });
  });
  it("multiple completions in one day count once", () => {
    const days = [D("2026-09-18", 5), D("2026-09-19", 3)];
    expect(computeStreaks(days, "2026-09-19T12:00:00Z")).toEqual({ current: 2, longest: 2 });
  });
  it("old-day completion feeds longest, not current", () => {
    const days = [D("2026-09-10", 1), D("2026-09-11", 1), D("2026-09-12", 1), D("2026-09-19", 1)];
    expect(computeStreaks(days, "2026-09-19T12:00:00Z")).toEqual({ current: 1, longest: 3 });
  });
});

describe("export roundtrip fidelity", () => {
  it("preserves order, goals, times, resources", () => {
    const t = build(30, (i) =>
      `DAY ${i}\nTOPIC: T${i}\nGOAL: G${i}\nTIME: 1h30m\nTASKS:\n- first\n- second\n\nRESOURCES:\n- R1 | https://example.com/${i}a\n- https://example.com/${i}b`,
    );
    const first = parseTimetable(t);
    expect(first.errors).toEqual([]);
    const second = parseTimetable(exportTimetable(first.plan!));
    expect(second.errors).toEqual([]);
    const a = first.plan!.days[6];
    const b = second.plan!.days[6];
    expect(b.topic).toBe(a.topic);
    expect(b.goal).toBe(a.goal);
    expect(b.estimatedMinutes).toBe(a.estimatedMinutes);
    expect(b.tasks.map((x) => x.title)).toEqual(a.tasks.map((x) => x.title));
    expect(b.resources).toEqual(a.resources.map((r) => ({ ...r, id: expect.any(String) })));
  });
});
