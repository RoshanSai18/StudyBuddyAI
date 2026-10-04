process.env.LLM_DISABLED = '1'; // exercise the deterministic fallbacks; no network

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/app.js');
const { store } = await import('../src/services/store.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

const examIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const profile = () => ({
  subject: 'DSA',
  examDate: examIn(7),
  dailyHours: 3,
  topics: [
    { name: 'Arrays', confidence: 8 },
    { name: 'Trees', confidence: 4 },
    { name: 'Graphs', confidence: 2 },
    { name: 'Dynamic Programming', confidence: 1 },
  ],
});

test('rejects invalid input with helpful errors', async () => {
  const bad = await call('POST', '/assessment', { subject: 'x', topics: [], examDate: 'tomorrow', dailyHours: 3 });
  assert.equal(bad.status, 400);
  const past = await call('POST', '/assessment', { ...profile(), examDate: examIn(-2) });
  assert.equal(past.status, 400);
  assert.equal((await call('GET', '/plan')).status, 404);
});

test('full loop: assessment → plan → learn → misconception → mastery → replan', async () => {
  await call('POST', '/reset');

  const a = await call('POST', '/assessment', profile());
  assert.equal(a.status, 201);
  assert.equal(a.body.priorities[0].topic, 'Dynamic Programming');
  assert.ok(a.body.priorities.every((p) => p.reasons.length && p.explanation));

  const p = await call('POST', '/plan');
  assert.equal(p.status, 201);
  assert.equal(p.body.plan.days.length, 7);
  for (const d of p.body.plan.days) assert.ok(d.blocks.reduce((s, b) => s + b.minutes, 0) <= 180);

  const dash0 = (await call('GET', '/dashboard')).body;
  assert.equal(dash0.days_until_exam, 7);
  assert.ok(dash0.today.focus.length > 0);
  const mastery0 = dash0.overall_mastery;
  const graphsPending = (plan) => plan.days.flatMap((d) => d.blocks).filter((b) => b.topic === 'Graphs' && b.status === 'pending').reduce((s, b) => s + b.minutes, 0);
  const before = graphsPending(p.body.plan);

  const start = await call('POST', '/learning/start', { topic: 'graphs' });
  assert.equal(start.status, 201);
  const sid = start.body.session.id;
  assert.ok(start.body.session.outline.length >= 3);
  assert.ok(!('correct_index' in start.body.session.question), 'answer key must not leak');
  assert.equal((await call('POST', '/learning/start', { topic: 'Graphs' })).body.resumed, true);

  const keyOf = () => store.get().sessions[sid].question.correct_index;
  const wrongOf = () => (keyOf() + 1) % 4;

  // wrong answer → misconception, re-teach same step
  const wrong = await call('POST', '/learning/respond', { sessionId: sid, answer: wrongOf() });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.body.evaluation.correct, false);
  assert.ok(wrong.body.evaluation.misconception);
  assert.equal(wrong.body.evaluation.explanation, null, 'do not reveal the answer yet');
  assert.equal(wrong.body.session.step_index, 0);
  assert.equal(wrong.body.session.lesson.reteach, true);

  // answer everything else correctly until the session completes
  let last;
  for (let i = 0; i < 20; i++) {
    last = await call('POST', '/learning/respond', { sessionId: sid, answer: keyOf() });
    assert.equal(last.status, 200);
    assert.equal(last.body.evaluation.correct, true);
    if (last.body.session_complete) break;
  }
  assert.ok(last.body.session_complete);
  assert.ok(last.body.mastery.overall > 20, 'mastery rose from the 20% prior');
  assert.ok(last.body.plan_update, 'a plan update is recorded when the session completes');
  assert.ok(last.body.plan_update.changes.some((c) => c.topic === 'Graphs' && c.delta < 0), 'Graphs time was reduced');
  assert.ok(graphsPending((await call('GET', '/plan')).body.plan) < before);

  const dash1 = (await call('GET', '/dashboard')).body;
  assert.ok(dash1.overall_mastery > mastery0);
  assert.equal(dash1.latest_plan_update.trigger.topic, 'Graphs');

  assert.equal((await call('POST', '/learning/respond', { sessionId: sid, answer: 0 })).status, 409);
});

