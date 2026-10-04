import { randomUUID } from 'node:crypto';
import { canon } from '../data/knowledge.js';
import { round5 } from './dates.js';

// Deterministic study scheduler. No LLM involved: it decides *when* and *how long*.

const MIN_CHUNK = 15;
const MAX_BLOCK = 90;
const BREAK_MINUTES = 10;
const PRACTICE_SHARE = 0.3;

export const newBlockId = () => randomUUID().slice(0, 8);

const COUNTED = new Set(['pending', 'done']);
export const countsTowardLoad = (b) => COUNTED.has(b.status);

/** How a day's capacity is split between study, revision and breaks. */
export function dayReservations(capacity) {
  const revision = capacity >= 60 ? Math.max(15, round5(capacity * 0.15)) : 0;
  const breaks = capacity >= 120 ? Math.floor(capacity / 90) : 0;
  const study = Math.max(0, capacity - revision - breaks * BREAK_MINUTES);
  return { revision, breaks, study };
}

/** Topological order that prefers high-priority topics among those whose prerequisites are done. */
export function orderTopics(topics) {
  const names = new Map(topics.map((t) => [canon(t.name), t]));
  const prereqs = new Map(
    topics.map((t) => [t.name, (t.prerequisites || []).map(canon).filter((p) => names.has(p) && p !== canon(t.name))]),
  );
  const placed = new Set();
  const ordered = [];
  let remaining = [...topics];
  while (remaining.length) {
    let ready = remaining.filter((t) => prereqs.get(t.name).every((p) => placed.has(p)));
    if (!ready.length) ready = remaining; // cycle guard
    ready.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    const next = ready[0];
    ordered.push(next);
    placed.add(canon(next.name));
    remaining = remaining.filter((t) => t !== next);
  }
  return ordered;
}

/**
 * @param topics {name, needMinutes, priority, prerequisites[]}[]
 * @param days   {index, date, capacityMinutes, fixedBlocks[], schedulable}[]
 */
export function buildSchedule({ topics, days, fitFactor = 1 }) {
  const ordered = orderTopics(topics);

  const flow = [];
  let neededMinutes = 0;
  for (const t of ordered) {
    if (t.needMinutes <= 0) continue;
    const need = Math.max(MIN_CHUNK, round5(t.needMinutes * fitFactor));
    neededMinutes += need;
    const practice = need >= 45 ? round5(need * PRACTICE_SHARE) : 0;
    flow.push({ topic: t.name, type: 'learn', minutes: need - practice });
    if (practice > 0) flow.push({ topic: t.name, type: 'practice', minutes: practice });
  }

  const revisionCount = new Map();
  const studied = new Set();
  const byPriority = [...topics].sort((a, b) => b.priority - a.priority);

  const pickRevision = (minutes) => {
    const pool = studied.size ? byPriority.filter((t) => studied.has(t.name)) : byPriority;
    const ranked = [...pool].sort(
      (a, b) => (revisionCount.get(a.name) || 0) - (revisionCount.get(b.name) || 0) || b.priority - a.priority,
    );
    const picks = ranked.slice(0, minutes >= 45 ? 2 : 1);
    const share = round5(minutes / Math.max(1, picks.length));
    return picks.map((t, i) => {
      revisionCount.set(t.name, (revisionCount.get(t.name) || 0) + 1);
      const m = i === picks.length - 1 ? minutes - share * (picks.length - 1) : share;
      return { id: newBlockId(), topic: t.name, type: 'revision', minutes: m, status: 'pending' };
    });
  };

  const outDays = days.map((d) => {
    const fixed = d.fixedBlocks || [];
    const used = fixed.filter((b) => b.status === 'done').reduce((s, b) => s + b.minutes, 0);
    const cap = d.schedulable ? Math.max(0, d.capacityMinutes - used) : 0;
    const added = [];

    for (const b of fixed) if (b.type !== 'break' && b.status === 'done') studied.add(b.topic);

    if (cap >= MIN_CHUNK) {
      const res = dayReservations(cap);
      let remaining = res.study;
      let revision = res.revision;
      let breaksLeft = res.breaks;
      let sinceBreak = 0;

      while (flow.length && remaining >= MIN_CHUNK) {
        const item = flow[0];
        let chunk = Math.min(item.minutes, remaining, MAX_BLOCK);
        const tail = item.minutes - chunk;
        if (tail > 0 && tail < MIN_CHUNK && item.minutes <= remaining) chunk = item.minutes; // no tiny tail blocks
        const after = remaining - chunk;
        if (after > 0 && after < MIN_CHUNK) chunk = Math.min(item.minutes, remaining);
        added.push({ id: newBlockId(), topic: item.topic, type: item.type, minutes: chunk, status: 'pending' });
        studied.add(item.topic);
        item.minutes -= chunk;
        if (item.minutes <= 0) flow.shift();
        remaining -= chunk;
        sinceBreak += chunk;
        if (sinceBreak >= 60 && breaksLeft > 0 && flow.length && remaining >= MIN_CHUNK) {
          added.push({ id: newBlockId(), topic: null, type: 'break', minutes: BREAK_MINUTES, status: 'pending' });
          breaksLeft--;
          sinceBreak = 0;
        }
      }
      revision += breaksLeft * BREAK_MINUTES; // reserved but unused breaks become revision time
      if (!flow.length && remaining >= MIN_CHUNK) revision += remaining; // spare time → revision
      if (revision >= MIN_CHUNK && topics.length) added.push(...pickRevision(revision));
    }

    const blocks = [...fixed, ...added];
    return {
      day: d.index + 1,
      date: d.date,
      capacityMinutes: d.capacityMinutes,
      schedulable: d.schedulable,
      totalMinutes: blocks.filter((b) => b.type !== 'break' && countsTowardLoad(b)).reduce((s, b) => s + b.minutes, 0),
      blocks,
    };
  });

  const leftover = new Map();
  for (const it of flow) leftover.set(it.topic, (leftover.get(it.topic) || 0) + it.minutes);
  const unscheduled = [...leftover].map(([topic, minutes]) => ({ topic, minutes }));

  return { days: outDays, unscheduled, neededMinutes };
}

