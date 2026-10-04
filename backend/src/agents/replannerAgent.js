import { randomUUID } from 'node:crypto';
import { callStructured } from '../llm/mesh.js';
import { ReplanNarrative } from '../schemas/index.js';
import { httpError } from '../middleware/errors.js';
import { store } from '../services/store.js';
import { buildPlan } from '../services/scheduler.js';
import { diffPlans, fmtMinutes } from '../services/planDiff.js';
import { rankTopics } from './priorityAgent.js';
import { packagePlan, plannerTopics, replanDays } from './plannerAgent.js';

const SYSTEM = `You are the Replanner Agent of an AI study coach.
The student's study plan was just updated because their measured mastery changed.
You get the trigger and a list of per-topic time changes with current mastery. Write:
- headline: <= 12 words, e.g. "Graphs mastery improved faster than expected"
- summary: 2-3 sentences, calm mentor tone, second person, explaining what moved and why.
Use ONLY the numbers provided. Never invent minutes or percentages. Do not overstate progress: if mastery is still low, say so plainly.`;

function reasonFor(change, mastery) {
  const m = mastery[change.topic]?.overall;
  if (change.delta < 0) {
    return m >= 75
      ? `Mastery is ${m}%, so less time is needed.`
      : 'Time was rebalanced to fit the days that remain.';
  }
  return m < 50
    ? `Mastery is ${m}%, so this topic needs more practice.`
    : 'Extra time became available after other topics progressed.';
}

function deterministicNarrative(trigger, changes) {
  const cut = changes.filter((c) => c.delta < 0);
  const added = changes.filter((c) => c.delta > 0);
  const parts = [];
  if (trigger.topic && trigger.mastery_from != null && trigger.mastery_to != null) {
    parts.push(`${trigger.topic} mastery ${trigger.mastery_from}% → ${trigger.mastery_to}%.`);
  }
  for (const c of cut.slice(0, 2)) parts.push(`Reduced ${c.topic} by ${fmtMinutes(c.delta)}.`);
  for (const c of added.slice(0, 2)) parts.push(`Added ${fmtMinutes(c.delta)} to ${c.topic} (mastery ${c.mastery}%).`);
  const headline =
    trigger.topic && trigger.mastery_to > (trigger.mastery_from ?? 0)
      ? `${trigger.topic} is improving — your plan was adjusted`
      : 'Your study plan was updated';
  return { headline, summary: parts.join(' ') || 'Your plan was recalculated from your latest mastery.' };
}

/**
 * Recompute everything still pending from `asOf` onward using current mastery.
 * Finished blocks are kept; unfinished blocks from past days become "missed" and are rescheduled.
 *
 * @param trigger { type, topic?, mastery_from?, mastery_to? }
 * @param narrate ask the LLM for a headline/summary (only worth it for a user-visible update)
 * @param record  store the update in the plan-update history
 */
export async function replan({ trigger = { type: 'manual' }, asOf = new Date(), narrate = false, record = false } = {}) {
  const s = store.get();
  if (!s.plan) throw httpError(409, 'No study plan exists yet. Create one first.');

  const before = s.plan;
  const days = replanDays(before, s.profile, asOf);
  const daysLeft = days.filter((d) => d.schedulable).length;
  if (!daysLeft) return { updated: false, changes: [], update: null, reason: 'No study days remain before the exam.' };

  const { priorities: ranked } = await rankTopics({
    analyzedTopics: s.analyzedTopics,
    dependencies: s.dependencies,
    mastery: s.mastery,
    ctx: { daysLeft, dailyHours: s.profile.dailyHours },
    withNarrative: false,
  });
  const explanations = new Map(s.priorities.map((p) => [p.topic, p.explanation]));
  s.priorities = ranked.map((p) => ({ ...p, explanation: explanations.get(p.topic) || p.reasons.join(' ') }));

  const topics = plannerTopics({
    analyzedTopics: s.analyzedTopics,
    priorities: s.priorities,
    dependencies: s.dependencies,
    mastery: s.mastery,
  });
  const { schedule, validation } = buildPlan({ topics, days });
  s.plan = packagePlan({ schedule, profile: s.profile, warnings: validation.issues, previous: before });

  const changes = diffPlans(before, s.plan).map((c) => ({
    ...c,
    mastery: s.mastery[c.topic]?.overall ?? null,
    reason: reasonFor(c, s.mastery),
  }));

  let update = null;
  if (record && changes.length) {
    const fallback = deterministicNarrative(trigger, changes);
    let narrative = fallback;
    let source = 'rules';
    if (narrate) {
      const res = await callStructured({
        schema: ReplanNarrative,
        name: 'replan_narrative',
        system: SYSTEM,
        user: { trigger, changes: changes.map(({ topic, delta, before_minutes, after_minutes, mastery }) => ({ topic, delta_minutes: delta, before_minutes, after_minutes, mastery })) },
        fallback: () => fallback,
      });
      narrative = res.data;
      source = res.source === 'llm' ? 'llm' : 'rules';
    }
    update = {
      id: randomUUID().slice(0, 8),
      at: new Date().toISOString(),
      trigger,
      headline: narrative.headline,
      summary: narrative.summary,
      changes,
      source,
    };
    s.planUpdates.unshift(update);
  }

  return { updated: changes.length > 0, changes, update };
}
