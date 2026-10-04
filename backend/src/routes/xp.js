import { Router } from 'express';
import { store } from '../services/store.js';
import { publicXp } from '../services/xp.js';

export const router = Router();

// GET /api/xp — current level/XP and recent gains, for the sidebar badge and any standalone display.
router.get('/xp', (req, res) => {
  res.json(publicXp(store.get().gamification));
});
