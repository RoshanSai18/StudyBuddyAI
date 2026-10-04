import { callStructured } from '../llm/mesh.js';
import { FlashcardSetOutput } from '../schemas/index.js';

// Flashcard generation: purely the LLM's job (what's worth a card, how to phrase front/back) — same
// "LLM reasons, code decides" split as the rest of the app; the only code-owned bits are the count and
// (in routes/flashcards.js) the deterministic XP awarded per card marked "known".

const SYSTEM = `You are the Flashcard Agent of an AI study coach.
Generate concise, high-yield flashcards for ONE topic — the kind a student would actually use for spaced-repetition revision.
Rules:
- front: a short question, term or prompt (no more than ~12 words)
- back: the answer/definition, 1-2 sentences, precise and exam-ready
- Cover a mix of definitions, key facts, and "why/how" understanding — not just rote recall
- Avoid near-duplicate cards. Prefer the ideas most likely to matter on an exam.
- If the student has known misconceptions about this topic, include at least one card that targets one directly.
Generate exactly the requested number of cards.`;

function fallbackCards(topic, count) {
  return Array.from({ length: count }, (_, i) => ({
    front: `Key idea #${i + 1} in ${topic.name}`,
    back: 'AI flashcard generation is offline right now — try again once the model is available.',
    dimension: 'concept',
  }));
}

export async function generateFlashcards({ topic, count, mastery, misconceptions }) {
  const { data, source } = await callStructured({
    schema: FlashcardSetOutput,
    name: 'generate_flashcards',
    system: SYSTEM,
    user: {
      topic: topic.name,
      subject: topic.subject,
      count,
      student_mastery: mastery?.overall,
      known_misconceptions: misconceptions.slice(-3),
    },
    fallback: () => ({ cards: fallbackCards(topic, count) }),
  });
  return { cards: data.cards.slice(0, count), source };
}
