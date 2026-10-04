import { z } from 'zod';

export const DIMENSIONS = ['concept', 'recall', 'problem_solving', 'application'];
export const Dimension = z.enum(DIMENSIONS);
export const Category = z.enum(['programming', 'theory', 'math', 'sql', 'general']);

// Adaptive Subject Workspace: closed enums so intent detection is a safe, structured classification,
// never a free-form string used for routing. See data/workspaces.js for the subject → workspace mapping.
export const Subject = z.enum(['programming', 'chemistry', 'mathematics', 'physics', 'biology', 'other']);
export const TaskType = z.enum(['learn_concept', 'coding', 'debugging', 'problem_solving', 'practice', 'experiment', 'simulation', 'interactive_learning']);

export const IntentOutput = z.object({
  subject: Subject,
  topic: z.string().trim().min(1).max(60),
  task_type: TaskType,
});

export const IntentInput = z.object({
  text: z.string().trim().min(1, 'Type a question or topic.').max(400),
});

// ---------- Notes analysis (upload a PDF or paste text, get a study breakdown) ----------
export const NotesTopic = z.object({
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(240),
  difficulty: z.number().int().min(1).max(10),
  estimated_hours: z.number().min(0.25).max(12),
  importance: z.number().int().min(1).max(10),
});

export const NotesAnalysisOutput = z.object({
  subject: z.string().trim().min(1).max(80),
  overview: z.string().trim().min(1).max(600),
  topics: z.array(NotesTopic).min(1).max(12),
});

export const NotesTextInput = z.object({
  text: z.string().trim().min(20, 'Add a bit more text — at least a few sentences.').max(20000),
});

// ---------- Flashcards ----------
export const FlashcardOutput = z.object({
  front: z.string().trim().min(1).max(200),
  back: z.string().trim().min(1).max(400),
  dimension: Dimension.nullish(),
});

export const FlashcardSetOutput = z.object({
  cards: z.array(FlashcardOutput).min(1).max(15),
});

// ---------- API input ----------
export const ProfileInput = z.object({
  subject: z.string().trim().min(1).default('My Subject'),
  topics: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        confidence: z.number().min(1).max(10),
        importance: z.number().min(1).max(10).nullish(),
        subject: z.string().trim().optional(),
      }),
    )
    .min(1, 'Add at least one topic')
    .max(40),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'examDate must be YYYY-MM-DD'),
  dailyHours: z.number().min(0.5).max(16),
});

// ---------- LLM outputs ----------
export const AssessmentOutput = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      category: Category,
      difficulty: z.number().int().min(1).max(10),
      estimated_hours: z.number().min(0.25).max(12),
      exam_importance: z.number().int().min(1).max(10),
      weak_area: z.boolean(),
    }),
  ),
  missing_info: z.array(z.string()),
});

export const DependencyOutput = z.object({
  dependencies: z.array(z.object({ topic: z.string(), requires: z.array(z.string()) })),
});

export const PriorityNarrative = z.object({
  explanations: z.array(z.object({ topic: z.string(), why: z.string() })),
});

export const StrategyOutput = z.object({
  mode: Category,
  rationale: z.string(),
  outline: z
    .array(
      z.object({
        title: z.string(),
        kind: z.enum([
          'concept', 'analogy', 'example', 'worked_example', 'code', 'trace',
          'practice', 'recall', 'application', 'challenge', 'summary',
        ]),
        dimension: Dimension,
      }),
    )
    .min(3)
    .max(8),
});

// Fields that only apply to some question types are nullish: models often omit them instead of sending null.
const StepQuestion = z.object({
  type: z.enum(['mcq', 'text', 'code']),
  prompt: z.string(),
  options: z.array(z.string()).nullish(),
  correct_index: z.number().int().nullish(),
  option_misconceptions: z.array(z.string().nullish()).nullish(),
  model_answer: z.string().nullish(),
  hint: z.string().nullish(),
  explanation: z.string().nullish(),
});

// A lesson step already knows its mastery dimension, so the model doesn't choose it.
export const StepOutput = z.object({
  lesson: z.object({
    title: z.string(),
    body: z.string(),
    code: z.string().nullish(),
    code_language: z.string().nullish(),
    visual: z.string().nullish(),
  }),
  question: StepQuestion,
  misconception_addressed: z.string().nullish(),
  // some models put these beside `question` instead of inside it; generateStep hoists them
  hint: z.string().nullish(),
  explanation: z.string().nullish(),
});

export const QuizOutput = z.object({
  questions: z.array(StepQuestion.extend({ dimension: Dimension.nullish() })).min(1),
});

export const EvaluationOutput = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(100),
  misconception: z.string().nullable(),
  feedback: z.string(),
  recommended_action: z.enum(['advance', 'teach_again', 'practice_more', 'challenge']),
  difficulty_adjustment: z.number().int().min(-1).max(1),
});

export const ReplanNarrative = z.object({ headline: z.string(), summary: z.string() });
