import { addDays, daysUntil, parseDate, startOfDay, toDateOnly } from '../services/dates.js';
import { remainingHours } from '../services/priority.js';
import { buildSchedule, validateSchedule } from '../services/scheduler.js';

// The Planner is deliberately deterministic: dates, capacity and fit are code decisions, not LLM ones.

/** Scheduler input: how many minutes each topic still needs, given its current mastery. */
export function plannerTopics({ analyzedTopics, priorities, dependencies, mastery }) {
  const score = new Map(priorities.map((p) => [p.topic, p.score]));
  return analyzedTopics.map((t) => ({
    name: t.name,
    needMinutes: remainingHours(t, mastery[t.name]?.overall ?? t.initial_mastery) * 60,
    priority: score.get(t.name) ?? 0,
    prerequisites: dependencies[t.name] || [],
  }));
}

/** Fresh day slots from today until the day before the exam. */
export function freshDays(profile, asOf = new Date()) {
  const count = Math.max(1, daysUntil(profile.examDate, asOf));
  const start = startOfDay(asOf);
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    date: toDateOnly(addDays(start, i)),
    capacityMinutes: Math.round(profile.dailyHours * 60),
    fixedBlocks: [],
    schedulable: true,
  }));
}

/**
 * Day slots for a replan: finished work is kept, past unfinished work is marked missed,
 * and everything pending from today onward is cleared so it can be rescheduled.
 */
export function replanDays(plan, profile, asOf = new Date()) {
  const today = toDateOnly(startOfDay(asOf));
  return plan.days.map((d, i) => {
    const past = d.date < today;
    const fixedBlocks = d.blocks
      .map((b) => (past && b.status === 'pending' && b.type !== 'break' ? { ...b, status: 'missed' } : b))
      .filter((b) => b.status !== 'pending');
    return {
      index: i,
      date: d.date,
      capacityMinutes: Math.round(profile.dailyHours * 60),
      fixedBlocks,
      schedulable: !past,
    };
  });
}

export function runPlanner(state, fitFactor = 1) {
  const topics = plannerTopics({
    analyzedTopics: state.analyzedTopics,
    priorities: state.priorities,
    dependencies: state.dependencies,
    mastery: state.masteryScores || {},
  });
  const days = state.days || freshDays(state.profile);
  const schedule = buildSchedule({ topics, days, fitFactor });
  return { topics, days, schedule };
}

export function runValidation(schedule, topics) {
  return validateSchedule(schedule, { topics });
}

export function packagePlan({ schedule, profile, warnings, previous }) {
  return {
    startDate: previous?.startDate ?? schedule.days[0]?.date ?? toDateOnly(new Date()),
    examDate: profile.examDate,
    dailyHours: profile.dailyHours,
    days: schedule.days,
    warnings,
    generatedAt: new Date().toISOString(),
    version: (previous?.version ?? 0) + 1,
  };
}

export const planHasRemainingDays = (plan, asOf = new Date()) =>
  plan.days.some((d) => parseDate(d.date) >= startOfDay(asOf));
