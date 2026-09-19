# 30Day — Learning Tracker

A polished, lightweight, **local-first desktop app** that turns any structured
30-day learning timetable into an interactive task-tracking system — with
progress stats, streaks, and a GitHub-style 30-day activity graph.

No account. No server. No cloud. Everything lives in SQLite on your machine
and works fully offline.

![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![stack](https://img.shields.io/badge/stack-Tauri%20v2%20%C2%B7%20React%20%C2%B7%20Rust%20%C2%B7%20SQLite-green)

## Install

Download **`30Day_1.0.0_x64-setup.exe`** (or the `.msi`) from the
[latest release](https://github.com/Ronak-jain-afk/30Day/releases) and run it.
No admin rights required for the NSIS installer.

> Your data lives in `%APPDATA%\com.thirtyday.app\thirtyday.db`.
> Back it up any time via **Settings → Export timetable / JSON**.

## The core loop

```
Open app → see today's day → see today's tasks → complete tasks
→ watch progress update → see the graph fill → close → return tomorrow
```

## Features

- **Import any 30-day timetable** — paste a human-readable plan, get instant
  validation with day/line-specific errors, a preview, then Days 1–30
- **Day view** — topic, goal, time estimate, checkable tasks, task notes,
  resource links (open in your browser), day notes
- **Dashboard** — overall %, tasks done/remaining, current + longest streak,
  today's tasks, 30-day activity graph, up-next preview
- **Calendar & Progress views** — per-day completion table, totals, averages,
  most productive day
- **Streaks without gamification pressure** — a day counts with ≥ 1 completed
  task; missing a day just breaks the run, nothing punishes you
- **Multiple plans** — create, switch, rename, reset, delete (with confirmation)
- **Export roundtrip** — export back to the exact timetable format and re-import
  losslessly; JSON export for full backups
- **Dark / light themes**, keyboard navigation (←/→ days, Esc closes dialogs)

## Timetable syntax

```text
PLAN: My 30-Day Challenge
DURATION: 30 days

DAY 1
TOPIC: Linux Fundamentals
GOAL: Get comfortable in the terminal
TIME: 3h

TASKS:
- Learn filesystem navigation
- Practice 20 terminal commands

RESOURCES:
- https://example.com/linux
- Linux guide | https://example.com/guide
```

Rules: exactly 30 `DAY n` blocks (1–30, no duplicates) · every day needs
`TOPIC:` and at least one `- task` · `TIME:` accepts `3h`, `90m`, `1h30m` ·
resources are `- URL` or `- Title | URL` (http/https only) · blank lines and
whitespace are free · out-of-order days are normalized on import.

## Development

```powershell
npm install
npm run tauri dev   # desktop app with live SQLite
npm test            # vitest: parser, validation, roundtrip, streaks
npm run build       # frontend bundle only
npm run tauri build # Windows installers (.msi + NSIS .exe)
```

Requires Node 22+ and a Rust toolchain.

## Architecture

```
TIMETABLE → PARSER → LEARNING PLAN → DAYS → TASKS → PROGRESS → ACTIVITY GRAPH
```

| Layer | Location | Notes |
|---|---|---|
| Timetable parser + validation + export + streak math | `src/lib/timetable.ts` | Framework-free, fully unit-tested |
| SQLite access | `src/lib/db.ts` | Thin wrapper over `@tauri-apps/plugin-sql` (`sqlite:thirtyday.db`) |
| UI | `src/App.tsx` | Sidebar, dashboard, day, calendar, progress, settings, import/export |
| Demo data | `src/lib/demo.ts` | 30-day lab plan (legal practice environments only) |
| Desktop shell | `src-tauri/` | Registers `tauri-plugin-sql` + one squashed migration; no custom Tauri commands in v1 |

Database tables: `plans → days → tasks` plus `resources`; notes live on each
row; foreign keys with `ON DELETE CASCADE`. One migration (`init`) in
`src-tauri/src/lib.rs`. Every mutation persists immediately — the app survives
closing, restarting, and crashes without losing progress.

## Security & privacy

Local-only by design: imported data is validated, URLs are checked, SQL uses
parameterized queries, Tauri capabilities are minimal
(`core` + `opener` + `sql` execute/select/load), and there is no analytics,
telemetry, or network access beyond the links you click.

## License

MIT — see `LICENSE` (to be added).
