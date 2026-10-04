import { Router } from 'express';
import { detectIntent } from '../agents/intentAgent.js';
import { resolveWorkspace, workspaceMeta } from '../data/workspaces.js';
import { canon } from '../data/knowledge.js';
import { IntentInput } from '../schemas/index.js';
import { store } from '../services/store.js';

export const router = Router();

// POST /api/intent — classify a free-text request ("Teach me Python loops") into subject/topic/task_type
// and resolve the workspace to open. Pure detection: no session state is changed here (that happens when
// the student actually starts learning, via POST /learning/start, which can also take `text` directly).
router.post('/intent', async (req, res) => {
  const { text } = IntentInput.parse(req.body);
  const detected = await detectIntent(text);
  const workspace = resolveWorkspace(detected.subject);

  const s = store.get();
  const existingTopic = s.analyzedTopics.find((t) => canon(t.name) === canon(detected.topic))?.name ?? null;

  res.json({
    subject: detected.subject,
    topic: detected.topic,
    task_type: detected.task_type,
    workspace,
    workspace_meta: workspaceMeta(workspace),
    existing_topic: existingTopic,
    source: detected.source,
  });
});
