import { callStructured } from '../llm/mesh.js';
import { EvaluationOutput } from '../schemas/index.js';

const PASS_SCORE = 70;

const SYSTEM = `You are the Evaluation Agent of an AI tutor. Grade ONE student answer against the key points.
- score 0-100 reflects correctness AND conceptual understanding; partial credit is allowed.
- misconception: if wrong or partly wrong, name the specific underlying misconception in one short sentence; else null.
- feedback: 1-3 sentences, encouraging. If the answer is wrong, do NOT give the full correct answer; point toward the idea.
- recommended_action: advance | teach_again | practice_more | challenge.
- difficulty_adjustment: -1, 0 or 1.`;

function parseChoice(answer, options) {
  if (typeof answer === 'number') return answer;
  const s = String(answer ?? '').trim();
  if (/^\d+$/.test(s)) return Number(s);
  return options.findIndex((o) => o.trim().toLowerCase() === s.toLowerCase());
}

const tokens = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9]{4,}/g) || []);

function heuristicScore(answer, modelAnswer) {
  const key = tokens(modelAnswer);
  if (!key.size) return String(answer).trim().length > 20 ? 60 : 20;
  const got = tokens(answer);
  let hit = 0;
  for (const k of key) if (got.has(k)) hit++;
  return Math.round(Math.min(100, (hit / key.size) * 120));
}

function finish(partial, question, { confidence, hintUsed, source }) {
  const score = Math.round(partial.score);
  const correct = score >= PASS_SCORE;
  const adj = correct ? (score >= 85 ? 1 : 0) : -1;
  return {
    correct,
    score,
    misconception: correct ? null : partial.misconception ?? null,
    feedback: partial.feedback,
    recommended_action: correct ? (adj > 0 ? 'challenge' : 'advance') : partial.recommended_action === 'practice_more' ? 'practice_more' : 'teach_again',
    difficulty_adjustment: adj,
    dimension: question.dimension,
    overconfident: Boolean(confidence && confidence >= 4 && !correct),
    hint_used: Boolean(hintUsed),
    source,
  };
}

/**
 * Evaluate one answer. MCQs are graded by code (no LLM call); free text / code goes to the LLM.
 * `question` is the full server-side question (with answer keys).
 */
export async function evaluateAnswer({ topic, question, answer, confidence, hintUsed }) {
  const ctx = { confidence, hintUsed };

  if (question.type === 'mcq') {
    const idx = parseChoice(answer, question.options);
    const valid = Number.isInteger(idx) && idx >= 0 && idx < question.options.length;
    const correct = valid && idx === question.correct_index;
    if (correct) {
      return finish(
        { score: hintUsed ? 85 : 100, feedback: `Correct. ${question.explanation}`, recommended_action: 'advance' },
        question,
        { ...ctx, source: 'rules' },
      );
    }
    const misconception = valid
      ? question.option_misconceptions?.[idx] || `Choosing "${question.options[idx]}" suggests a gap in this idea.`
      : null;
    return finish(
      { score: 0, misconception, feedback: valid ? 'Not quite. Let\'s look at it from another angle.' : 'Please pick one of the options.', recommended_action: 'teach_again' },
      question,
      { ...ctx, source: 'rules' },
    );
  }

  const { data, source } = await callStructured({
    schema: EvaluationOutput,
    name: 'evaluate_answer',
    system: SYSTEM,
    user: { topic: topic.name, question: question.prompt, key_points: question.model_answer, student_answer: String(answer ?? '') },
    fallback: () => {
      const score = heuristicScore(answer, question.model_answer);
      return {
        correct: score >= PASS_SCORE,
        score,
        misconception: score >= PASS_SCORE ? null : 'Answer is missing key ideas.',
        feedback: score >= PASS_SCORE ? 'Good — you covered the key ideas.' : 'You are missing some key ideas. Think about what the question is really asking.',
        recommended_action: score >= PASS_SCORE ? 'advance' : 'teach_again',
        difficulty_adjustment: 0,
      };
    },
  });
  return finish(data, question, { ...ctx, source: source === 'llm' ? 'llm' : 'fallback' });
}
