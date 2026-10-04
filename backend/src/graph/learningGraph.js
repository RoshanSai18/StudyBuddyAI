import { randomUUID } from 'node:crypto';
import { END, START, StateGraph } from '@langchain/langgraph';
import { StudyState } from './state.js';
import { chooseStrategy, generateStep } from '../agents/learningAgent.js';
import { evaluateAnswer } from '../agents/evaluationAgent.js';
import { replan } from '../agents/replannerAgent.js';
import { httpError } from '../middleware/errors.js';
import { canon } from '../data/knowledge.js';
import { applyEvidence } from '../services/mastery.js';
import { clamp, startOfDay, toDateOnly } from '../services/dates.js';
import { store } from '../services/store.js';

export const MAX_ATTEMPTS_PER_STEP = 2;

// Start:   Load Topic → Strategy → Generate Lesson → Ask Question → END
// Answer:  Evaluate ─┬ correct → Increase Mastery → Adjust Difficulty ─┬ more steps → Generate Lesson ┐
//                    └ wrong   → Detect Misconception ─┬ retry → Generate Lesson ──────────────────────┤
//                                                      └ give up → Adjust Difficulty (revisit later)    │
//          …→ Ask Question → Update Mastery → Update Plan → END   (session complete skips Generate Lesson)

const sessionOf = (state) => {
  const session = store.get().sessions[state.sessionId];
  if (!session) throw httpError(404, 'Learning session not found');
  return session;
};

const say = (session, role, type, text) => session.transcript.push({ role, type, text, at: new Date().toISOString() });

const initialDifficulty = (overall) => (overall < 35 ? 1 : overall < 60 ? 2 : overall < 80 ? 3 : 4);

// ---------- start path ----------

function loadTopic(state) {
  const s = store.get();
  const topic = s.analyzedTopics.find((t) => canon(t.name) === canon(state.currentTopic));
  if (!topic) throw httpError(404, `Unknown topic "${state.currentTopic}". Run an assessment first.`);
  const mastery = s.mastery[topic.name];
  const id = randomUUID().slice(0, 8);
  s.sessions[id] = {
    id,
    topic: topic.name,
    mode: topic.category,
    workspace: topic.workspace || 'generic_workspace',
    rationale: '',
    difficulty: initialDifficulty(mastery.overall),
    outline: [],
    stepIndex: 0,
    attempts: 0,
    qCount: 0,
    lesson: null,
    question: null,
    hintUsed: false,
    status: 'active',
    startMastery: mastery.overall,
    history: [],
    transcript: [],
    lastEvaluation: null,
    createdAt: new Date().toISOString(),
  };
  return { sessionId: id, currentTopic: topic.name };
}

async function determineStrategy(state) {
  const s = store.get();
  const session = sessionOf(state);
  const topic = s.analyzedTopics.find((t) => t.name === session.topic);
  const topicMisconceptions = s.misconceptions.filter((m) => m.topic === session.topic).map((m) => m.text);
  const { strategy, source } = await chooseStrategy({ topic, mastery: s.mastery[session.topic], misconceptions: topicMisconceptions });
  session.mode = strategy.mode;
  session.rationale = strategy.rationale;
  session.outline = strategy.outline.map((o, i) => ({ id: i, ...o, status: i === 0 ? 'current' : 'pending' }));
  return { learningMode: strategy.mode, sources: { ...state.sources, strategy: source } };
}

// ---------- lesson generation (first step, next step, or re-teach) ----------

async function generateLesson(state) {
  const s = store.get();
  const session = sessionOf(state);
  const topic = s.analyzedTopics.find((t) => t.name === session.topic);
  const step = session.outline[session.stepIndex];
  const reteach = state.nextAction === 'reteach' ? session.pendingReteach : null;

  const { content, source } = await generateStep({
    topic,
    mode: session.mode,
    step,
    stepIndex: session.stepIndex,
    totalSteps: session.outline.length,
    difficulty: session.difficulty,
    mastery: s.mastery[session.topic],
    recent: session.history.slice(-3),
    reteach,
    style: reteach?.style,
  });

  session.pendingReteach = null;
  session.lesson = { ...content.lesson, step_title: step.title, step_kind: step.kind, reteach: Boolean(reteach), misconception_addressed: content.misconception_addressed };
  session.qCount += 1;
  session.question = { ...content.question, id: `${session.id}-q${session.qCount}`, difficulty: session.difficulty };
  session.hintUsed = false;
  say(session, 'coach', reteach ? 'reteach' : 'lesson', content.lesson.body);
  return { lessonContent: session.lesson, sources: { ...state.sources, lesson: source } };
}

function askQuestion(state) {
  const session = sessionOf(state);
  say(session, 'coach', 'question', session.question.prompt);
  return { currentQuestion: session.question, nextAction: 'await_answer' };
}

// ---------- answer path ----------

async function evaluate(state) {
  const s = store.get();
  const session = sessionOf(state);
  if (session.status !== 'active' || !session.question) throw httpError(409, 'This session has no open question.');
  const topic = s.analyzedTopics.find((t) => t.name === session.topic);
  if (session.question.type === 'mcq') {
    const idx = Number(state.studentAnswer);
    if (!Number.isInteger(idx) || idx < 0 || idx >= session.question.options.length) {
      throw httpError(400, 'For multiple-choice questions, answer with the option index.');
    }
  }
  const evaluation = await evaluateAnswer({
    topic,
    question: session.question,
    answer: state.studentAnswer,
    confidence: state.answerConfidence,
    hintUsed: session.hintUsed,
  });
  say(session, 'student', 'answer', typeof state.studentAnswer === 'number' ? session.question.options?.[state.studentAnswer] ?? String(state.studentAnswer) : String(state.studentAnswer));
  session.attempts += 1;
  session.history.push({
    step: session.outline[session.stepIndex].title,
    question: session.question.prompt,
    correct: evaluation.correct,
    score: evaluation.score,
    misconception: evaluation.misconception,
  });
  session.lastEvaluation = evaluation;
  return { evaluation, sources: { ...state.sources, evaluation: evaluation.source } };
}

