import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175',
  llmDisabled: process.env.LLM_DISABLED === '1',
  mesh: {
    apiKey: process.env.MESH_API_KEY || '',
    baseUrl: process.env.MESH_BASE_URL || 'https://api.meshapi.ai/v1',
    model: process.env.MODEL_NAME || 'gpt-4o-mini',
  },
};
