// Adaptive Subject Workspace registry.
//
// The LLM (intentAgent) only ever picks a `subject` from a closed enum — which *workspace* and which
// existing teaching `category` (see assessmentAgent) that maps to is a plain lookup table here, not
// something the model decides. This keeps workspace routing deterministic and lets new subjects be
// added in one place later without touching the frontend or the graph.

export const SUBJECTS = ['programming', 'chemistry', 'mathematics', 'physics', 'biology', 'other'];

export const WORKSPACES = {
  coding_workspace: { key: 'coding_workspace', subject: 'programming', label: 'Coding workspace', icon: 'code', accent: '#2f5f78' },
  chemistry_workspace: { key: 'chemistry_workspace', subject: 'chemistry', label: 'Chemistry workspace', icon: 'flask', accent: '#2f6b45' },
  math_workspace: { key: 'math_workspace', subject: 'mathematics', label: 'Math workspace', icon: 'formula', accent: '#7d3f8f' },
  physics_workspace: { key: 'physics_workspace', subject: 'physics', label: 'Physics workspace', icon: 'orbit', accent: '#9a4f3c' },
  biology_workspace: { key: 'biology_workspace', subject: 'biology', label: 'Biology workspace', icon: 'leaf', accent: '#3f7a4a' },
  generic_workspace: { key: 'generic_workspace', subject: 'other', label: 'Study workspace', icon: 'book', accent: '#62584d' },
};

const SUBJECT_TO_WORKSPACE = {
  programming: 'coding_workspace',
  chemistry: 'chemistry_workspace',
  mathematics: 'math_workspace',
  physics: 'physics_workspace',
  biology: 'biology_workspace',
  other: 'generic_workspace',
};

// Which existing lesson-teaching flow (assessmentAgent's `category`: programming|theory|math|sql|general)
// each workspace reuses. No new teaching flow is introduced for chemistry/biology/physics — chemistry and
// biology read as "theory" lessons (concept → analogy → example → recall) and physics as a "math" lesson
// (intuition → formula → worked example → practice), which is the closest existing fit for MVP scope.
const WORKSPACE_TO_CATEGORY = {
  coding_workspace: 'programming',
  math_workspace: 'math',
  physics_workspace: 'math',
  chemistry_workspace: 'theory',
  biology_workspace: 'theory',
  generic_workspace: undefined, // let assessmentAgent's own guessCategory heuristic / the LLM decide
};

// Keyword fallback shared by the bulk assessment heuristic (every onboarded topic gets a workspace,
// deterministically, at zero extra cost) and intentAgent's offline fallback (used when the LLM is
// unavailable). Order matters: first matching subject wins.
const KEYWORDS = {
  programming: ['python', 'javascript', 'typescript', 'java', 'code', 'coding', 'program', 'loop', 'recursion', 'algorithm', 'function', 'variable', 'array', 'debug', 'sql', 'binary search', 'data structure', 'c++', 'api'],
  chemistry: ['acid', 'base', 'titration', 'reaction', 'chemical', 'molecule', 'compound', 'element', 'periodic', 'mole ', 'stoichiometry', 'ph ', 'chemistry', 'solution', 'bond', 'reagent'],
  mathematics: ['calculus', 'integration', 'integral', 'derivative', 'algebra', 'geometry', 'equation', 'matrix', 'probability', 'statistics', 'trigonometry', 'math', 'differentiation'],
  physics: ['projectile', 'motion', 'force', 'velocity', 'acceleration', 'newton', 'gravity', 'electricity', 'magnetism', 'wave', 'physics', 'momentum', 'kinematics', 'circuit'],
  biology: ['cell', 'photosynthesis', 'dna', 'organism', 'biology', 'anatomy', 'genetics', 'evolution', 'ecosystem', 'mitosis', 'enzyme', 'protein'],
};

/** Deterministic subject → workspace lookup. Unknown/unsupported subjects fall back to the generic workspace. */
export function resolveWorkspace(subject) {
  return SUBJECT_TO_WORKSPACE[subject] || 'generic_workspace';
}

export function categoryForWorkspace(workspace) {
  return WORKSPACE_TO_CATEGORY[workspace];
}

export function workspaceMeta(workspace) {
  return WORKSPACES[workspace] || WORKSPACES.generic_workspace;
}

/** Keyword-only subject guess from a topic name, e.g. for topics the student typed into the onboarding form. */
export function guessSubject(name) {
  const lower = String(name || '').toLowerCase();
  for (const [subject, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return subject;
  }
  return 'other';
}

export function guessWorkspace(name) {
  return resolveWorkspace(guessSubject(name));
}

export { KEYWORDS as WORKSPACE_KEYWORDS };
