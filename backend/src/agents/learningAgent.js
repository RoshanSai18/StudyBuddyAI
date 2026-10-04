import { callStructured } from '../llm/mesh.js';
import { DIMENSIONS, QuizOutput, StepOutput, StrategyOutput } from '../schemas/index.js';

// ---------------------------------------------------------------------------
// Strategy: how should THIS topic be taught?
// ---------------------------------------------------------------------------

const STRATEGY_SYSTEM = `You are the Learning Agent of an AI tutor. Pick the best way to teach one topic.
Choose mode: programming | theory | math | sql | general, then an outline of 5-7 steps.
Reference flows:
- programming: concept → pseudocode → code example → trace execution → practice problem → debugging challenge
- theory: concept → analogy → real-world example → comparison → recall questions
- math: intuition → formula → worked example → student solves → practice
- sql: concept → sample table → query → student writes query → evaluate → challenge
Adapt the flow to the topic and the student's current mastery (weak students get more concept/analogy steps first;
strong students get fewer basics and a challenge). Each step has a kind and the mastery dimension it exercises:
concept | recall | problem_solving | application. Cover at least 3 different dimensions overall.`;

const OUTLINES = {
  programming: [
    ['Core concept', 'concept', 'concept'],
    ['Pseudocode and code', 'code', 'concept'],
    ['Trace the execution', 'trace', 'application'],
    ['Recall check', 'recall', 'recall'],
    ['Practice problem', 'practice', 'problem_solving'],
    ['Debugging challenge', 'challenge', 'application'],
  ],
  theory: [
    ['Core concept', 'concept', 'concept'],
    ['An analogy', 'analogy', 'concept'],
    ['Real-world example', 'example', 'application'],
    ['Compare and contrast', 'concept', 'concept'],
    ['Recall questions', 'recall', 'recall'],
    ['Apply it', 'application', 'problem_solving'],
  ],
  math: [
    ['Intuition', 'concept', 'concept'],
    ['The formula', 'recall', 'recall'],
    ['Worked example', 'worked_example', 'concept'],
    ['Solve one yourself', 'practice', 'problem_solving'],
    ['Practice', 'practice', 'problem_solving'],
    ['Apply it', 'application', 'application'],
  ],
  sql: [
    ['Core concept', 'concept', 'concept'],
    ['A sample table', 'example', 'concept'],
    ['Query walkthrough', 'worked_example', 'application'],
    ['Write a query', 'practice', 'problem_solving'],
    ['Recall the syntax', 'recall', 'recall'],
    ['Challenge', 'challenge', 'application'],
  ],
  general: [
    ['Core concept', 'concept', 'concept'],
    ['Example', 'example', 'application'],
    ['Recall check', 'recall', 'recall'],
    ['Practice', 'practice', 'problem_solving'],
    ['Apply it', 'application', 'application'],
  ],
};

export async function chooseStrategy({ topic, mastery, misconceptions }) {
  const category = topic.category || 'general';
  const { data, source } = await callStructured({
    schema: StrategyOutput,
    name: 'teaching_strategy',
    system: STRATEGY_SYSTEM,
    user: {
      topic: topic.name,
      subject: topic.subject,
      likely_category: category,
      difficulty: topic.difficulty,
      student_mastery: mastery?.overall,
      past_misconceptions: misconceptions.slice(-3),
    },
    fallback: () => ({
      mode: category,
      rationale: `Using the standard ${category} teaching flow.`,
      outline: (OUTLINES[category] || OUTLINES.general).map(([title, kind, dimension]) => ({ title, kind, dimension })),
    }),
  });
  return { strategy: data, source };
}

// ---------------------------------------------------------------------------
// Step generation: one lesson chunk + one check question
// ---------------------------------------------------------------------------

const STEP_SYSTEM = `You are an expert, patient tutor. Produce ONE lesson step and ONE question that checks it.
Lesson:
- body: markdown, at most ~180 words, plain and concrete. Use a small example. No filler.
- code: a short code/pseudocode/SQL snippet only when it genuinely helps (else null); code_language accordingly.
- visual: an ASCII diagram or small table when it helps (else null).
Question (must test THIS step and the given dimension):
- type "mcq": exactly 4 options, correct_index (0-3), option_misconceptions = array of 4 where the correct option is null and each wrong option
  names the specific misconception a student who picks it likely holds. model_answer = null.
- type "text" or "code": options, correct_index, option_misconceptions = null; model_answer = the key points a correct answer must contain.
- hint: a nudge that does NOT reveal the answer. explanation: why the correct answer is correct.
Difficulty 1-5 sets how demanding the question is. Prefer mcq for recall/concept, text/code for problem_solving/application.
Never leak the answer in the prompt or hint.
If a reteach context is given: the student answered wrongly. Do NOT repeat your earlier explanation. Address the named misconception with a
DIFFERENT approach (new analogy or a smaller concrete example), then ask a NEW question on the same idea, a bit easier. Set misconception_addressed.`;