function increaseMastery(state) {
  const session = sessionOf(state);
  session.outline[session.stepIndex].status = 'done';
  session.attempts = 0;
  session.lastEvaluation.explanation = session.question.explanation;
  say(session, 'coach', 'feedback', state.evaluation.feedback);
  return { nextAction: 'advance' };
}

function detectMisconception(state) {
  const s = store.get();
  const session = sessionOf(state);
  const { evaluation } = state;
  if (evaluation.misconception) {
    s.misconceptions.push({ topic: session.topic, text: evaluation.misconception, at: new Date().toISOString() });
  }
  say(session, 'coach', 'feedback', evaluation.feedback);

  if (session.attempts >= MAX_ATTEMPTS_PER_STEP) {
    // don't trap the student: reveal, flag for revisit, move on
    session.outline[session.stepIndex].status = 'revisit';
    session.attempts = 0;
    session.lastEvaluation.explanation = session.question.explanation;
    session.lastEvaluation.moved_on = true;
    return { nextAction: 'move_on' };
  }

  session.pendingReteach = {
    misconception: evaluation.misconception || 'The student is unsure about this idea.',
    previous_question: session.question.prompt,
    student_answer: String(state.studentAnswer),
    attempt: session.attempts,
  };
  return { nextAction: 'reteach' };
}

function prepareRephrase(state) {
  const session = sessionOf(state);
  if (session.status !== 'active') throw httpError(409, 'This session is already complete.');
  session.pendingReteach = {
    misconception: null,
    previous_question: session.question?.prompt,
    student_answer: null,
    style: state.rephraseStyle || 'different',
  };
  return { nextAction: 'reteach', evaluation: null };
}

function adjustDifficulty(state) {
  const session = sessionOf(state);
  session.difficulty = clamp(session.difficulty + (state.evaluation?.difficulty_adjustment ?? 0), 1, 5);
  session.stepIndex += 1;
  if (session.stepIndex >= session.outline.length) {
    session.status = 'complete';
    session.question = null;
    return { nextAction: 'session_complete' };
  }
  session.outline[session.stepIndex].status = 'current';
  return { nextAction: 'teach_next' };
}

function updateMastery(state) {
  if (!state.evaluation) return {};
  const s = store.get();
  const session = sessionOf(state);
  applyEvidence(s.mastery[session.topic], state.evaluation.dimension, state.evaluation.score, `${session.topic} · ${state.evaluation.correct ? 'correct' : 'incorrect'} answer`);
  return {};
}

async function updatePlan(state) {
  if (!state.evaluation) return {};
  const s = store.get();
  const session = sessionOf(state);
  const complete = session.status === 'complete';
  if (complete) {
    // studying happened today: tick off today's pending learn/practice blocks for this topic
    const today = toDateOnly(startOfDay());
    for (const day of s.plan?.days || []) {
      if (day.date > today) continue;
      for (const b of day.blocks) {
        if (b.topic === session.topic && b.status === 'pending' && (b.type === 'learn' || b.type === 'practice')) b.status = 'done';
      }
    }
  }
  try {
    const result = await replan({
      trigger: { type: 'learning', topic: session.topic, mastery_from: session.startMastery, mastery_to: s.mastery[session.topic].overall },
      narrate: complete,
      record: complete,
    });
    return { planChanges: result.changes, planUpdate: result.update };
  } catch (err) {
    console.warn('[replan] failed:', err.message);
    return { planChanges: [], planUpdate: null };
  }
}

const builder = new StateGraph(StudyState)
  .addNode('loadTopic', loadTopic)
  .addNode('determineStrategy', determineStrategy)
  .addNode('generateLesson', generateLesson)
  .addNode('askQuestion', askQuestion)
  .addNode('evaluate', evaluate)
  .addNode('increaseMastery', increaseMastery)
  .addNode('detectMisconception', detectMisconception)
  .addNode('prepareRephrase', prepareRephrase)
  .addNode('adjustDifficulty', adjustDifficulty)
  .addNode('updateMastery', updateMastery)
  .addNode('updatePlan', updatePlan)
  .addConditionalEdges(
    START,
    (s) => ({ start: 'loadTopic', answer: 'evaluate', rephrase: 'prepareRephrase' })[s.action],
    ['loadTopic', 'evaluate', 'prepareRephrase'],
  )
  .addEdge('loadTopic', 'determineStrategy')
  .addEdge('determineStrategy', 'generateLesson')
  .addEdge('generateLesson', 'askQuestion')
  .addConditionalEdges('askQuestion', (s) => (s.action === 'start' ? END : 'updateMastery'), ['updateMastery', END])
  .addConditionalEdges('evaluate', (s) => (s.evaluation.correct ? 'increaseMastery' : 'detectMisconception'), ['increaseMastery', 'detectMisconception'])
  .addEdge('increaseMastery', 'adjustDifficulty')
  .addConditionalEdges('detectMisconception', (s) => (s.nextAction === 'move_on' ? 'adjustDifficulty' : 'generateLesson'), ['adjustDifficulty', 'generateLesson'])
  .addEdge('prepareRephrase', 'generateLesson')
  .addConditionalEdges('adjustDifficulty', (s) => (s.nextAction === 'session_complete' ? 'updateMastery' : 'generateLesson'), ['updateMastery', 'generateLesson'])
  .addEdge('updateMastery', 'updatePlan')
  .addEdge('updatePlan', END);

export const learningGraph = builder.compile();
