\# Build Prompt: 30-Day Learning Tracker Desktop App



You are an expert desktop application engineer and UI/UX designer.



Build a polished, lightweight, local-first desktop application called \*\*30Day\*\* (working name) that lets users turn a structured 30-day learning timetable into an interactive TODO/tracking system.



The application must NOT be specialized for cybersecurity, programming, AI, or any particular field.



The user should be able to provide ANY 30-day learning plan — cybersecurity, mathematics, fitness, language learning, exam preparation, programming, etc. — in a format defined by the application.



The application parses that timetable and generates a 30-day task system.



\---



\# 1. Core Concept



The app revolves around this workflow:



1\. User creates a new 30-day plan.

2\. User enters/pastes a timetable using the app's defined format.

3\. The application parses the timetable.

4\. The application validates the timetable.

5\. The application creates Days 1–30.

6\. Each day contains:



&#x20;  \* Topic

&#x20;  \* Tasks

&#x20;  \* Optional subtasks

&#x20;  \* Goals

&#x20;  \* Estimated duration

&#x20;  \* Resources/links

&#x20;  \* Notes

7\. User completes tasks throughout the 30 days.

8\. The application tracks progress locally.

9\. The main dashboard visualizes activity in a GitHub-contribution-style calendar.

10\. User can reopen the application and continue exactly where they left off.



The app should feel like a serious developer tool rather than a generic productivity/to-do application.



\---



\# 2. Tech Stack



Use:



\* Tauri v2

\* React

\* TypeScript

\* Vite

\* Rust

\* SQLite



Use a lightweight architecture.



Do NOT use Electron.



Do NOT require an internet connection for core functionality.



Do NOT require an account.



Do NOT require a backend/server.



Do NOT require cloud storage.



Everything should work locally.



Prefer a clean SQLite abstraction rather than storing the entire application state in JSON.



\---



\# 3. Design Philosophy



The UI should feel similar to:



\* GitHub

\* Linear

\* Raycast

\* modern developer tools

\* minimalist technical dashboards



Avoid:



\* generic SaaS dashboard aesthetics

\* excessive gradients

\* giant rounded cards everywhere

\* excessive animations

\* AI-generated-looking UI

\* unnecessary illustrations

\* excessive colors

\* childish gamification



The application should look professional and restrained.



Use subtle animations and transitions.



The interface should feel fast.



\---



\# 4. Main Application Structure



Create these primary views:



\## Dashboard



The default screen.



Display:



\* Current plan

\* Current day

\* Overall completion percentage

\* Tasks completed

\* Tasks remaining

\* Current streak

\* Longest streak

\* Today's progress

\* 30-day contribution calendar

\* Today's tasks

\* Upcoming days

\* Recent activity



Example:



\---



30DAY



Cybersecurity Trainee — 30 Days



Day 12 / 30



██████████░░░░░░░░░░ 40%



12 days completed



Today's Progress



3 / 5 tasks



\[Continue Day 12]



\---



ACTIVITY



GitHub-style contribution graph



░ ░ ▒ ▓ █



30 days



\---



UP NEXT



Day 13

Web Authentication



Day 14

SQL Injection



\---



\# 5. GitHub-Style Contribution Calendar



This is one of the most important UI elements.



Create a contribution-style activity graph inspired by GitHub.



However, DO NOT copy GitHub's branding or exact UI.



Each day should be represented by a small square.



The intensity should represent completion.



For example:



0% → empty



1–24% → level 1



25–49% → level 2



50–74% → level 3



75–99% → level 4



100% → level 5



Hovering a day should display:



Day 14

SQL Injection



4 / 5 tasks completed



80%



Clicking the day opens that day's detail view.



Because this is specifically a 30-day application, make the graph optimized for a 30-day learning cycle rather than trying to replicate GitHub's entire year-long graph.



\---



\# 6. Day View



Each day should have its own page/panel.



Example:



DAY 12



