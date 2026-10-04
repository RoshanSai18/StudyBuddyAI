import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { generateQuiz } from '../agents/learningAgent.js';
import { evaluateAnswer } from '../agents/evaluationAgent.js';
import { replan } from '../agents/replannerAgent.js';
import { httpError } from '../middleware/errors.js';
import { applyEvidence, publicMastery } from '../services/mastery.js';
import { store } from '../services/store.js';
import { publicQuestion, topicByName } from '../services/views.js';

export const router = Router();

// POST /api/quiz/generate — { topic, count? } → questions (answer keys stay on the server)
router.post('/quiz/generate', async (req, res) => {
  const { topic, count } = z.object({ topic: z.string().min(1), count: z.number().int().min(1).max(10).default(5) }).parse(req.body);
  const s = store.get();
  const known = topicByName(topic);
  if (!known) throw httpError(404, `Unknown topic "${topic}".`);

  const mastery = s.mastery[known.name];
  const difficulty = mastery.overall < 40 ? 2 : mastery.overall < 70 ? 3 : 4;
  const { questions, source } = await generateQuiz({
    topic: known,
    count,
    difficulty,
    mastery,
    misconceptions: s.misconceptions.filter((m) => m.topic === known.name).map((m) => m.text),
  });

  const id = randomUUID().slice(0, 8);
  const full = questions.map((q, i) => ({ ...q, id: `${id}-q${i + 1}`, difficulty }));
  s.quizzes[id] = { id, topic: known.name, questions: full, completed: false, graded: {}, masteryFrom: null };
  res.status(201).json({ quiz_id: id, topic: known.name, questions: full.map(publicQuestion), source });
});

// POST /api/quiz/evaluate — { quizId, answers: [{questionId, answer, confidence?}] }
// Answers can be sent one at a time (instant feedback per question) or all together. Mastery is updated per question;
// the plan is recalculated once the last question has been graded.
router.post('/quiz/evaluate', async (req, res) => {
  const body = z
    .object({
      quizId: z.string(),
      answers: z.array(z.object({ questionId: z.string(), answer: z.union([z.string(), z.number()]), confidence: z.number().int().min(1).max(5).optional() })).min(1),
    })
    .parse(req.body);

  const s = store.get();
  const quiz = s.quizzes[body.quizId];
  if (!quiz) throw httpError(404, 'Quiz not found.');

  const fresh = body.answers.filter((a) => !quiz.graded[a.questionId]);
  if (!fresh.length) throw httpError(409, 'Those questions were already submitted.');

  const topic = topicByName(quiz.topic);
  quiz.masteryFrom ??= s.mastery[quiz.topic].overall;

  const graded = await Promise.all(
    fresh.map(async (a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      if (!question) throw httpError(400, `Unknown question ${a.questionId}.`);
      const evaluation = await evaluateAnswer({ topic, question, answer: a.answer, confidence: a.confidence, hintUsed: false });
      return { question, evaluation };
    }),
  );

  for (const { question, evaluation } of graded) {
    quiz.graded[question.id] = evaluation;
    applyEvidence(s.mastery[quiz.topic], evaluation.dimension, evaluation.score, `${quiz.topic} · quiz`);
    if (evaluation.misconception) s.misconceptions.push({ topic: quiz.topic, text: evaluation.misconception, at: new Date().toISOString() });
  }
  quiz.completed = Object.keys(quiz.graded).length === quiz.questions.length;

  const results = graded.map(({ question, evaluation }) => ({
    question_id: question.id,
    correct: evaluation.correct,
    score: evaluation.score,
    feedback: evaluation.feedback,
    misconception: evaluation.misconception,
    explanation: question.explanation,
    correct_index: question.type === 'mcq' ? question.correct_index : null,
    dimension: question.dimension,
  }));
  const avg = (rows) => Math.round(rows.reduce((t, r) => t + r.score, 0) / rows.length);
  const allGraded = Object.values(quiz.graded);

  let replanResult = { changes: [], update: null };
  if (quiz.completed) {
    replanResult = await replan({
      trigger: { type: 'quiz', topic: quiz.topic, mastery_from: quiz.masteryFrom, mastery_to: s.mastery[quiz.topic].overall },
      narrate: true,
      record: true,
    }).catch(() => replanResult);
  }

  res.json({
    quiz_id: quiz.id,
    topic: quiz.topic,
    score: avg(results),
    correct_count: results.filter((r) => r.correct).length,
    total: results.length,
    results,
    answered: allGraded.length,
    quiz_total: quiz.questions.length,
    quiz_complete: quiz.completed,
    quiz_score: avg(allGraded),
    quiz_correct: allGraded.filter((r) => r.correct).length,
    mastery: publicMastery(s.mastery[quiz.topic]),
    plan_changes: replanResult.changes,
    plan_update: replanResult.update,
  });
});
