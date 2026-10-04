import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config.js';

// The single LLM client for the whole backend. MeshAPI is OpenAI-compatible.
let model = null;

export function llmAvailable() {
  return !config.llmDisabled && Boolean(config.mesh.apiKey);
}

function getModel() {
  if (!model) {
    model = new ChatOpenAI({
      model: config.mesh.model,
      apiKey: config.mesh.apiKey,
      temperature: 0.4,
      maxRetries: 1,
      timeout: 60_000,
      configuration: { baseURL: config.mesh.baseUrl },
    });
  }
  return model;
}

/**
 * Ask the LLM for output matching a zod schema.
 * Never throws: on missing key, API failure or schema mismatch it returns `fallback()`
 * so the app keeps working (and the UI can be developed without a key).
 *
 * @returns {Promise<{data: any, source: 'llm'|'fallback', error?: string}>}
 */
export async function callStructured({ schema, name, system, user, fallback }) {
  if (!llmAvailable()) return { data: fallback(), source: 'fallback' };

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const runnable = getModel().withStructuredOutput(schema, { name, method: 'functionCalling' });
      const raw = await runnable.invoke([
        ['system', system],
        ['human', typeof user === 'string' ? user : JSON.stringify(user)],
      ]);
      const parsed = schema.safeParse(raw);
      if (parsed.success) return { data: parsed.data, source: 'llm' };
      lastError = parsed.error.message;
    } catch (err) {
      lastError = err?.message || String(err);
    }
  }
  console.warn(`[llm] ${name} failed, using fallback: ${lastError}`);
  return { data: fallback(), source: 'fallback', error: lastError };
}
