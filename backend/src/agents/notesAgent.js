import { callStructured } from '../llm/mesh.js';
import { NotesAnalysisOutput } from '../schemas/index.js';
import { guessWorkspace } from '../data/workspaces.js';

// Notes Analysis agent: turns raw text (pasted, or extracted from an uploaded PDF) into a study
// breakdown — distinct topics with an estimated difficulty/time/importance each, plus a short overview.
// Purely qualitative extraction, so this is entirely the LLM's job; the only code-owned decision is the
// input-length cap (keep the prompt bounded) and the workspace tag attached to each topic afterwards.

const MAX_CHARS = 12000;

const SYSTEM = `You are the Notes Analysis agent of an AI study coach.
You are given raw text extracted from a student's notes (may be messy — pasted directly, or pulled from a PDF,
so formatting/line breaks can be imperfect). Identify the distinct topics or subtopics actually covered.
For each topic estimate:
- summary: one short sentence of what it covers
- difficulty: 1-10 intrinsic difficulty for a typical student
- estimated_hours: hours to REVIEW and master this topic given it has already been introduced in these notes
  (this is revision/consolidation time, lighter than learning a topic from zero)
- importance: 1-10 likely exam weight, inferred from how much space/emphasis the notes give it
Also return:
- subject: a short label (2-5 words) for what these notes are about overall
- overview: 2-3 sentences summarizing what the notes cover
Identify 3-10 topics. Merge near-duplicate or overlapping sections into one topic. Use short, clear topic
names (2-5 words) suitable as study-plan entries. If the notes are too sparse or unclear to find real topics,
still return your best single-topic guess rather than failing.`;

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'are', 'was', 'were']);

/** Heading-like lines (markdown headers, numbered sections, short Title Case lines) as a fallback topic list. */
function heuristicTopics(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headingLike = lines.filter((l) => {
    if (l.length > 60 || l.length < 3) return false;
    if (/^#{1,3}\s/.test(l)) return true;
    if (/^\d+[.)]\s+\S/.test(l)) return true;
    const words = l.split(/\s+/);
    return words.length <= 6 && /^[A-Z]/.test(l) && !/[.?!]$/.test(l);
  });

  let names = [...new Set(headingLike.map((l) => l.replace(/^#{1,3}\s*/, '').replace(/^\d+[.)]\s*/, '').trim()))]
    .filter((n) => !STOPWORDS.has(n.toLowerCase()))
    .slice(0, 8);

  if (!names.length) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = Math.min(5, Math.max(1, Math.ceil(words.length / 250)));
    names = Array.from({ length: chunks }, (_, i) => `Notes section ${i + 1}`);
  }

  return names.map((name) => ({
    name,
    summary: 'Extracted from your notes (AI summary unavailable right now).',
    difficulty: 5,
    estimated_hours: 1,
    importance: 5,
  }));
}

export async function analyzeNotes(rawText) {
  const truncated = rawText.length > MAX_CHARS;
  const text = rawText.slice(0, MAX_CHARS);

  const { data, source } = await callStructured({
    schema: NotesAnalysisOutput,
    name: 'analyze_notes',
    system: SYSTEM,
    user: text,
    fallback: () => ({
      subject: 'My Notes',
      overview: 'An automatic summary wasn’t available, so topics below were found by scanning for headings instead.',
      topics: heuristicTopics(text),
    }),
  });

  const topics = data.topics.map((t) => ({ ...t, workspace: guessWorkspace(t.name) }));
  const totalHours = Math.round(topics.reduce((sum, t) => sum + t.estimated_hours, 0) * 4) / 4;

  return { subject: data.subject, overview: data.overview, topics, totalHours, truncated, source };
}
