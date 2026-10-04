import { callStructured } from '../llm/mesh.js';
import { PriorityNarrative } from '../schemas/index.js';
import { computePriorities } from '../services/priority.js';
import { canon } from '../data/knowledge.js';

const SYSTEM = `You are the Priority Agent of an AI study coach.
You are given topics with ALREADY-COMPUTED priority scores and factors. Do NOT change or invent scores.
For each topic write a short "why" (1-2 sentences, calm mentor tone, second person) explaining why it ranks where it does,
using only the provided factors and reasons.`;

/** Scores are deterministic; the LLM only writes the qualitative explanation. */
export async function rankTopics({ analyzedTopics, dependencies, mastery, ctx, withNarrative = true }) {
  const rows = computePriorities(analyzedTopics, dependencies, mastery, ctx);
  if (!withNarrative) return { priorities: rows, source: 'rules' };

  const { data, source } = await callStructured({
    schema: PriorityNarrative,
    name: 'priority_explanations',
    system: SYSTEM,
    user: rows.map((r) => ({
      topic: r.topic,
      rank: r.rank,
      score: r.score,
      factors: r.factors,
      reasons: r.reasons,
      recommended_hours: r.recommended_hours,
    })),
    fallback: () => ({ explanations: [] }),
  });

  const why = new Map(data.explanations.map((e) => [canon(e.topic), e.why]));
  const priorities = rows.map((r) => ({
    ...r,
    explanation: why.get(canon(r.topic)) || r.reasons.join(' '),
  }));
  return { priorities, source };
}
