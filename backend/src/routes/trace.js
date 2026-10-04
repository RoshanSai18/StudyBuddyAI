import { Router } from 'express';
import { trace } from '../services/trace.js';

export const router = Router();

// GET /api/trace — recent agent/graph execution events, for the live pipeline visualizer (poll this).
router.get('/trace', (req, res) => {
  res.json({ events: trace.list() });
});

// POST /api/trace/clear — reset the log (used before a scripted demo run so the visualizer starts clean)
router.post('/trace/clear', (req, res) => {
  trace.clear();
  res.json({ ok: true });
});
