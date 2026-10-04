// All backend calls live here (Vite proxies /api to the Express server).

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the StudyBuddy server. Is the backend running on port 4000?')
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const message = data?.error?.details?.length
      ? data.error.details.map((d) => `${d.path ? d.path + ': ' : ''}${d.message}`).join('; ')
      : data?.error?.message || `Request failed (${res.status})`
    throw new ApiError(res.status, message, data?.error?.details)
  }
  return data
}

export const api = {
  health: () => request('GET', '/health'),
  dashboard: () => request('GET', '/dashboard'),
  priorities: () => request('GET', '/priorities'),
  mastery: () => request('GET', '/mastery'),
  // POST /plan with a profile runs assessment → curriculum → priority → plan in one go
  createStrategy: (profile) => request('POST', '/plan', profile),
  seedDemo: () => request('POST', '/demo/seed'),
  getPlan: () => request('GET', '/plan').catch((e) => (e.status === 404 ? null : Promise.reject(e))),
  planUpdates: () => request('GET', '/plan/updates'),
  markBlock: (blockId, status) => request('POST', '/plan/session', { blockId, status }),
  replan: (asOf) => request('POST', '/replan', asOf ? { asOf } : {}),
  startLearning: (topic, resume = true) => request('POST', '/learning/start', { topic, resume }),
  // Adaptive Subject Workspace: classify free text into {subject, topic, task_type, workspace} (pure, no side effects)
  intent: (text) => request('POST', '/intent', { text }),
  // One call that detects intent AND starts the session — what the dashboard's "Ask your tutor" box uses
  askTutor: (text, resume = true) => request('POST', '/learning/start', { text, resume }),
  answer: (sessionId, answer, confidence) => request('POST', '/learning/respond', { sessionId, action: 'answer', answer, confidence }),
  rephrase: (sessionId, style) => request('POST', '/learning/respond', { sessionId, action: 'rephrase', style }),
  hint: (sessionId) => request('POST', '/learning/hint', { sessionId }),
  generateQuiz: (topic, count = 5) => request('POST', '/quiz/generate', { topic, count }),
  evaluateQuiz: (quizId, answers) => request('POST', '/quiz/evaluate', { quizId, answers }),
  reset: () => request('POST', '/reset'),
}
