// Copy-paste prompt users can give to any AI to generate an importable timetable.
// ponytail: plain string constant; keep in sync with the parser rules in timetable.ts
export const AI_PROMPT = `Create a 30-day learning timetable about [TOPIC] for the 30Day desktop app.

YOUR OUTPUT IS MACHINE-PARSED. Treat the format below as a strict data
format, not as a style suggestion. AI assistants habitually output Markdown
(list markers, links, escaped characters) — every Markdown habit below will
cause an import failure, so suppress them all.

## OUTPUT RULES

- Output ONLY the timetable. No explanations, introductions, conclusions,
  comments, Markdown code fences, or any text before PLAN: or after DAY 30.
- PLAIN TEXT ONLY. It is forbidden to output:
  - list markers other than "- " (never "*", never "1.", never backslash-star)
  - Markdown links: never write [Title](https://…). Write "- Title | https://…" instead.
  - backslash escapes anywhere: never write \\*, \\&, \\_, \\[, \\]. Write the plain character.
  - bold, italics, headings, or any other Markdown formatting.
- Before responding, silently validate your timetable against every rule
  below and fix any violation before outputting.

## REQUIRED FORMAT

PLAN: <a short plan name>
DURATION: 30 days

DAY 1
TOPIC: <day topic>
GOAL: <one-sentence goal>
TIME: 3h

TASKS:
- <task 1>
- <task 2>
- <task 3>

RESOURCES:
- https://<real, working URL>
- <Title> | https://<real, working URL>

DAY 2
TOPIC: <day topic>
GOAL: <one-sentence goal>
TIME: 2h

TASKS:
- <task 1>
- <task 2>
- <task 3>

RESOURCES:
- https://<real, working URL>

Repeat the same structure through DAY 30.

## STRICT RULES

- Exactly one PLAN: line; DURATION: must be exactly "30 days".
- Exactly 30 DAY blocks: DAY 1 through DAY 30, each exactly once, in order.
  Never DAY 0 or DAY 31, never a duplicate, never a skipped number.
- Every day MUST have TOPIC: (non-empty), GOAL:, TIME:, and a TASKS: section.
- Every task is exactly one line starting with "- " (hyphen + space).
  One task per line. No numbered lists. No "*" bullets.
- TIME: must look like 3h, 2h, 90m, or 1h30m. Never "3 hours", "3 hrs",
  "about 3h", or any other wording.
- RESOURCES: is optional per day. If present, every line must contain the
  bare URL, never wrapped in a Markdown link. Compare:
    RIGHT: - https://docs.blender.org/manual/en/latest/
    RIGHT: - Blender Manual | https://docs.blender.org/manual/en/latest/
    WRONG: - [Blender Manual](https://docs.blender.org/manual/en/latest/)
    WRONG: - [https://docs.blender.org/manual/en/latest/](https://docs.blender.org/manual/en/latest/)
  Never invent a URL: if you are not confident a resource URL is real and
  currently available, omit that resource.
- Never use "<" or ">" placeholders in the final output.

## CONTENT

- Design a coherent progression for [TOPIC]: Days 1–7 fundamentals,
  Days 8–14 core concepts and tools, Days 15–21 intermediate practical work,
  Days 22–27 advanced applications, Days 28–29 integrated projects/review,
  Day 30 final assessment. Adjust only if the topic demands it.
- Tasks must be concrete and actionable: read/understand X, practice X,
  build X, solve N problems, implement X, review X, test X.
- Never vague tasks: no "learn everything", no "study more", no bare "practice".

## FINAL SILENT CHECK

Verify before outputting: 30 DAY blocks, DAY 1–30 each exactly once, every
day has TOPIC:/GOAL:/TIME:/TASKS: with at least one "- " task, every TIME
matches 3h/2h/90m/1h30m style, every resource matches "- …https://…",
zero Markdown (*, #, [, ], backslashes), zero text outside the timetable.
Fix violations silently, then output.

Now generate the timetable for: [TOPIC]`;