test('quiz: answer keys are hidden, grading updates mastery and replans', async () => {
  const q = await call('POST', '/quiz/generate', { topic: 'Dynamic Programming', count: 4 });
  assert.equal(q.status, 201);
  assert.equal(q.body.questions.length, 4);
  assert.ok(q.body.questions.every((x) => !('correct_index' in x)));

  const quiz = store.get().quizzes[q.body.quiz_id];
  const answers = quiz.questions.map((x) => ({ questionId: x.id, answer: x.correct_index }));
  const r = await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers });
  assert.equal(r.status, 200);
  assert.equal(r.body.correct_count, 4);
  assert.equal(r.body.score, 100);
  assert.ok(r.body.mastery.overall > 10);
  assert.equal((await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers })).status, 409);
});

test('hint, plan session toggle and manual replan (catches up missed days)', async () => {
  const start = await call('POST', '/learning/start', { topic: 'Trees' });
  const hint = await call('POST', '/learning/hint', { sessionId: start.body.session.id });
  assert.ok(hint.body.hint);

  const plan = (await call('GET', '/plan')).body.plan;
  const block = plan.days[0].blocks.find((b) => b.status === 'pending' && b.type !== 'break');
  const done = await call('POST', '/plan/session', { blockId: block.id, status: 'done' });
  assert.equal(done.body.block.status, 'done');

  // pretend 3 days passed without studying
  const later = examIn(3);
  const replanned = await call('POST', '/replan', { asOf: later });
  assert.equal(replanned.status, 200);
  const days = replanned.body.plan.days;
  assert.ok(days[0].blocks.some((b) => b.status === 'missed' || b.status === 'done'));
  for (const d of days.filter((x) => x.date >= later)) {
    assert.ok(d.blocks.filter((b) => b.status !== 'missed' && b.status !== 'skipped').reduce((s, b) => s + b.minutes, 0) <= 180);
  }
});

test('quiz: answers can be graded one question at a time; plan updates after the last one', async () => {
  const q = await call('POST', '/quiz/generate', { topic: 'Arrays', count: 3 });
  const quiz = store.get().quizzes[q.body.quiz_id];

  const first = await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers: [{ questionId: quiz.questions[0].id, answer: quiz.questions[0].correct_index }] });
  assert.equal(first.status, 200);
  assert.equal(first.body.quiz_complete, false);
  assert.equal(first.body.answered, 1);
  assert.equal(first.body.results[0].correct, true);
  assert.equal(first.body.results[0].correct_index, quiz.questions[0].correct_index);
  assert.equal(first.body.plan_update, null);

  const dup = await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers: [{ questionId: quiz.questions[0].id, answer: 0 }] });
  assert.equal(dup.status, 409);

  await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers: [{ questionId: quiz.questions[1].id, answer: (quiz.questions[1].correct_index + 1) % 4 }] });
  const last = await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers: [{ questionId: quiz.questions[2].id, answer: quiz.questions[2].correct_index }] });
  assert.equal(last.body.quiz_complete, true);
  assert.equal(last.body.quiz_correct, 2);
  assert.equal(last.body.quiz_total, 3);
});

test('intent detection: classifies free-text requests into the right subject/workspace (offline fallback)', async () => {
  const cases = [
    ['Teach me Python recursion.', 'programming', 'coding_workspace'],
    ['Help me practice Python.', 'programming', 'coding_workspace'],
    ['Show me acid-base titration.', 'chemistry', 'chemistry_workspace'],
    ['Help me solve an integration problem.', 'mathematics', 'math_workspace'],
    ['Explain projectile motion.', 'physics', 'physics_workspace'],
    ['Teach me cell structure.', 'biology', 'biology_workspace'],
    ['Teach me the history of 14th century trade routes.', 'other', 'generic_workspace'],
  ];
  for (const [text, subject, workspace] of cases) {
    const r = await call('POST', '/intent', { text });
    assert.equal(r.status, 200, text);
    assert.equal(r.body.subject, subject, `${text} -> subject`);
    assert.equal(r.body.workspace, workspace, `${text} -> workspace`);
    assert.ok(r.body.topic.length > 0);
    assert.equal(r.body.existing_topic, null);
  }
  assert.equal((await call('POST', '/intent', { text: '' })).status, 400);
});

