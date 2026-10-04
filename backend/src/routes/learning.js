import { Router } from 'express';
import { z } from 'zod';
import { learningGraph } from '../graph/learningGraph.js';
import { httpError } from '../middleware/errors.js';
import { store } from '../services/store.js';
import { publicMastery } from '../services/mastery.js';
import { publicEvaluation, sessionView, topicByName } from '../services/views.js';
import { detectIntent } from '../agents/intentAgent.js';
import { resolveWorkspace, workspaceMeta } from '../data/workspaces.js';
import { ensureTopicInSession } from '../services/adhocTopic.js';
import { publicXp } from '../services/xp.js';

export const router = Router();

function getSession(id) {
  const session = store.get().sessions[id];
  if (!session) throw httpError(404, 'Learning session not found.');
  return session;
}

const StartBody = z
  .object({
    topic: z.string().min(1).optional(),
    text: z.string().min(1).max(400).optional(),
    resume: z.boolean().default(true),
  })
  .refine((b) => b.topic || b.text, { message: 'Provide either "topic" or "text".' });

// POST /api/learning/start — begin (or resume) a learning session for a topic.
// Either `{ topic }` (an exact, already-known topic name — the original flow) or `{ text }` (a free-text
// request like "Teach me Python loops": the Adaptive Subject Workspace system detects the subject/topic,
// resolves a workspace, and — if the topic is new — folds it into the session the same way onboarding does).
router.post('/learning/start', async (req, res) => {
  const body = StartBody.parse(req.body);
  const s = store.get();

  let topicName = body.topic;
  let detected = null;
  if (!topicName) {
    const raw = await detectIntent(body.text);
    const workspace = resolveWorkspace(raw.subject);
    detected = { ...raw, workspace, workspace_meta: workspaceMeta(workspace) };
    const { topic } = await ensureTopicInSession(raw.topic, { subjectLabel: raw.subject, workspace });
    topicName = topic.name;
  } else if (!s.profile) {
    throw httpError(409, 'Run an assessment first.');
  }

  const known = topicByName(topicName);
  if (!known) throw httpError(404, `Unknown topic "${topicName}".`);

  if (body.resume) {
    const existing = Object.values(s.sessions).find((x) => x.topic === known.name && x.status === 'active');
    if (existing) return res.json({ resumed: true, session: sessionView(existing), detected });
  }
  const state = await learningGraph.invoke({ action: 'start', currentTopic: known.name, sources: {} });
  res.status(201).json({ resumed: false, session: sessionView(getSession(state.sessionId)), detected, sources: state.sources });
});

// POST /api/learning/respond — answer the open question, or ask the coach to explain differently
router.post('/learning/respond', async (req, res) => {
  const body = z
    .object({
      sessionId: z.string(),
      action: z.enum(['answer', 'rephrase']).default('answer'),
      answer: z.union([z.string(), z.number()]).optional(),
      confidence: z.number().int().min(1).max(5).optional(),
      style: z.enum(['simpler', 'different', 'example']).optional(),
    })
    .parse(req.body);
  const session = getSession(body.sessionId);
  if (session.status !== 'active') throw httpError(409, 'This session is already complete.');
  if (body.action === 'answer' && (body.answer === undefined || body.answer === '')) throw httpError(400, 'An answer is required.');

  const state = await learningGraph.invoke({
    action: body.action,
    sessionId: body.sessionId,
    studentAnswer: body.answer,
    answerConfidence: body.confidence,
    rephraseStyle: body.style,
    sources: {},
  });

  const view = sessionView(session);
  res.json({
    session: view,
    evaluation: publicEvaluation(state.evaluation ?? null),
    next_action: state.nextAction,
    session_complete: session.status === 'complete',
    mastery: publicMastery(store.get().mastery[session.topic]),
    plan_changes: state.planChanges ?? [],
    plan_update: state.planUpdate ?? null,
    xp_gained: state.xpAwards ?? [],
    xp: publicXp(store.get().gamification),
    sources: state.sources,
  });
});

// POST /api/learning/hint — nudge for the current question (counts against the score)
router.post('/learning/hint', (req, res) => {
  const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
  const session = getSession(sessionId);
  if (!session.question) throw httpError(409, 'There is no open question.');
  session.hintUsed = true;
  res.json({ hint: session.question.hint });
});

// GET /api/learning/session/:id — restore a session (e.g. after a page refresh)
router.get('/learning/session/:id', (req, res) => {
  res.json({ session: sessionView(getSession(req.params.id)) });
});
