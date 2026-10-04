import { callStructured } from '../llm/mesh.js';
import { IntentOutput } from '../schemas/index.js';
import { WORKSPACE_KEYWORDS } from '../data/workspaces.js';

// Intent Detection agent: classifies one free-text student request ("Teach me Python loops") into
// {subject, topic, task_type}. Qualitative judgment (which subject fits, how to phrase the topic) is
// the LLM's job; the *routing* that follows (subject → workspace → teaching category) is a deterministic
// lookup in data/workspaces.js, per the project's "LLM reasons, code decides" rule.

const SYSTEM = `You are the Intent Detection agent of an AI study coach.
Classify a short free-text student request into:
- subject: the closest of programming, chemistry, mathematics, physics, biology — or "other" if none fit well
- topic: a short (2-6 word) topic name in Title Case, e.g. "Python Loops", "Acid-Base Titration", "Projectile Motion"
- task_type: the kind of help requested — learn_concept, coding, debugging, problem_solving, practice, experiment,
  simulation, or interactive_learning
Be decisive: pick the single best subject and task_type even if the request is phrased loosely. Never leave the topic empty.`;

const TASK_PATTERNS = [
  [/debug|fix my|error in/, 'debugging'],
  [/practice|quiz|test me/, 'practice'],
  [/solve|problem/, 'problem_solving'],
  [/experiment|titration|lab/, 'experiment'],
  [/simulat/, 'simulation'],
  [/explore|interact/, 'interactive_learning'],
  [/write.*(function|program|code)|\bcode\b/, 'coding'],
];

const LEAD_INS = [
  /^(please\s+)?(teach|explain|show|help)\s+(me\s+)?(how to\s+|with\s+|understand\s+|solve\s+)?/i,
  /^i\s+want\s+to\s+(learn|understand|practice)\s+(about\s+)?/i,
  /^(can you|could you)\s+(teach|explain|show|help)\s+(me\s+)?/i,
];

function stripLeadIn(text) {
  let out = text.trim();
  for (const re of LEAD_INS) {
    const next = out.replace(re, '');
    if (next !== out) {
      out = next;
      break;
    }
  }
  return out.replace(/[.?!]+$/, '').trim();
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function guessSubject(lower) {
  for (const [subject, words] of Object.entries(WORKSPACE_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return subject;
  }
  return 'other';
}

function guessTaskType(lower, subject) {
  for (const [re, task] of TASK_PATTERNS) {
    if (re.test(lower)) return task;
  }
  return subject === 'programming' ? 'coding' : 'learn_concept';
}

function fallback(text) {
  const lower = text.toLowerCase();
  const subject = guessSubject(lower);
  const task_type = guessTaskType(lower, subject);
  const topic = titleCase(stripLeadIn(text)) || 'General Study';
  return { subject, topic, task_type };
}

export async function detectIntent(text) {
  const { data, source } = await callStructured({
    schema: IntentOutput,
    name: 'detect_intent',
    system: SYSTEM,
    user: text,
    fallback: () => fallback(text),
  });
  return { ...data, source };
}