function fallbackStep({ topic, step, stepIndex, reteach }) {
  const t = topic.name;
  const options = [
    `${step.title} is a central idea in ${t}.`,
    `${step.title} has nothing to do with ${t}.`,
    `${step.title} only matters for tiny inputs.`,
    `${step.title} is always optional in ${t}.`,
  ];
  const correct = stepIndex % 4;
  [options[0], options[correct]] = [options[correct], options[0]];
  return {
    lesson: {
      title: reteach ? `Let's try another angle: ${step.title}` : step.title,
      body: `*(AI tutor is offline — placeholder content.)*\n\nThis step covers **${step.title}** in **${t}**. ${reteach ? 'Think about it from a smaller, simpler example.' : 'Read the idea, then answer the check question.'}`,
      code: null,
      code_language: null,
      visual: null,
    },
    question: {
      type: 'mcq',
      prompt: `Which statement about "${step.title}" in ${t} is correct?`,
      options,
      correct_index: correct,
      option_misconceptions: options.map((_, i) => (i === correct ? null : `Misjudging how "${step.title}" relates to ${t}.`)),
      model_answer: null,
      hint: `Re-read the lesson: which option actually connects "${step.title}" to ${t}?`,
      explanation: `"${step.title}" is a central idea in ${t}.`,
      dimension: step.dimension,
    },
    misconception_addressed: reteach?.misconception ?? null,
  };
}

/** Make a model-produced question safe to use (an mcq without usable options degrades to text). */
export function normalizeQuestion(q) {
  const question = {
    ...q,
    hint: q.hint || 'Re-read the lesson and think about the core idea.',
    explanation: q.explanation || '',
  };
  if (question.type === 'mcq') {
    const ok =
      Array.isArray(question.options) &&
      question.options.length >= 2 &&
      Number.isInteger(question.correct_index) &&
      question.correct_index >= 0 &&
      question.correct_index < question.options.length;
    if (!ok) {
      question.type = 'text';
      question.options = null;
      question.correct_index = null;
      question.option_misconceptions = null;
      question.model_answer = question.model_answer || question.explanation;
    }
  } else {
    question.options = null;
    question.correct_index = null;
    question.option_misconceptions = null;
    question.model_answer = question.model_answer || question.explanation;
  }
  return question;
}

export async function generateStep({ topic, mode, step, stepIndex, totalSteps, difficulty, mastery, recent, reteach, style }) {
  const { data, source } = await callStructured({
    schema: StepOutput,
    name: 'lesson_step',
    system: STEP_SYSTEM,
    user: {
      topic: topic.name,
      subject: topic.subject,
      teaching_mode: mode,
      step: { number: stepIndex + 1, of: totalSteps, title: step.title, kind: step.kind, dimension: step.dimension },
      difficulty,
      student_mastery: mastery?.overall,
      recent_answers: recent,
      reteach: reteach ? { ...reteach } : null,
      requested_style: style || null,
    },
    fallback: () => fallbackStep({ topic, step, stepIndex, reteach }),
  });
  const lesson = { code: null, code_language: null, visual: null, ...data.lesson };
  return {
    content: {
      lesson,
      question: normalizeQuestion({
        ...data.question,
        hint: data.question.hint ?? data.hint,
        explanation: data.question.explanation ?? data.explanation,
        dimension: step.dimension,
      }),
      misconception_addressed: data.misconception_addressed ?? null,
    },
    source,
  };
}

// ---------------------------------------------------------------------------
// Quiz generation
// ---------------------------------------------------------------------------

const QUIZ_SYSTEM = `You are an exam-setter. Write a short quiz on ONE topic.
Mix the dimensions concept, recall, problem_solving and application. Mostly mcq (exactly 4 options, correct_index,
option_misconceptions with null for the correct option) plus at most one text question (model_answer = key points).
Each question needs a hint and an explanation of the correct answer. Questions must be independent of each other.`;

function fallbackQuiz(topic, count) {
  const dims = ['concept', 'recall', 'problem_solving', 'application'];
  return {
    questions: Array.from({ length: count }, (_, i) => {
      const step = { title: `${topic.name} idea ${i + 1}`, dimension: dims[i % 4] };
      return fallbackStep({ topic, step, stepIndex: i, reteach: null }).question;
    }),
  };
}

export async function generateQuiz({ topic, count, difficulty, mastery, misconceptions }) {
  const { data, source } = await callStructured({
    schema: QuizOutput,
    name: 'topic_quiz',
    system: QUIZ_SYSTEM,
    user: {
      topic: topic.name,
      subject: topic.subject,
      question_count: count,
      difficulty,
      student_mastery: mastery?.overall,
      probe_these_misconceptions: misconceptions.slice(-3),
    },
    fallback: () => fallbackQuiz(topic, count),
  });
  const questions = data.questions.slice(0, count).map((q, i) => normalizeQuestion({ ...q, dimension: q.dimension || DIMENSIONS[i % DIMENSIONS.length] }));
  return { questions, source };
}