export function validateSchedule(schedule, { topics }) {
  const issues = [];
  const firstLearn = new Map();

  schedule.days.forEach((d, di) => {
    const load = d.blocks.filter(countsTowardLoad).reduce((s, b) => s + b.minutes, 0);
    if (load > d.capacityMinutes) issues.push(`Day ${d.day} is overloaded (${load}m > ${d.capacityMinutes}m).`);
    d.blocks.forEach((b, bi) => {
      if (b.type === 'learn' && countsTowardLoad(b) && !firstLearn.has(b.topic)) firstLearn.set(b.topic, di * 1000 + bi);
    });
  });

  const byKey = new Map(topics.map((t) => [canon(t.name), t]));
  for (const t of topics) {
    for (const p of (t.prerequisites || []).map(canon)) {
      const pre = byKey.get(p);
      if (!pre || pre.name === t.name) continue;
      const a = firstLearn.get(t.name);
      const b = firstLearn.get(pre.name);
      if (a !== undefined && b !== undefined && a < b) {
        issues.push(`${t.name} is scheduled before its prerequisite ${pre.name}.`);
      }
    }
  }

  const unscheduledMinutes = schedule.unscheduled.reduce((s, u) => s + u.minutes, 0);
  if (unscheduledMinutes > 0) issues.push(`${unscheduledMinutes}m of planned study did not fit before the exam.`);
  return { valid: issues.length === 0, issues, unscheduledMinutes };
}

/** Build, validate and (if the work doesn't fit) shrink every topic proportionally, up to 3 attempts. */
export function buildPlan(opts) {
  let fitFactor = 1;
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    const schedule = buildSchedule({ ...opts, fitFactor });
    const validation = validateSchedule(schedule, opts);
    result = { schedule, validation, fitFactor };
    if (validation.valid || validation.unscheduledMinutes <= 0) break;
    const scheduled = schedule.neededMinutes - validation.unscheduledMinutes;
    fitFactor *= Math.max(0.3, scheduled / schedule.neededMinutes) * 0.97;
  }
  return result;
}