test('ask-anything: starting a session from free text bootstraps a session, plan and workspace', async () => {
  await call('POST', '/reset');
  assert.equal((await call('GET', '/plan')).status, 404);

  const start = await call('POST', '/learning/start', { text: 'Teach me Python loops' });
  assert.equal(start.status, 201);
  assert.equal(start.body.detected.subject, 'programming');
  assert.equal(start.body.session.workspace, 'coding_workspace');
  assert.ok(start.body.session.topic.length > 0);

  // the topic is now a first-class part of the session: it has mastery, a priority score, and a plan
  const mastery = await call('GET', '/mastery');
  assert.ok(mastery.body.topics.some((t) => t.topic === start.body.session.topic));
  const priorities = await call('GET', '/priorities');
  const row = priorities.body.priorities.find((p) => p.topic === start.body.session.topic);
  assert.ok(row);
  assert.equal(row.workspace, 'coding_workspace');
  const plan = await call('GET', '/plan');
  assert.equal(plan.status, 200);

  // asking about the same topic again resumes rather than duplicating it
  const again = await call('POST', '/learning/start', { text: 'Teach me Python loops' });
  assert.equal(again.body.resumed, true);
  const priorities2 = await call('GET', '/priorities');
  assert.equal(priorities2.body.priorities.filter((p) => p.topic === start.body.session.topic).length, 1);
});

test('ask-anything: a second, different-subject ask folds into the same plan', async () => {
  const before = await call('GET', '/plan');
  const beforeDays = before.body.plan.days.length;

  const r = await call('POST', '/learning/start', { text: 'Explain projectile motion' });
  assert.equal(r.status, 201);
  assert.equal(r.body.session.workspace, 'physics_workspace');

  const after = await call('GET', '/plan');
  assert.equal(after.body.plan.days.length, beforeDays);
  const pending = after.body.plan.days.flatMap((d) => d.blocks).some((b) => b.topic === r.body.session.topic);
  assert.ok(pending, 'the new topic was scheduled into the existing plan');
});

test('ask-anything: topic already in the plan is reused, not re-created, when asked for by exact name', async () => {
  await call('POST', '/reset');
  await call('POST', '/assessment', profile());
  await call('POST', '/plan');

  const start = await call('POST', '/learning/start', { text: 'Teach me arrays' });
  assert.equal(start.status, 201);
  assert.equal(start.body.session.topic, 'Arrays');
  const priorities = await call('GET', '/priorities');
  assert.equal(priorities.body.priorities.filter((p) => p.topic === 'Arrays').length, 1);
});

test('ask-anything: the start response carries workspace_meta for the detected intent (not just on the session)', async () => {
  await call('POST', '/reset');
  const r = await call('POST', '/learning/start', { text: 'Explain projectile motion' });
  assert.equal(r.status, 201);
  assert.equal(r.body.detected.workspace, 'physics_workspace');
  assert.equal(r.body.detected.workspace_meta.label, 'Physics workspace');
  assert.equal(r.body.session.workspace_meta.label, 'Physics workspace');
});

test('notes analysis: paste text (offline heuristic fallback) returns a topic breakdown', async () => {
  const text = `
Binary Search Trees
A BST keeps left children smaller and right children larger than their parent.

Graph Traversal
BFS explores level by level using a queue; DFS goes deep first using a stack or recursion.

Dynamic Programming
Break a problem into overlapping subproblems and cache the results to avoid recomputation.
`.repeat(2);
  const r = await call('POST', '/notes/analyze', { text });
  assert.equal(r.status, 200);
  assert.ok(r.body.topics.length >= 1);
  assert.ok(r.body.subject);
  assert.ok(r.body.overview);
  assert.ok(r.body.totalHours >= 0);
  for (const t of r.body.topics) {
    assert.ok(t.name);
    assert.ok(t.difficulty >= 1 && t.difficulty <= 10);
    assert.ok(t.workspace);
  }
});

test('notes analysis: rejects text that is too short', async () => {
  const r = await call('POST', '/notes/analyze', { text: 'too short' });
  assert.equal(r.status, 400);
});

