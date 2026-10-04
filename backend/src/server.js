import { createApp } from './app.js';
import { config } from './config.js';
import { llmAvailable } from './llm/mesh.js';

createApp().listen(config.port, () => {
  console.log(`StudyBuddyAI API on http://localhost:${config.port}`);
  console.log(llmAvailable() ? `LLM: ${config.mesh.model} via ${config.mesh.baseUrl}` : 'LLM: disabled — using deterministic fallbacks');
});
