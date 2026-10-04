// Static curriculum knowledge: known prerequisites, aliases and category hints.
// Keys are canonical topic names (see canon()).

const ALIASES = {
  dp: 'dynamicprogramming',
  dynamicprog: 'dynamicprogramming',
  bst: 'binarysearchtree',
  mst: 'minimumspanningtree',
};

export function canon(name = '') {
  let k = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.length > 3 && k.endsWith('s') && !k.endsWith('ss')) k = k.slice(0, -1);
  return ALIASES[k] || k;
}

// topic -> prerequisites (canonical)
export const KNOWN_PREREQS = {
  bfs: ['graph'],
  dfs: ['graph'],
  dijkstra: ['graph', 'bfs'],
  shortestpath: ['graph', 'bfs'],
  topologicalsort: ['graph', 'dfs'],
  minimumspanningtree: ['graph'],
  dynamicprogramming: ['recursion'],
  memoization: ['recursion'],
  backtracking: ['recursion'],
  binarysearchtree: ['tree'],
  heap: ['tree', 'array'],
  binarysearch: ['array'],
  tree: ['linkedlist'],
  join: ['select'],
  groupby: ['select'],
  subquerie: ['join'],
};

// canonical -> rough intrinsic difficulty (1-10) used by the offline fallback
export const BASE_DIFFICULTY = {
  array: 3, string: 3, sorting: 4, linkedlist: 4, stack: 3, queue: 3, hashing: 4, recursion: 5,
  tree: 6, binarysearchtree: 6, heap: 6, graph: 8, bfs: 6, dfs: 6, dijkstra: 8, shortestpath: 7,
  dynamicprogramming: 9, backtracking: 8, greedy: 6, memoization: 6,
};

const CATEGORY_KEYWORDS = {
  sql: ['sql', 'query', 'select', 'join', 'database', 'dbms', 'normalization', 'groupby'],
  math: ['calculus', 'algebra', 'probability', 'statistics', 'integral', 'derivative', 'matrix', 'geometry', 'trigonometry', 'equation'],
  programming: ['array', 'tree', 'graph', 'list', 'sort', 'recursion', 'dynamic', 'algorithm', 'stack', 'queue', 'heap', 'hash', 'code', 'programming', 'bfs', 'dfs', 'dijkstra', 'string', 'python', 'java'],
};

export function guessCategory(name) {
  const n = String(name).toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return 'theory';
}