Web Application Reconnaissance



Progress

████████░░ 80%



Tasks



\[x] Learn passive reconnaissance

\[x] Learn active reconnaissance

\[x] Study Nmap basics

\[ ] Perform reconnaissance lab

\[ ] Write notes



Estimated time

3 hours



Resources



→ PortSwigger

→ Nmap documentation



Notes



\[Add notes...]



Buttons:



\[Complete Day]



\[Previous Day]



\[Next Day]



Do NOT allow "Complete Day" to magically complete every task without confirmation.



If tasks remain incomplete, warn the user.



\---



\# 7. Task System



Every task should support:



\* title

\* description

\* completed state

\* estimated minutes

\* optional resource URL

\* optional notes

\* order

\* day association



Tasks should be individually checkable.



When a task is completed:



\* update SQLite

\* update day progress

\* update overall progress

\* update contribution graph

\* update streak



Everything should persist immediately.



\---



\# 8. Timetable Input Format



The user should NOT have to manually create 150 individual tasks through a GUI.



The main feature is importing a timetable.



Define a simple human-readable format.



Support something similar to:



```text

PLAN: Cybersecurity Trainee

DURATION: 30 days



DAY 1

TOPIC: Linux Fundamentals

GOAL: Become comfortable working in the Linux terminal

TIME: 3h



TASKS:

\- Learn filesystem navigation

\- Learn permissions

\- Learn users and groups

\- Practice 20 terminal commands

\- Complete a Linux beginner lab



RESOURCES:

\- https://example.com/linux

\- https://example.com/lab



DAY 2

TOPIC: Networking Fundamentals

GOAL: Understand TCP/IP fundamentals

TIME: 3h



TASKS:

\- Learn TCP/IP

\- Learn TCP vs UDP

\- Learn ports

\- Learn DNS

\- Capture traffic using Wireshark



RESOURCES:

\- https://example.com/networking

```



The parser must understand:



PLAN

DURATION

DAY

TOPIC

GOAL

TIME

TASKS

RESOURCES



Allow blank lines.



Allow flexible whitespace.



Do not make the parser dependent on exact indentation.



\---



\# 9. Parser



Create a dedicated timetable parser.



The parser should:



1\. Read raw text.

2\. Detect the plan name.

3\. Detect duration.

4\. Detect DAY blocks.

5\. Extract topic.

6\. Extract goal.

7\. Extract estimated time.

8\. Extract tasks.

9\. Extract resources.

10\. Validate the structure.

11\. Return structured data.



Use a strongly typed internal representation.



Example:



```ts

interface LearningPlan {

&#x20; id: string;

&#x20; name: string;

&#x20; durationDays: number;

&#x20; createdAt: string;

&#x20; days: LearningDay\[];

}



interface LearningDay {

&#x20; id: string;

&#x20; dayNumber: number;

&#x20; topic: string;

&#x20; goal?: string;

&#x20; estimatedMinutes?: number;

&#x20; tasks: Task\[];

&#x20; resources: Resource\[];

}



interface Task {

&#x20; id: string;

&#x20; title: string;

&#x20; description?: string;

&#x20; estimatedMinutes?: number;

&#x20; completed: boolean;

&#x20; completedAt?: string;

}



interface Resource {

&#x20; id: string;

&#x20; url: string;

}

```



The Rust backend should use equivalent strongly typed structures.



\---



\# 10. Validation



Before importing a timetable, validate it.



Detect:



\* missing PLAN

\* missing DAY

\* duplicate day numbers

\* missing topic

\* invalid day numbers

\* missing tasks

\* invalid URLs

\* malformed TIME values

\* fewer than 30 days

\* more than 30 days



Show useful errors.



Example:



```text

Import failed



Day 17:

Missing TOPIC



Day 21:

Duplicate day number



Day 24:

Invalid TIME format: "three hours"



Fix these issues and try again.

```



Do not silently modify the user's timetable.



