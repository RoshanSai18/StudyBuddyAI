import { Router } from 'express';
import { z } from 'zod';
import { planningGraph } from '../graph/planningGraph.js';
import { replan } from '../agents/replannerAgent.js';
import { httpError } from '../middleware/errors.js';
import { ProfileInput } from '../schemas/index.js';
import { daysUntil, startOfDay, toDateOnly } from '../services/dates.js';
import { store } from '../services/store.js';
import { dashboardView, masteryView, overallMastery, topicByName } from '../services/views.js';

export const router = Router();

function assertExamInFuture(profile) {
  if (daysUntil(profile.examDate) < 1) throw httpError(400, 'examDate must be in the future.');
}

function persistAnalysis(state, profile) {
  const s = store.reset();
  s.profile = profile;
  s.analyzedTopics = state.analyzedTopics;
  s.missingInfo = state.missingInfo;
  s.dependencies = state.dependencies;
  s.priorities = state.priorities;
  s.mastery = state.masteryScores;
  s.sources = state.sources;
  return s;
}

const analysisView = (s) => ({
  topics: s.analyzedTopics,
  missing_info: s.missingInfo,
  dependencies: s.dependencies,
  priorities: s.priorities,
  days_until_exam: daysUntil(s.profile.examDate),
  available_hours: Math.round(daysUntil(s.profile.examDate) * s.profile.dailyHours * 10) / 10,
  sources: s.sources,
});

const planView = (s) => ({
  plan: s.plan,
  priorities: s.priorities,
  dependencies: s.dependencies,
  sources: s.sources,
});

/** Run assessment → curriculum → priority and store the result (starts a fresh session). */
export async function runAnalysis(profile, { stopAfter } = {}) {
  assertExamInFuture(profile);
  const state = await planningGraph.invoke({ profile, stopAfter });
  const s = persistAnalysis(state, profile);
  if (state.studyPlan) s.plan = state.studyPlan;
  return s;
}

// POST /api/assessment — analyze the syllabus (difficulty, hours, dependencies, priorities)
router.post('/assessment', async (req, res) => {
  const profile = ProfileInput.parse(req.body);
  const s = await runAnalysis(profile, { stopAfter: 'priority' });
  res.status(201).json(analysisView(s));
});

// POST /api/plan — generate the study plan (from the stored analysis, or from a profile in the body)
router.post('/plan', async (req, res) => {
  if (req.body?.topics) {
    const s = await runAnalysis(ProfileInput.parse(req.body));
    return res.status(201).json({ ...analysisView(s), ...planView(s) });
  }
  const s = store.get();
  if (!s.profile) throw httpError(409, 'Run POST /api/assessment first (or send a profile).');
  const state = await planningGraph.invoke({
    stage: 'plan',
    profile: s.profile,
    analyzedTopics: s.analyzedTopics,
    dependencies: s.dependencies,
    priorities: s.priorities,
    masteryScores: s.mastery,
    sources: s.sources,
  });
  s.plan = state.studyPlan;
  res.status(201).json(planView(s));
});

// GET /api/plan — current plan
router.get('/plan', (req, res) => {
  const s = store.get();
  if (!s.plan) throw httpError(404, 'No study plan yet.');
  res.json(planView(s));
});

// GET /api/plan/updates — history of adaptive plan changes (newest first)
router.get('/plan/updates', (req, res) => {
  res.json({ updates: store.get().planUpdates });
});

// POST /api/plan/session — mark a block done / skipped / pending
router.post('/plan/session', (req, res) => {
  const { blockId, status } = z.object({ blockId: z.string(), status: z.enum(['done', 'skipped', 'pending']) }).parse(req.body);
  const s = store.get();
  for (const day of s.plan?.days || []) {
    const block = day.blocks.find((b) => b.id === blockId);
    if (block) {
      block.status = status;
      day.totalMinutes = day.blocks.filter((b) => b.type !== 'break' && ['pending', 'done'].includes(b.status)).reduce((t, b) => t + b.minutes, 0);
      return res.json({ block, day: day.day });
    }
  }
  throw httpError(404, 'Block not found.');
});

// GET /api/priorities, /api/priorities/:topic
router.get('/priorities', (req, res) => {
  res.json({ priorities: store.get().priorities });
});
router.get('/priorities/:topic', (req, res) => {
  const t = topicByName(req.params.topic);
  const p = store.get().priorities.find((x) => x.topic === t?.name);
  if (!p) throw httpError(404, 'Topic not found.');
  res.json(p);
});

// GET /api/mastery
router.get('/mastery', (req, res) => {
  res.json({ ...overallMastery(), topics: masteryView() });
});

// GET /api/dashboard
router.get('/dashboard', (req, res) => {
  res.json(dashboardView());
});

// POST /api/replan — recalculate the remaining plan from current mastery (also catches up missed days)
router.post('/replan', async (req, res) => {
  const { asOf } = z.object({ asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
  const result = await replan({
    trigger: { type: 'manual' },
    asOf: asOf ? new Date(`${asOf}T00:00:00`) : new Date(),
    narrate: true,
    record: true,
  });
  res.json({ ...result, plan: store.get().plan, today: toDateOnly(startOfDay()) });
});

// POST /api/demo/seed — the DSA demo scenario from the project brief
router.post('/demo/seed', async (req, res) => {
  const exam = new Date();
  exam.setDate(exam.getDate() + 7);
  const profile = ProfileInput.parse({
    subject: 'Data Structures & Algorithms',
    examDate: toDateOnly(exam),
    dailyHours: 3,
    topics: [
      { name: 'Arrays', confidence: 8 },
      { name: 'Linked Lists', confidence: 6 },
      { name: 'Trees', confidence: 4 },
      { name: 'Graphs', confidence: 2 },
      { name: 'Dynamic Programming', confidence: 1 },
      { name: 'Sorting', confidence: 7 },
    ],
  });
  const s = await runAnalysis(profile);
  res.status(201).json({ ...analysisView(s), ...planView(s) });
});

// POST /api/reset — forget everything (new student)
router.post('/reset', (req, res) => {
  store.reset();
  res.json({ ok: true });
});
