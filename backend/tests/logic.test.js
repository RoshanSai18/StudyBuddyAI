import test from 'node:test';
import assert from 'node:assert/strict';
import { computePriorities, remainingHours } from '../src/services/priority.js';
import { applyEvidence, initMastery, computeOverall } from '../src/services/mastery.js';
import { buildPlan } from '../src/services/scheduler.js';

const topic = (name, confidence, difficulty, hours, importance = 5) => ({
  name, confidence, difficulty, estimated_hours: hours, exam_importance: importance, initial_mastery: confidence * 10,
});

test('priority: weaker/harder topics rank higher, scores are 0-100 and deterministic', () => {
  const topics = [topic('Arrays', 8, 3, 1), topic('Graphs', 2, 8, 3.5), topic('Sorting', 7, 4, 1)];
  const mastery = Object.fromEntries(topics.map((t) => [t.name, initMastery(t.confidence)]));
  const a = computePriorities(topics, {}, mastery, { daysLeft: 7, dailyHours: 3 });
  const b = computePriorities(topics, {}, mastery, { daysLeft: 7, dailyHours: 3 });
  assert.deepEqual(a, b);
  assert.equal(a[0].topic, 'Graphs');
  for (const p of a) assert.ok(p.score >= 0 && p.score <= 100);
});

test('priority: topics others depend on get a dependency bonus', () => {
  const topics = [topic('Graphs', 5, 5, 2), topic('BFS', 5, 5, 2)];
  const mastery = Object.fromEntries(topics.map((t) => [t.name, initMastery(5)]));
  const rows = computePriorities(topics, { BFS: ['Graphs'] }, mastery, { daysLeft: 7, dailyHours: 3 });
  assert.equal(rows.find((r) => r.topic === 'Graphs').factors.dependency_impact, 100);
  assert.equal(rows.find((r) => r.topic === 'BFS').factors.dependency_impact, 0);
});

test('mastery: weighted overall and evidence moves the right dimension', () => {
  assert.equal(computeOverall({ concept: 100, recall: 0, problem_solving: 0, application: 0 }), 30);
  const m = initMastery(2);
  applyEvidence(m, 'problem_solving', 100);
  assert.ok(m.problem_solving > 20 && m.concept === 20);
  assert.ok(m.overall > 20 && m.measured);
});

test('remainingHours shrinks as mastery grows and is zero at target', () => {
  const t = topic('Graphs', 2, 8, 3.5);
  assert.ok(Math.abs(remainingHours(t, 20) - 3.5) < 1e-9);
  assert.ok(remainingHours(t, 60) < remainingHours(t, 40));
  assert.equal(remainingHours(t, 95), 0);
});

function days(n, minutes = 180) {
  return Array.from({ length: n }, (_, i) => ({ index: i, date: `2030-01-0${i + 1}`, capacityMinutes: minutes, fixedBlocks: [], schedulable: true }));
}

test('scheduler: respects daily capacity and prerequisite order', () => {
  const topics = [
    { name: 'Graphs', needMinutes: 150, priority: 90, prerequisites: [] },
    { name: 'Dijkstra', needMinutes: 150, priority: 95, prerequisites: ['Graphs'] },
  ];
  const { schedule, validation } = buildPlan({ topics, days: days(5) });
  assert.ok(validation.valid, validation.issues.join('; '));
  for (const d of schedule.days) {
    const load = d.blocks.reduce((s, b) => s + b.minutes, 0);
    assert.ok(load <= d.capacityMinutes, `day ${d.day} load ${load}`);
  }
  const order = schedule.days.flatMap((d) => d.blocks).filter((b) => b.type === 'learn').map((b) => b.topic);
  assert.ok(order.indexOf('Graphs') < order.indexOf('Dijkstra'), 'prerequisite first despite lower priority');
});

test('scheduler: too much work is shrunk to fit instead of overloading days', () => {
  const topics = Array.from({ length: 5 }, (_, i) => ({ name: `T${i}`, needMinutes: 300, priority: 50 - i, prerequisites: [] }));
  const { schedule, validation } = buildPlan({ topics, days: days(2, 120) });
  assert.ok(validation.valid, validation.issues.join('; '));
  for (const d of schedule.days) assert.ok(d.blocks.reduce((s, b) => s + b.minutes, 0) <= 120);
  for (const t of topics) assert.ok(schedule.days.some((d) => d.blocks.some((b) => b.topic === t.name && b.type === 'learn')), `${t.name} scheduled`);
});
