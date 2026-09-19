import { describe, expect, it } from "vitest";
import { localYmd, reminderDue } from "./reminders";

const at = (hm: string, ymd = "2026-09-22") =>
  new Date(`${ymd}T${hm}:00`);

describe("reminderDue", () => {
  it("fires at the configured minute when work remains", () => {
    expect(reminderDue({ enabled: true, time: "09:00" }, at("09:00"), null, true)).toBe(true);
  });
  it("stays quiet off-minute, when disabled, or when done", () => {
    expect(reminderDue({ enabled: true, time: "09:00" }, at("09:01"), null, true)).toBe(false);
    expect(reminderDue({ enabled: false, time: "09:00" }, at("09:00"), null, true)).toBe(false);
    expect(reminderDue({ enabled: true, time: "09:00" }, at("09:00"), null, false)).toBe(false);
  });
  it("fires at most once per day", () => {
    expect(reminderDue({ enabled: true, time: "09:00" }, at("09:00"), "2026-09-22", true)).toBe(false);
    expect(reminderDue({ enabled: true, time: "09:00" }, at("09:00", "2026-09-23"), "2026-09-22", true)).toBe(true);
  });
  it("formats local dates", () => {
    expect(localYmd(new Date(2026, 8, 22, 9, 0))).toBe("2026-09-22");
  });
});
