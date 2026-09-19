import { describe, expect, it } from "vitest";
import { AI_PROMPT } from "./ai-prompt";

// Guards the contract between the in-app AI prompt and the parser:
// every token the prompt promises must be something parseTimetable accepts.
describe("AI prompt", () => {
  it("documents the exact import format", () => {
    for (const token of ["[TOPIC]", "DAY 1", "DAY 30", "TOPIC:", "GOAL:", "TIME:", "TASKS:", "RESOURCES:", "- ", "2h", "90m", "1h30m", "https://", "WRONG", "[Blender Manual](https://"]) {
      expect(AI_PROMPT).toContain(token);
    }
    expect(AI_PROMPT).toMatch(/code fences/i);
  });
});
