import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { generateFlashcards } from '../agents/flashcardAgent.js';
import { httpError } from '../middleware/errors.js';
import { store } from '../services/store.js';
import { topicByName } from '../services/views.js';
import { awardXp, publicXp } from '../services/xp.js';

export const router = Router();

// POST /api/flashcards/generate — { topic, count? } → a fresh set of flashcards for the topic.
// Stateless study aid (not wired into mastery): the only session bookkeeping is which card ids belong
// to which set, so /mark can validate a request and award XP without letting the same card be farmed twice.
router.post('/flashcards/generate', async (req, res) => {
  const { topic, count } = z.object({ topic: z.string().min(1), count: z.number().int().min(3).max(15).default(10) }).parse(req.body);
  const s = store.get();
  const known = topicByName(topic);
  if (!known) throw httpError(404, `Unknown topic "${topic}".`);

  const { cards, source } = await generateFlashcards({
    topic: known,
    count,
    mastery: s.mastery[known.name],
    misconceptions: s.misconceptions.filter((m) => m.topic === known.name).map((m) => m.text),
  });

  const id = randomUUID().slice(0, 8);
  const full = cards.map((c, i) => ({ id: `${id}-c${i + 1}`, ...c }));
  s.flashcardSets[id] = { id, topic: known.name, cardIds: new Set(full.map((c) => c.id)), markedKnown: new Set() };
  res.status(201).json({ set_id: id, topic: known.name, cards: full, source });
});

// POST /api/flashcards/mark — { setId, cardId, known } → a small XP ping the first time a card is marked known
router.post('/flashcards/mark', (req, res) => {
  const { setId, cardId, known } = z.object({ setId: z.string(), cardId: z.string(), known: z.boolean() }).parse(req.body);
  const s = store.get();
  const set = s.flashcardSets[setId];
  if (!set || !set.cardIds.has(cardId)) throw httpError(404, 'Unknown flashcard.');

  let award = null;
  if (known && !set.markedKnown.has(cardId)) {
    set.markedKnown.add(cardId);
    award = awardXp(s.gamification, 'flashcard_known', set.topic);
  }
  res.json({ award, xp: publicXp(s.gamification) });
});
