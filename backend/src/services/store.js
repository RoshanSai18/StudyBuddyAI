// In-memory session store (single student, no auth) — as scoped for the MVP.

function fresh() {
  return {
    profile: null,
    analyzedTopics: [], // assessment output (+ initial_mastery)
    missingInfo: [],
    dependencies: {}, // { topic: [prerequisites] }
    priorities: [],
    plan: null, // { days: [...], warnings: [...], generatedAt }
    mastery: {}, // { topic: mastery record }
    sessions: {}, // learning sessions by id
    quizzes: {}, // generated quizzes by id (with answers, server-side only)
    misconceptions: [], // { topic, text, at }
    planUpdates: [], // newest first
    sources: {}, // which agents used the LLM vs fallback
  };
}

let session = fresh();

export const store = {
  get: () => session,
  reset: () => {
    session = fresh();
    return session;
  },
};
