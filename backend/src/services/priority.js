import { canon } from '../data/knowledge.js';
import { clamp } from './dates.js';

export const PRIORITY_WEIGHTS = {
  weakness: 0.3,
  importance: 0.25,
  urgency: 0.2,
  difficulty: 0.15,
  dependency_impact: 0.1,
};

export const TARGET_MASTERY = 0.9;

/** Hours still needed for a topic given its current mastery (0-100). */
export function remainingHours(topic, masteryPct) {
  const m0 = topic.initial_mastery / 100;
  const m = masteryPct / 100;
  const perUnit = topic.estimated_hours / Math.max(0.3, TARGET_MASTERY - m0);
  return perUnit * Math.max(0, TARGET_MASTERY - m);
}

function transitiveDependents(name, dependencies) {
  // how many topics (directly or indirectly) require `name`
  const key = canon(name);
  const seen = new Set();
  const stack = [key];
  while (stack.length) {
    const cur = stack.pop();
    for (const [topic, reqs] of Object.entries(dependencies)) {
      const tk = canon(topic);
      if (!seen.has(tk) && reqs.some((r) => canon(r) === cur)) {
        seen.add(tk);
        stack.push(tk);
      }
    }
  }
  return [...seen];
}

export function tierFor(score) {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

/**
 * Deterministic priority ranking. All factors are 0-100; score is their weighted sum.
 * @param analyzedTopics topics from the assessment agent
 * @param dependencies   { topic: [prereq names] }
 * @param masteryMap     { topic: {overall} }  (current mastery drives weakness)
 * @param ctx            { daysLeft, dailyHours }
 */
export function computePriorities(analyzedTopics, dependencies, masteryMap, ctx) {
  const available = Math.max(0.5, ctx.daysLeft * ctx.dailyHours);
  const needed = analyzedTopics.reduce(
    (sum, t) => sum + remainingHours(t, masteryMap[t.name]?.overall ?? t.initial_mastery),
    0,
  );
  const timePressure = clamp(needed / available, 0, 1);

  const dependentCounts = analyzedTopics.map((t) => transitiveDependents(t.name, dependencies).length);
  const maxDependents = Math.max(1, ...dependentCounts);

  const rows = analyzedTopics.map((t, i) => {
    const mastery = masteryMap[t.name]?.overall ?? t.initial_mastery;
    const weakness = clamp(100 - mastery, 0, 100);
    const factors = {
      weakness,
      importance: clamp(t.exam_importance * 10, 0, 100),
      urgency: Math.round(100 * timePressure * (0.4 + 0.6 * (weakness / 100))),
      difficulty: clamp(t.difficulty * 10, 0, 100),
      dependency_impact: Math.round((dependentCounts[i] / maxDependents) * 100),
    };
    const contributions = {};
    let score = 0;
    for (const [k, w] of Object.entries(PRIORITY_WEIGHTS)) {
      contributions[k] = Math.round(w * factors[k] * 10) / 10;
      score += w * factors[k];
    }
    score = Math.round(clamp(score, 0, 100));
    const hours = remainingHours(t, mastery);

    return {
      topic: t.name,
      score,
      tier: tierFor(score),
      workspace: t.workspace,
      mastery,
      difficulty: t.difficulty,
      estimated_hours: t.estimated_hours,
      recommended_hours: Math.round(hours * 4) / 4,
      factors,
      contributions,
      reasons: buildReasons(t, mastery, factors, hours, transitiveDependents(t.name, dependencies), analyzedTopics),
    };
  });

  rows.sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function buildReasons(topic, mastery, f, hours, dependentKeys, all) {
  const reasons = [];
  if (mastery < 30) reasons.push('Your confidence is very low.');
  else if (mastery < 50) reasons.push('Your confidence is low.');
  else if (mastery >= 80) reasons.push('You already know this well.');
  if (f.difficulty >= 70) reasons.push('It is highly difficult.');
  if (f.importance >= 70) reasons.push('It carries high exam importance.');
  if (hours >= 2.5) reasons.push('It requires significant practice.');
  if (dependentKeys.length) {
    const names = all.filter((t) => dependentKeys.includes(canon(t.name))).map((t) => t.name);
    reasons.push(`Other topics build on it (${names.slice(0, 3).join(', ')}).`);
  }
  if (f.urgency >= 70) reasons.push('The exam is close relative to the work needed.');
  if (!reasons.length) reasons.push('Balanced across weakness, difficulty and importance.');
  return reasons;
}
