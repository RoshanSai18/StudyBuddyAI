import { assessTopics } from '../agents/assessmentAgent.js';
import { rankTopics } from '../agents/priorityAgent.js';
import { replan } from '../agents/replannerAgent.js';
import { canon } from '../data/knowledge.js';
import { categoryForWorkspace } from '../data/workspaces.js';
import { planningGraph } from '../graph/planningGraph.js';
import { addDays, daysUntil, toDateOnly } from './dates.js';
import { initMastery } from './mastery.js';
import { store } from './store.js';

const DEFAULT_EXAM_DAYS = 14;
const DEFAULT_DAILY_HOURS = 2;
const ADHOC_CONFIDENCE = 5; // neutral prior: we don't know how confident the student is yet

function bootstrapProfile(subjectLabel) {
  return {
    subject: subjectLabel || 'My Studies',
    examDate: toDateOnly(addDays(new Date(), DEFAULT_EXAM_DAYS)),
    dailyHours: DEFAULT_DAILY_HOURS,
    topics: [],
  };
}

/**
 * Make sure `topicName` exists in the current session — analyzed and prioritized — creating a minimal
 * session first if the student hasn't onboarded yet. Reuses the exact agents the onboarding flow uses
 * (assessTopics, rankTopics, replan), so a topic asked via "Ask your tutor" becomes a first-class part
 * of the study plan / mastery / replanning loop rather than a side feature bolted onto it.
 */
export async function ensureTopicInSession(topicName, { subjectLabel, workspace } = {}) {
  const s = store.get();

  if (!s.profile) s.profile = bootstrapProfile(subjectLabel);

  const existing = s.analyzedTopics.find((t) => canon(t.name) === canon(topicName));
  if (existing) return { topic: existing, created: false };

  const { topics } = await assessTopics({ ...s.profile, topics: [{ name: topicName, confidence: ADHOC_CONFIDENCE }] });
  const category = categoryForWorkspace(workspace);
  const analyzed = { ...topics[0], workspace: workspace || topics[0].workspace, ...(category ? { category } : {}) };
  s.analyzedTopics.push(analyzed);
  s.mastery[analyzed.name] = initMastery(ADHOC_CONFIDENCE);

  // Cheap, deterministic re-rank so the new topic shows up in priorities/sidebar immediately; narrative
  // (an LLM call per topic) is skipped here and the previous explanations are kept, same pattern replan() uses.
  const daysLeft = Math.max(1, daysUntil(s.profile.examDate));
  const { priorities } = await rankTopics({
    analyzedTopics: s.analyzedTopics,
    dependencies: s.dependencies,
    mastery: s.mastery,
    ctx: { daysLeft, dailyHours: s.profile.dailyHours },
    withNarrative: false,
  });
  const prevExplanations = new Map(s.priorities.map((p) => [p.topic, p.explanation]));
  s.priorities = priorities.map((p) => ({ ...p, explanation: prevExplanations.get(p.topic) || p.reasons.join(' ') }));

  // Keep the plan in sync: build one (same codepath POST /plan uses) if there isn't one yet — e.g. the
  // very first thing the student ever did was ask a question — otherwise fold the new topic into the
  // existing schedule via the normal replanner, so it never just floats outside the plan.
  if (!s.plan) {
    const state = await planningGraph
      .invoke({
        stage: 'plan',
        profile: s.profile,
        analyzedTopics: s.analyzedTopics,
        dependencies: s.dependencies,
        priorities: s.priorities,
        masteryScores: s.mastery,
        sources: s.sources,
      })
      .catch(() => null);
    if (state) s.plan = state.studyPlan;
  } else {
    await replan({ trigger: { type: 'manual' }, narrate: false, record: false }).catch(() => {});
  }

  return { topic: analyzed, created: true };
}
