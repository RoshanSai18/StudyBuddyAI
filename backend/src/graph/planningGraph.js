import { END, START, StateGraph } from '@langchain/langgraph';
import { StudyState } from './state.js';
import { assessTopics } from '../agents/assessmentAgent.js';
import { analyzeDependencies } from '../agents/curriculumAgent.js';
import { rankTopics } from '../agents/priorityAgent.js';
import { packagePlan, runPlanner, runValidation } from '../agents/plannerAgent.js';
import { initMastery } from '../services/mastery.js';
import { daysUntil } from '../services/dates.js';

const MAX_PLAN_ATTEMPTS = 3;

// START → Assessment → Curriculum → Priority → Plan → Validate ─(fits)→ Finalize → END
//                                                      └(too much work)→ Plan (shrunk)

async function assessment(state) {
  const { topics, missingInfo, source } = await assessTopics(state.profile);
  const masteryScores = Object.fromEntries(topics.map((t) => [t.name, initMastery(t.confidence)]));
  return { analyzedTopics: topics, missingInfo, masteryScores, sources: { ...state.sources, assessment: source } };
}

async function curriculum(state) {
  const { dependencies, source } = await analyzeDependencies(state.analyzedTopics);
  return { dependencies, sources: { ...state.sources, curriculum: source } };
}

async function priority(state) {
  const { priorities, source } = await rankTopics({
    analyzedTopics: state.analyzedTopics,
    dependencies: state.dependencies,
    mastery: state.masteryScores,
    ctx: { daysLeft: Math.max(1, daysUntil(state.profile.examDate)), dailyHours: state.profile.dailyHours },
  });
  return { priorities, sources: { ...state.sources, priority: source } };
}

function plan(state) {
  const fitFactor = state.fitFactor ?? 1;
  const { topics, schedule } = runPlanner(state, fitFactor);
  return { schedule, plannerTopics: topics, fitFactor, planAttempt: (state.planAttempt ?? 0) + 1 };
}

function validate(state) {
  const validation = runValidation(state.schedule, state.plannerTopics);
  let fitFactor = state.fitFactor ?? 1;
  if (!validation.valid && validation.unscheduledMinutes > 0) {
    const scheduled = state.schedule.neededMinutes - validation.unscheduledMinutes;
    fitFactor *= Math.max(0.3, scheduled / state.schedule.neededMinutes) * 0.97;
  }
  return { planValid: validation.valid, planWarnings: validation.issues, fitFactor };
}

function finalize(state) {
  const studyPlan = packagePlan({ schedule: state.schedule, profile: state.profile, warnings: state.planWarnings });
  return { studyPlan, nextAction: 'show_plan' };
}

const builder = new StateGraph(StudyState)
  .addNode('assessment', assessment)
  .addNode('curriculum', curriculum)
  .addNode('priority', priority)
  .addNode('plan', plan)
  .addNode('validate', validate)
  .addNode('finalize', finalize)
  .addConditionalEdges(START, (s) => (s.stage === 'plan' ? 'plan' : 'assessment'), ['assessment', 'plan'])
  .addEdge('assessment', 'curriculum')
  .addEdge('curriculum', 'priority')
  .addConditionalEdges('priority', (s) => (s.stopAfter === 'priority' ? END : 'plan'), ['plan', END])
  .addEdge('plan', 'validate')
  .addConditionalEdges(
    'validate',
    (s) => (s.planValid || s.planAttempt >= MAX_PLAN_ATTEMPTS ? 'finalize' : 'plan'),
    ['finalize', 'plan'],
  )
  .addEdge('finalize', END);

export const planningGraph = builder.compile();
