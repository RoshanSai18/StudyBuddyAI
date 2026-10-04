import { canon } from '../data/knowledge.js';
import { workspaceMeta } from '../data/workspaces.js';
import { publicMastery } from './mastery.js';
import { daysUntil, startOfDay, toDateOnly } from './dates.js';
import { store } from './store.js';

/** Strip answer keys before a question goes to the client. */
export function publicQuestion(q) {
  if (!q) return null;
  return { id: q.id, type: q.type, prompt: q.prompt, options: q.options, dimension: q.dimension, difficulty: q.difficulty ?? null };
}

export function publicEvaluation(e) {
  if (!e) return null;
  return {
    correct: e.correct,
    score: e.score,
    misconception: e.misconception,
    feedback: e.feedback,
    recommended_action: e.recommended_action,
    difficulty_adjustment: e.difficulty_adjustment,
    overconfident: e.overconfident,
    explanation: e.explanation ?? null, // only revealed once the student got it or we moved on
    moved_on: Boolean(e.moved_on),
  };
}

export function sessionView(session) {
  const s = store.get();
  return {
    id: session.id,
    topic: session.topic,
    mode: session.mode,
    workspace: session.workspace || 'generic_workspace',
    workspace_meta: workspaceMeta(session.workspace),
    rationale: session.rationale,
    difficulty: session.difficulty,
    status: session.status,
    step_index: session.stepIndex,
    attempts: session.attempts,
    outline: session.outline.map(({ id, title, kind, dimension, status }) => ({ id, title, kind, dimension, status })),
    lesson: session.lesson,
    question: publicQuestion(session.question),
    last_evaluation: publicEvaluation(session.lastEvaluation),
    mastery: publicMastery(s.mastery[session.topic]),
    transcript: session.transcript,
  };
}

export function overallMastery() {
  const s = store.get();
  if (!s.analyzedTopics.length) return { overall: 0, measured_topics: 0 };
  let total = 0;
  let weight = 0;
  let measured = 0;
  for (const t of s.analyzedTopics) {
    const m = s.mastery[t.name];
    const w = t.exam_importance || 5;
    total += m.overall * w;
    weight += w;
    if (m.measured) measured++;
  }
  return { overall: Math.round(total / weight), measured_topics: measured };
}

export function masteryView() {
  const s = store.get();
  return s.analyzedTopics.map((t) => ({ topic: t.name, ...publicMastery(s.mastery[t.name]) }));
}

export function dashboardView() {
  const s = store.get();
  if (!s.profile) return { onboarded: false, has_plan: false };

  const today = toDateOnly(startOfDay());
  const plan = s.plan;
  const day = plan?.days.find((d) => d.date >= today && d.schedulable !== false) ?? null;
  const tier = new Map(s.priorities.map((p) => [p.topic, p.tier]));

  const focusMap = new Map();
  for (const b of day?.blocks || []) {
    if (b.type === 'break' || !b.topic || b.status === 'missed' || b.status === 'skipped') continue;
    const f = focusMap.get(b.topic) || { topic: b.topic, tier: tier.get(b.topic) || 'low', minutes: 0, pending_minutes: 0, blocks: [] };
    f.minutes += b.minutes;
    if (b.status === 'pending') f.pending_minutes += b.minutes;
    f.blocks.push({ id: b.id, type: b.type, minutes: b.minutes, status: b.status });
    focusMap.set(b.topic, f);
  }

  const overall = overallMastery();
  return {
    onboarded: true,
    has_plan: Boolean(plan),
    subject: s.profile.subject,
    exam_date: s.profile.examDate,
    days_until_exam: daysUntil(s.profile.examDate),
    daily_hours: s.profile.dailyHours,
    overall_mastery: overall.overall,
    measured_topics: overall.measured_topics,
    total_topics: s.analyzedTopics.length,
    today: day ? { date: day.date, day: day.day, total_minutes: day.totalMinutes, focus: [...focusMap.values()] } : null,
    top_priorities: s.priorities.slice(0, 3).map(({ topic, score, tier: t, mastery, workspace }) => ({ topic, score, tier: t, mastery, workspace })),
    latest_plan_update: s.planUpdates[0] ?? null,
    active_sessions: Object.values(s.sessions).filter((x) => x.status === 'active').map((x) => ({ id: x.id, topic: x.topic })),
  };
}

export function topicByName(name) {
  const s = store.get();
  return s.analyzedTopics.find((t) => canon(t.name) === canon(name));
}