\---



\# 11. Import Preview



After parsing but before saving:



Show:



```text

Import Preview



Cybersecurity Trainee



30 Days

146 Tasks

\~92 Hours



DAY 1

Linux Fundamentals

5 tasks



DAY 2

Networking Fundamentals

6 tasks



DAY 3

Web Fundamentals

4 tasks



...



DAY 30

Final Assessment

7 tasks



\[Cancel]



\[Import Plan]

```



This is important.



The user should be able to catch parser mistakes before creating the plan.



\---



\# 12. Plan Creation



Support:



\## New Plan



Fields:



Plan name



Start date



Duration



Timetable



The application should primarily target 30-day plans.



For v1, enforce exactly 30 days.



Design the data model so future versions can support:



\* 7 days

\* 14 days

\* 30 days

\* 60 days

\* custom durations



But do not over-engineer this for v1.



\---



\# 13. Start Date



Allow the user to select:



Start date:

\[ September 20, 2026 ]



Then map:



Day 1 → September 20

Day 2 → September 21

...



Day 30 → October 19



Store actual calendar dates in SQLite.



This allows the activity graph and streak system to work correctly.



\---



\# 14. Streak System



Track:



Current streak



Longest streak



A day counts toward a streak when the user completes at least one task.



Optionally allow a stricter "day completed" streak mode later.



Do NOT punish users aggressively for missing a day.



The application should be a tracker, not a dopamine-heavy gamification system.



\---



\# 15. Progress Calculation



Day progress:



completed tasks / total tasks



Overall progress:



completed tasks across the entire plan /

total tasks across the entire plan



Example:



45 / 150 tasks



30%



Contribution intensity should be based on daily completion percentage.



\---



\# 16. Navigation



Use a compact sidebar.



Example:



30DAY



Dashboard



Today



Plan



Calendar



Progress



Notes



Settings



\---



Current Plan



Cybersecurity Trainee



Day 12 / 30



The sidebar should remain compact.



Avoid wasting screen space.



\---



\# 17. Calendar



Create a dedicated calendar view.



Show:



\* Day number

\* Date

\* Topic

\* completion %

\* status



Example:



September 2026



20  Day 1   Linux          100%

21  Day 2   Networking      80%

22  Day 3   HTTP             0%

23  Day 4   Recon             0%



Clicking a day opens that day.



\---



\# 18. Progress Page



Show useful statistics:



Overall completion



Tasks completed



Tasks remaining



Days completed



Current streak



Longest streak



Total estimated learning time



Completed learning time



Average daily completion



Most productive day



Do NOT make meaningless statistics.



\---



\# 19. Notes



Allow notes at:



\* plan level

\* day level

\* task level



Notes should persist in SQLite.



Support basic Markdown if practical.



Do not build a full Notion clone.



\---



\# 20. Resource Links



Resources should be clickable.



Open links using the user's default browser.



Do not embed websites inside the application.



Store:



\* title if available

\* URL



If title isn't available, display the URL.



\---



\# 21. SQLite Database



Use SQLite for persistence.



Design sensible tables such as:



plans



days



tasks



resources



notes



activity



settings



Use foreign keys.



Use migrations.



Do not store everything as one giant JSON blob.



Every task completion should be persisted.



The application should survive:



\* closing

\* restarting

\* crashes

\* Windows restarts



without losing progress.



\---



\# 22. Local-First



The application should work completely offline.



Internet is only required when the user clicks an external resource.



No authentication.



No analytics.



No telemetry unless explicitly added later and enabled by the user.



No cloud database.



\---



\# 23. Backup / Export



Add:



Export Plan



Export the current plan as the same timetable format that can be imported.



Example:



\[Export Timetable]



This should generate:



```text

PLAN: Cybersecurity Trainee

DURATION: 30 days



DAY 1

TOPIC: Linux Fundamentals

...

```



Also support:



Export JSON



Import JSON



