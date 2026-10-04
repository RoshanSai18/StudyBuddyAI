import { Annotation } from '@langchain/langgraph';

// One explicit shared state for both graphs. Every field is last-write-wins.
const field = () => Annotation();

export const StudyState = Annotation.Root({
  // student input
  profile: field(),

  // planning
  analyzedTopics: field(),
  missingInfo: field(),
  dependencies: field(),
  priorities: field(),
  masteryScores: field(), // { topic: mastery record }
  days: field(), // optional pre-built day slots (replanning)
  schedule: field(), // raw scheduler output
  plannerTopics: field(),
  fitFactor: field(),
  planAttempt: field(),
  planValid: field(),
  planWarnings: field(),
  studyPlan: field(),
  stage: field(), // 'analyze' (default) | 'plan' (analysis already exists)
  stopAfter: field(), // 'priority' to stop before scheduling

  // learning
  sessionId: field(),
  action: field(), // 'start' | 'answer' | 'rephrase'
  rephraseStyle: field(),
  currentTopic: field(),
  learningMode: field(),
  lessonContent: field(),
  currentQuestion: field(),
  studentAnswer: field(),
  answerConfidence: field(),
  hintUsed: field(),
  evaluation: field(),
  misconceptions: field(),
  planChanges: field(),
  planUpdate: field(),
  nextAction: field(),
  xpAwards: field(), // XP earned during this graph run (see services/xp.js) — accumulated node by node

  // bookkeeping
  sources: field(), // which agents used the LLM vs a fallback
});
