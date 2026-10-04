# StudyBuddyAI backend

Express (ESM, JavaScript) + LangGraph agents. Single in-memory student session, no auth.

## Run

```bash
cd backend
cp .env.example .env      # add MESH_API_KEY
npm install
npm run dev               # http://localhost:4000
npm test                  # runs offline (LLM_DISABLED=1), no network needed
```

Without `MESH_API_KEY` (or with `LLM_DISABLED=1`) every agent uses a deterministic fallback, so the UI can be built offline.
Responses include a `sources` map (`llm` | `fallback` | `rules`) showing what produced each part.

## Layout

```
src/
  app.js, server.js, config.js
  llm/mesh.js              the one LLM client (MeshAPI, gpt-4o-mini) + callStructured() with zod validation and fallback
  schemas/index.js         zod schemas for API input and every LLM output
  graph/                   StudyState, planningGraph, learningGraph (LangGraph)
  agents/                  assessment, curriculum, priority, planner, learning, evaluation, replanner
  services/                deterministic logic: priority, scheduler, mastery, planDiff, dates, store, views
  routes/                  planning (assessment/plan/priorities/mastery/dashboard/replan/demo), learning, quiz
  data/knowledge.js        known prerequisites, aliases, category hints
```

Deterministic (code): days to exam, priority score, hours needed, schedule fit, prerequisite order, mastery maths, MCQ grading.
LLM: difficulty/hours estimates, prerequisite suggestions, "why" text, teaching strategy, lessons, questions, free-text grading, misconceptions, plan-change narrative.

## Endpoints (all under `/api`)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/health` | | which LLM is active |
| POST | `/assessment` | `{subject, topics:[{name, confidence 1-10, importance?}], examDate:"YYYY-MM-DD", dailyHours}` | resets the session; returns topics, dependencies, priorities (with reasons + explanation) |
| POST | `/plan` | none (uses stored assessment) or a full profile | day-by-day plan |
| GET | `/plan` | | 404 until a plan exists |
| POST | `/plan/session` | `{blockId, status: done\|skipped\|pending}` | |
| GET | `/plan/updates` | | adaptive plan-change history, newest first |
| GET | `/priorities`, `/priorities/:topic` | | |
| GET | `/mastery` | | overall + per-topic breakdown and history |
| GET | `/dashboard` | | countdown, overall mastery, today's focus, top priorities, latest plan update |
| POST | `/learning/start` | `{topic, resume?=true}` | outline, first lesson step + question |
| POST | `/learning/respond` | `{sessionId, answer, confidence?}` or `{sessionId, action:"rephrase", style?}` | MCQ `answer` is the option index |
| POST | `/learning/hint` | `{sessionId}` | |
| GET | `/learning/session/:id` | | restore a session |
| POST | `/quiz/generate` | `{topic, count?=5}` | answer keys stay server-side |
| POST | `/quiz/evaluate` | `{quizId, answers:[{questionId, answer, confidence?}]}` | send one answer at a time (instant feedback + correct option) or all at once; mastery updates per question, the plan updates after the last |
| POST | `/replan` | `{asOf?: "YYYY-MM-DD"}` | recompute remaining plan; unfinished past blocks become `missed` |
| POST | `/demo/seed` | | the DSA demo scenario (7 days, 3 h/day) |
| POST | `/reset` | | |

Errors: `{ "error": { "message": "...", "details": [...] } }` with 400 (validation), 404, 409 (wrong state).

## Learning flow

`start` → AI picks a teaching mode/outline → step 1 lesson + question.
`respond` correct → mastery↑, difficulty↑, next step. Wrong → misconception recorded, difficulty↓, re-teach with a different explanation
(after 2 misses the step is flagged `revisit`, the answer is revealed and the lesson moves on).
Every answer updates mastery and silently replans (`plan_changes`); when the session completes, a `plan_update` (headline, summary, per-topic changes) is recorded.