This provides a backup mechanism.



\---



\# 24. Reset



Allow:



Reset Day



Reset Plan Progress



Delete Plan



For destructive operations require confirmation.



Never accidentally delete an entire plan.



\---



\# 25. Multiple Plans



Support multiple learning plans.



Example:



My Plans



Cybersecurity — 42%



Machine Learning — 15%



Japanese — 63%



DSA — 81%



User can:



\* create

\* open

\* archive

\* delete

\* rename



Only one plan needs to be active at a time.



\---



\# 26. Empty State



When there are no plans:



Show a clean empty state:



"Start a 30-day challenge."



"Turn any structured timetable into an interactive learning tracker."



Buttons:



\[Create Plan]



\[Import Timetable]



Do not fill the dashboard with fake data.



\---



\# 27. Settings



Include:



Appearance



\* Dark

\* Light

\* System



Start-of-week



Date format



Notifications/reminders (architecture-ready, implementation optional)



Database location



Export/import



About



Keep settings minimal.



\---



\# 28. Keyboard Shortcuts



Implement useful shortcuts where practical.



Examples:



N → New plan



T → Today's tasks



← → Previous day



→ → Next day



Space → Toggle selected task



Esc → Close modal



Cmd/Ctrl + K → Command palette



A command palette would be a nice addition if it can be implemented cleanly.



\---



\# 29. Animations



Use subtle animations:



\* task completion

\* progress updates

\* page transitions

\* contribution graph hover

\* modal opening



Do NOT add:



\* excessive particle effects

\* flashy gradients

\* confetti everywhere

\* distracting animations



The application should feel fast and professional.



\---



\# 30. Responsive Desktop UI



Optimize for desktop.



Primary target:



Windows 10/11.



The interface should work well around:



1280×720



1920×1080



2560×1440



Avoid layouts that require extremely large screens.



\---



\# 31. Accessibility



Support:



\* keyboard navigation

\* visible focus states

\* readable contrast

\* semantic buttons

\* tooltips where icons are ambiguous



Do not rely solely on color to communicate task status.



\---



\# 32. Architecture



Use a clean architecture.



Suggested structure:



```text

src/

&#x20; components/

&#x20; pages/

&#x20; features/

&#x20;   plans/

&#x20;   tasks/

&#x20;   calendar/

&#x20;   progress/

&#x20;   timetable/

&#x20; hooks/

&#x20; lib/

&#x20; types/



src-tauri/

&#x20; src/

&#x20;   commands/

&#x20;   db/

&#x20;   models/

&#x20;   parser/

&#x20;   services/

&#x20;   main.rs

```



Separate:



UI



Business logic



Database



Timetable parser



Tauri commands



Do not put all logic into React components.



\---



\# 33. Rust ↔ React Communication



Use Tauri commands for operations such as:



create\_plan



get\_plans



get\_plan



delete\_plan



update\_task



complete\_task



get\_progress



import\_timetable



export\_timetable



create\_note



update\_note



Use typed request/response structures.



Handle errors properly.



Do not silently swallow backend errors.



\---



\# 34. Error Handling



Every failure should produce a useful message.



Bad:



"Something went wrong."



Good:



"Could not import timetable.



Day 18 contains an invalid task format.



Expected:



\* Task description



Found:

18\. SQL Injection



Check the timetable format and try again."



\---



\# 35. Security



Since this is a local application:



\* validate imported data

\* sanitize displayed Markdown/HTML

\* avoid executing arbitrary imported content

\* validate URLs

\* use parameterized SQL queries

\* avoid shell execution unless absolutely necessary

\* follow Tauri security best practices

\* keep Tauri permissions/capabilities minimal



\---



\# 36. Cybersecurity Timetable Test Data



Although the application must remain domain-agnostic, use ONE cybersecurity timetable as test/demo data because it is the initial use case.



The demo plan should represent:



"30-Day Ethical Hacking Trainee"



