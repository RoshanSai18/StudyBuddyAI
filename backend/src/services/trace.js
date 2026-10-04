import { randomUUID } from 'node:crypto';

// In-memory ring buffer of agent/graph execution events, for the live pipeline visualizer.
// Pure instrumentation: nothing here reads or changes any agent's decision, only observes it.

const CAP = 200;
let events = [];

function emit(node, status, message) {
  events.push({ id: randomUUID().slice(0, 8), node, status, message, at: new Date().toISOString() });
  if (events.length > CAP) events = events.slice(-CAP);
}

function list() {
  return events;
}

function clear() {
  events = [];
}

export const trace = { emit, list, clear };
