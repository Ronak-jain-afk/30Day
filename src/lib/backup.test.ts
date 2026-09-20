import { describe, expect, it } from "vitest";
import { fullPlanFromBackup } from "./backup";

const good = {
  name: "Backup Plan",
  startDate: "2026-09-19",
  notes: "plan note",
  days: [
    {
      id: "old-id", dayNumber: 2, date: "2026-09-20", topic: "T2",
      goal: "G2", estimatedMinutes: 60, notes: "day note",
      tasks: [
        { id: "t", title: "A", description: "desc", estimatedMinutes: 15, completed: true, completedAt: "x", notes: "n" },
        { title: "B", completed: false },
      ],
      resources: [{ id: "r", url: "https://example.com/a", title: "R" }],
    },
    { dayNumber: 1, topic: "T1", tasks: [], resources: [] },
  ],
  exportedAt: "2026-09-19T00:00:00Z",
};

describe("backup restore", () => {
  it("maps exported JSON, sorts days, drops stale ids", () => {
    const b = fullPlanFromBackup(JSON.parse(JSON.stringify(good)));
    expect(b.name).toBe("Backup Plan");
    expect(b.days.map((d) => d.dayNumber)).toEqual([1, 2]);
    expect(b.days[1].tasks[0]).toMatchObject({ title: "A", completed: true, estimatedMinutes: 15 });
    expect(b.days[1].resources).toEqual([{ url: "https://example.com/a", title: "R" }]);
  });

  it("rejects bad shapes with useful messages", () => {
    expect(() => fullPlanFromBackup({})).toThrow(/plan name/);
    expect(() => fullPlanFromBackup({ name: "x", startDate: "yesterday", days: [] })).toThrow(/startDate/);
    expect(() => fullPlanFromBackup({ name: "x", startDate: "2026-09-19", days: [] })).toThrow(/no days/);
    expect(() => fullPlanFromBackup({
      name: "x", startDate: "2026-09-19",
      days: [{ dayNumber: 1, topic: "T", tasks: [{ title: "A", completed: false }], resources: [{ url: "notaurl" }] }],
    })).toThrow(/invalid URL/);
    expect(() => fullPlanFromBackup({
      name: "x", startDate: "2026-09-19",
      days: [
        { dayNumber: 1, topic: "T", tasks: [], resources: [] },
        { dayNumber: 1, topic: "U", tasks: [], resources: [] },
      ],
    })).toThrow(/duplicate/);
  });
});