Cover topics such as:



Linux



Networking



TCP/IP



DNS



HTTP



Reconnaissance



Nmap



Wireshark



Burp Suite



Web vulnerabilities



SQL Injection



XSS



Authentication



Authorization / IDOR



Command Injection



Path Traversal



SSRF



Linux privilege escalation



Windows privilege escalation



Password/hash fundamentals



Metasploit



Python security scripting



Bash automation



CTFs



Reporting



Final assessment



Only use legal practice environments such as intentionally vulnerable labs/CTFs.



Do NOT include instructions for attacking real-world systems.



\---



\# 37. Testing



Write tests for:



Timetable parser



Day detection



Task extraction



Resource extraction



Time parsing



Validation



Progress calculation



Streak calculation



Import/export roundtrip



Database CRUD



Important test:



Import timetable → export timetable → import exported timetable



The resulting structure should remain equivalent.



\---



\# 38. Development Process



Do not attempt to build everything in one huge step.



Work incrementally.



Phase 1:



Project scaffolding



Tauri + React + TypeScript + Rust



Phase 2:



SQLite



Phase 3:



Timetable parser



Phase 4:



Import preview



Phase 5:



Plan/day/task UI



Phase 6:



Dashboard



Phase 7:



Contribution graph



Phase 8:



Progress/streaks



Phase 9:



Export/import



Phase 10:



Polish



After each phase:



\* build

\* run

\* test

\* fix errors

\* continue



Do not leave broken placeholder implementations.



\---



\# 39. Definition of Done



The application is complete when I can:



1\. Launch the desktop application.

2\. Create a new plan.

3\. Paste a 30-day timetable.

4\. See validation errors if the format is invalid.

5\. Preview the parsed plan.

6\. Import it.

7\. See Days 1–30.

8\. Open Day 1.

9\. Check off tasks.

10\. See progress immediately update.

11\. See the contribution graph update.

12\. Close the application.

13\. Reopen it.

14\. See all progress preserved.

15\. Navigate between days.

16\. View statistics.

17\. Export the timetable.

18\. Import it again.

19\. Manage multiple plans.

20\. Delete/reset a plan safely.



\---



\# 40. Important Product Principle



Do NOT build a cybersecurity application.



Build a \*\*generic 30-day learning engine\*\*.



Cybersecurity is merely the first example.



The application's fundamental abstraction is:



TIMETABLE

↓

PARSER

↓

LEARNING PLAN

↓

DAYS

↓

TASKS

↓

PROGRESS

↓

ACTIVITY GRAPH



The user should be able to replace the cybersecurity timetable with:



"30-Day Python Learning"



"30-Day DSA"



"30-Day Japanese"



"30-Day Mathematics"



"30-Day Fitness"



without changing the application.



\---



\# 41. Final UX Goal



When the application opens, the user should immediately understand:



"What do I need to do today?"



The experience should be:



Open app



↓



See today's day



↓



See today's tasks



↓



Complete tasks



↓



Watch progress update



↓



See contribution graph fill



↓



Close app



↓



Return tomorrow



This should be the core loop.



Build the product around this loop rather than around configuration screens.



\---



\# 42. Deliverables



Produce:



1\. Fully working Tauri desktop application.

2\. SQLite persistence.

3\. Timetable parser.

4\. Import validation.

5\. Import preview.

6\. 30-day plan UI.

7\. Task tracking.

8\. GitHub-style contribution graph.

9\. Progress/streak tracking.

10\. Calendar view.

11\. Notes.

12\. Resource links.

13\. Multiple plans.

14\. Import/export.

15\. Dark/light/system themes.

16\. Keyboard navigation.

17\. Tests.

18\. README with:



\* setup

\* development

\* architecture

\* timetable syntax

\* build instructions

\* database structure



Prioritize correctness and a polished core experience over adding unnecessary features.



If a feature conflicts with simplicity, choose simplicity.



