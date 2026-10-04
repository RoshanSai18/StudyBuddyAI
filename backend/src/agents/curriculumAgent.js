import { callStructured } from '../llm/mesh.js';
import { DependencyOutput } from '../schemas/index.js';
import { KNOWN_PREREQS, canon } from '../data/knowledge.js';

const SYSTEM = `You are the Curriculum Agent of an AI study coach.
Given a list of topics from ONE subject, say which topics must be understood before others (prerequisites).
Rules:
- Only use topic names from the given list, exactly as written.
- Only list direct, STRICT prerequisites: B cannot be understood without A (e.g. Recursion before Dynamic Programming).
  Merely "related" or "commonly taught earlier" is not enough. Do not invent links; fewer is better.
- At most 2 prerequisites per topic. Return an empty list for topics with no strict prerequisite in the list.
- Example: for [Arrays, Recursion, Dynamic Programming, Graphs] the only strict link is Dynamic Programming ← Recursion.
- Never create cycles.`;

/** Keep a dependency map acyclic by refusing edges that would close a loop. */
class DepGraph {
  constructor() {
    this.requires = new Map(); // name -> Set(prereq names)
  }
  reaches(from, to, seen = new Set()) {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    for (const next of this.requires.get(from) || []) if (this.reaches(next, to, seen)) return true;
    return false;
  }
  add(topic, prereq) {
    if (topic === prereq || this.reaches(prereq, topic)) return false;
    if (!this.requires.has(topic)) this.requires.set(topic, new Set());
    this.requires.get(topic).add(prereq);
    return true;
  }
  toObject() {
    const out = {};
    for (const [k, v] of this.requires) if (v.size) out[k] = [...v];
    return out;
  }
}

export async function analyzeDependencies(topics) {
  const names = topics.map((t) => t.name);
  const byKey = new Map(names.map((n) => [canon(n), n]));
  const graph = new DepGraph();

  // 1. known prerequisites (deterministic)
  for (const name of names) {
    for (const pre of KNOWN_PREREQS[canon(name)] || []) {
      const preName = byKey.get(pre);
      if (preName) graph.add(name, preName);
    }
  }

  // 2. LLM-suggested extras
  const { data, source } = await callStructured({
    schema: DependencyOutput,
    name: 'topic_dependencies',
    system: SYSTEM,
    user: { subject: topics[0]?.subject, topics: names },
    fallback: () => ({ dependencies: [] }),
  });
  for (const dep of data.dependencies) {
    const topic = byKey.get(canon(dep.topic));
    if (!topic) continue;
    for (const r of dep.requires.slice(0, 2)) {
      const pre = byKey.get(canon(r));
      if (pre) graph.add(topic, pre);
    }
  }

  return { dependencies: graph.toObject(), source };
}