test('notes analysis: extracts text from an uploaded PDF', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const pdfBuffer = fs.readFileSync(path.join(dir, 'fixtures/sample-notes.pdf'));

  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'sample-notes.pdf');
  const res = await fetch(base + '/notes/analyze', { method: 'POST', body: form });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.ok(body.topics.length >= 1);
  assert.ok(body.topics.some((t) => /binary search/i.test(t.name) || /notes section/i.test(t.name)));
});

test('notes analysis: rejects non-PDF files', async () => {
  const form = new FormData();
  form.append('file', new Blob(['not a pdf'], { type: 'text/plain' }), 'notes.txt');
  const res = await fetch(base + '/notes/analyze', { method: 'POST', body: form });
  assert.equal(res.status, 400);
});

test('gamification: XP is awarded for correct answers, lesson completion, and quizzes', async () => {
  await call('POST', '/reset');
  await call('POST', '/assessment', profile());
  await call('POST', '/plan');

  const xp0 = (await call('GET', '/xp')).body;
  assert.equal(xp0.xp, 0);
  assert.equal(xp0.level, 1);

  const start = await call('POST', '/learning/start', { topic: 'Arrays' });
  const sid = start.body.session.id;
  const keyOf = () => store.get().sessions[sid].question.correct_index;

  let last;
  let gained = 0;
  for (let i = 0; i < 20; i++) {
    last = await call('POST', '/learning/respond', { sessionId: sid, answer: keyOf() });
    assert.ok(Array.isArray(last.body.xp_gained));
    gained += last.body.xp_gained.reduce((s, a) => s + a.amount, 0);
    if (last.body.session_complete) break;
  }
  assert.ok(last.body.session_complete);
  assert.ok(gained > 0, 'XP was awarded across the session');
  assert.equal(last.body.xp.xp, gained);

  const q = await call('POST', '/quiz/generate', { topic: 'Arrays', count: 3 });
  const quiz = store.get().quizzes[q.body.quiz_id];
  const answers = quiz.questions.map((x) => ({ questionId: x.id, answer: x.correct_index }));
  const r = await call('POST', '/quiz/evaluate', { quizId: q.body.quiz_id, answers });
  assert.ok(r.body.xp_gained.length >= 3, 'one XP event per correct quiz answer plus a perfect bonus');
  assert.ok(r.body.xp.xp > gained, 'quiz XP added on top of lesson XP');

  const xpFinal = (await call('GET', '/xp')).body;
  assert.equal(xpFinal.xp, r.body.xp.xp);
  assert.ok(xpFinal.level >= 1);
  assert.equal(xpFinal.xp_into_level, xpFinal.xp % 100);
});

test('gamification: wrong answers earn no XP, and leveling up is reported', async () => {
  await call('POST', '/reset');
  await call('POST', '/assessment', profile());
  const start = await call('POST', '/learning/start', { topic: 'Graphs' });
  const sid = start.body.session.id;
  const wrongOf = () => (store.get().sessions[sid].question.correct_index + 1) % 4;
  const wrong = await call('POST', '/learning/respond', { sessionId: sid, answer: wrongOf() });
  assert.equal(wrong.body.xp_gained.length, 0);
  assert.equal(wrong.body.xp.xp, 0);
});

test('flashcards: generates a set, hides nothing sensitive, and awards XP once per card', async () => {
  await call('POST', '/reset');
  await call('POST', '/assessment', profile());

  const gen = await call('POST', '/flashcards/generate', { topic: 'Trees', count: 4 });
  assert.equal(gen.status, 201);
  assert.equal(gen.body.cards.length, 4);
  for (const c of gen.body.cards) {
    assert.ok(c.front);
    assert.ok(c.back);
  }

  const cardId = gen.body.cards[0].id;
  const mark1 = await call('POST', '/flashcards/mark', { setId: gen.body.set_id, cardId, known: true });
  assert.ok(mark1.body.award);
  assert.equal(mark1.body.award.reason, 'flashcard_known');

  // marking the same card known again must not double-award
  const mark2 = await call('POST', '/flashcards/mark', { setId: gen.body.set_id, cardId, known: true });
  assert.equal(mark2.body.award, null);
  assert.equal(mark2.body.xp.xp, mark1.body.xp.xp);

  const bad = await call('POST', '/flashcards/mark', { setId: gen.body.set_id, cardId: 'not-real', known: true });
  assert.equal(bad.status, 404);
});
