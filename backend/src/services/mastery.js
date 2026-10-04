import { DIMENSIONS } from '../schemas/index.js';
import { clamp } from './dates.js';

export const MASTERY_WEIGHTS = { concept: 0.3, recall: 0.2, problem_solving: 0.3, application: 0.2 };

export function computeOverall(dims) {
  let total = 0;
  for (const d of DIMENSIONS) total += MASTERY_WEIGHTS[d] * dims[d];
  return Math.round(total);
}

/** Start every dimension at the student's self-rated confidence (a weak prior). */
export function initMastery(confidence) {
  const prior = clamp(Math.round(confidence * 10), 0, 100);
  const dims = Object.fromEntries(DIMENSIONS.map((d) => [d, prior]));
  return {
    ...dims,
    overall: prior,
    prior,
    measured: false,
    evidence: Object.fromEntries(DIMENSIONS.map((d) => [d, 0])),
    history: [{ at: new Date().toISOString(), overall: prior, reason: 'self-rated confidence' }],
  };
}

/**
 * Blend a new score (0-100) for one dimension into the mastery record.
 * First observations move the score a lot (alpha 0.5), later ones less (floor 0.25).
 */
export function applyEvidence(mastery, dimension, score, reason = 'answer') {
  const dim = DIMENSIONS.includes(dimension) ? dimension : 'concept';
  const n = mastery.evidence[dim];
  const alpha = Math.max(0.25, 1 / (n + 2));
  mastery[dim] = Math.round(mastery[dim] + alpha * (clamp(score, 0, 100) - mastery[dim]));
  mastery.evidence[dim] = n + 1;
  mastery.overall = computeOverall(mastery);
  mastery.measured = true;
  mastery.history.push({ at: new Date().toISOString(), overall: mastery.overall, reason });
  return mastery;
}

export function publicMastery(m) {
  if (!m) return null;
  return {
    concept: m.concept,
    recall: m.recall,
    problem_solving: m.problem_solving,
    application: m.application,
    overall: m.overall,
    measured: m.measured,
    history: m.history,
  };
}
