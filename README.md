# StudyBuddyAI

StudyBuddyAI is an adaptive AI learning coach that closes the loop between planning and actual learning. Instead of only generating a timetable, it assesses a student’s strengths and weaknesses, prioritizes topics, builds a study plan, teaches the material with AI, evaluates performance, and then updates the plan based on real mastery.

The core flow is:

Assess → Prioritize → Plan → Teach → Practice → Evaluate → Adapt → Replan

This project is built for a demo-friendly MVP: one student session, in-memory state, a React frontend, and a Node/Express backend powered by LangGraph-style agent orchestration and MeshAPI.

## Why this project exists

Traditional study planners stop at scheduling. StudyBuddyAI continues after the schedule is created:

- it teaches the topic
- asks questions or quiz items
- measures mastery
- detects misconceptions
- changes teaching strategy when needed
- recalculates the remaining study plan based on actual performance

That adaptive loop is the core differentiator.

## Key features

- Topic assessment and confidence-based prioritization
- Subject/topic onboarding and exam timing inputs
- Priority scoring with transparent reasoning
- Dependency-aware study plan generation
- AI-powered learning workspace for each topic
- Topic-specific teaching strategies
- Practice questions and quiz generation
- Answer evaluation and misconception detection
- Mastery score tracking across topics
- Adaptive replanning based on learning outcomes
- Demo seed scenario for a DSA exam preparation workflow

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- AI orchestration: LangGraph-inspired graph and agent pattern
- LLM: MeshAPI via OpenAI-compatible endpoint (`gpt-4o-mini`)
- Validation: schema-based validation for request/response structure
- Persistence: in-memory session for MVP

## Repository structure

```text
StudyBuddyAI/
├── backend/
│   ├── .env.example
│   ├── README.md
│   ├── package.json
│   ├── src/
│   │   ├── agents/
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── graph/
│   │   ├── llm/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── server.js
│   └── tests/
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── public/
│   └── src/
├── .gitignore
├── CLAUDE.md
├── features.md
├── features.pdf
└── README.md
```

## Getting started

### Prerequisites

- Node.js 18+
- npm
- A MeshAPI key (or leave LLM disabled for deterministic offline mode)

### 1) Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` with your values:

```env
MESH_API_KEY=your_key
MESH_BASE_URL=https://api.meshapi.ai/v1
MODEL_NAME=gpt-4o-mini
PORT=4000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
LLM_DISABLED=0
```

If you want to run without the network dependency, set:

```env
LLM_DISABLED=1
```

Then start the API:

```bash
npm run dev
```

The backend runs on:

- http://localhost:4000

### 2) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on:

- http://localhost:5173

## Demo flow

A demo DSA scenario is included to simulate the primary use case:

- subject: Data Structures & Algorithms
- topics: Arrays, Linked Lists, Trees, Graphs, Dynamic Programming, Sorting
- exam date: 7 days away
- daily study hours: 3

The app can seed this scenario through the backend demo route, and the dashboard shows priority ranking, plan generation, and adaptive learning updates.

## Backend API overview

The backend exposes a set of planning, learning, quiz, and replan routes under `/api`.

Important endpoints include:

- `POST /api/assessment` — analyze student topic confidence and generate initial priorities
- `POST /api/plan` — create or regenerate the study plan
- `GET /api/plan` — retrieve the current plan
- `GET /api/dashboard` — get the current overview, priorities, and focus blocks
- `POST /api/learning/start` — begin a learning session for a topic
- `POST /api/learning/respond` — submit an answer and receive adaptive feedback
- `POST /api/quiz/generate` — generate questions for a topic
- `POST /api/quiz/evaluate` — evaluate a quiz submission
- `POST /api/replan` — recalculate the schedule based on mastery changes
- `POST /api/demo/seed` — populate a realistic demo scenario

## Project purpose

StudyBuddyAI is designed to behave like a personal AI tutor and study planner at the same time:

- it understands the student profile
- it prioritizes what matters most
- it creates an achievable study schedule
- it teaches the material adaptively
- it evaluates the student’s understanding
- it changes the plan when performance suggests a different needed focus

This makes it a learning-first system rather than a pure scheduling tool.

## Notes

- The MVP keeps state in memory.
- There is no authentication layer.
- The app is intentionally simple and demo-friendly so the core learning loop can be built and tested quickly.
- In offline mode, the system falls back to deterministic logic instead of relying on the LLM.

## License

This project is currently provided as a local development project without a formal license file.
