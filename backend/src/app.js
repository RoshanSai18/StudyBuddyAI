import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { llmAvailable } from './llm/mesh.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { router as intent } from './routes/intent.js';
import { router as learning } from './routes/learning.js';
import { router as planning } from './routes/planning.js';
import { router as quiz } from './routes/quiz.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, llm: llmAvailable() ? config.mesh.model : 'fallback (no API key or LLM_DISABLED=1)' });
  });
  app.use('/api', planning);
  app.use('/api', learning);
  app.use('/api', quiz);
  app.use('/api', intent);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
