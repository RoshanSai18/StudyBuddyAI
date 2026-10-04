import { callStructured } from '../llm/mesh.js';
import { AssessmentOutput } from '../schemas/index.js';
import { BASE_DIFFICULTY, canon, guessCategory } from '../data/knowledge.js';
import { clamp, daysUntil } from '../services/dates.js';
import { guessWorkspace } from '../data/workspaces.js';

const SYSTEM = `You are the Assessment Agent of an AI study coach.
For each topic the student lists, estimate:
- category: programming | theory | math | sql | general (how it is best taught)
- difficulty: 1-10 intrinsic difficulty for a typical student
- estimated_hours: hours THIS student needs, given their confidence, to become exam-ready (~90% mastery)
- exam_importance: 1-10 likelihood/weight in a typical exam for this subject
- weak_area: true if the student is likely weak here
Also list missing_info: anything important that would improve the plan (short strings).
Return every topic exactly once, using the exact topic names given.`;

function heuristic(t) {
  const key = canon(t.name);
  const difficulty = BASE_DIFFICULTY[key] ?? 5;
  const weakness = 1 - (t.confidence / 10) * 0.8;
  return {
    name: t.name,
    category: guessCategory(t.name),
    difficulty,
    estimated_hours: clamp(0.5 + difficulty * 0.4 * weakness, 0.5, 8),
    exam_importance: 6,
    weak_area: t.confidence <= 4,
  };
}

const roundQuarter = (h) => Math.round(h * 4) / 4;

export async function assessTopics(profile) {
  const { data, source } = await callStructured({
    schema: AssessmentOutput,
    name: 'assess_topics',
    system: SYSTEM,
    user: {
      subject: profile.subject,
      daysUntilExam: daysUntil(profile.examDate),
      dailyHours: profile.dailyHours,
      topics: profile.topics.map((t) => ({ name: t.name, confidence: t.confidence, importance: t.importance ?? null })),
    },
    fallback: () => ({ topics: profile.topics.map(heuristic), missing_info: [] }),
  });

  const byKey = new Map(data.topics.map((t) => [canon(t.name), t]));
  const topics = profile.topics.map((input) => {
    const est = byKey.get(canon(input.name)) ?? heuristic(input);
    return {
      name: input.name,
      subject: input.subject || profile.subject,
      confidence: input.confidence,
      category: est.category,
      difficulty: clamp(Math.round(est.difficulty), 1, 10),
      estimated_hours: roundQuarter(clamp(est.estimated_hours, 0.25, 12)),
      exam_importance: input.importance ?? est.exam_importance,
      importance_provided: input.importance != null,
      weak_area: input.confidence <= 4 || est.weak_area,
      initial_mastery: Math.round(input.confidence * 10),
      // Deterministic, zero-cost: every onboarded topic also gets a workspace so its theming/affordances
      // (see data/workspaces.js) are consistent whether it came from the onboarding form or a free-text ask.
      workspace: guessWorkspace(input.name),
    };
  });

  const missing = [...data.missing_info];
  const noImportance = topics.filter((t) => !t.importance_provided).map((t) => t.name);
  if (noImportance.length) missing.push(`Exam importance not provided for: ${noImportance.join(', ')} (estimated).`);
  if (daysUntil(profile.examDate) <= 2) missing.push('The exam is very close; the plan will be very compressed.');

  return { topics, missingInfo: [...new Set(missing)], source };
}
