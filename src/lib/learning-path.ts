import roadmap from '../../docs/editorial-roadmap.md?raw';
import { articleHref, type Article } from './articles';

// The eight stages of the learning path, in order. Published notes join a stage through their
// `stage` frontmatter; notes not published yet come from the status tracker in docs/editorial-roadmap.md.
export const STAGES = [
  { name: 'Concepts', description: 'What an agent is, and the words you will see everywhere.' },
  { name: 'Architecture', description: 'The loop, the parts, and how agents use tools, memory and each other.' },
  { name: 'Safe implementation', description: 'Where agents get attacked, and the controls that hold.' },
  { name: 'Build locally', description: 'Build a small agent in TypeScript and Python, then test it.' },
  { name: 'Security evaluation', description: 'Threat-model and test an agent before anyone else does.' },
  { name: 'Frameworks', description: 'When a framework helps, and how the main ones compare.' },
  { name: 'Production readiness', description: 'Keep an agent reliable, and its cost bounded, once it is live.' },
  { name: 'Microsoft Foundry', description: 'Build, deploy and run agents on Microsoft Foundry.' },
] as const;

export type StageStatus = 'published' | 'in progress' | 'planned';

export type StageNote =
  | { kind: 'published'; id: string; article: Article; order: number }
  | { kind: 'planned' | 'being written'; id: string; title: string; order: number };

export interface Stage {
  number: number;
  name: string;
  description: string;
  status: StageStatus;
  notes: StageNote[];
  publishedCount: number;
}

// Rows look like: | 3 | security/trust-boundaries-for-agents.md | published | Notes |
const ROW = /^\|\s*(\d+)\s*\|\s*([\w/-]+)\.md\s*\|\s*([^|]+?)\s*\|/;
// Tracker statuses that mean the article exists but is not live yet.
const BEING_WRITTEN = new Set(['in repo', 'written', 'in pr']);

const roadmapRows = roadmap
  .split('\n')
  .map((line) => line.match(ROW))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map(([, stage, id, status]) => ({ stage: Number(stage), id, status: status.toLowerCase() }));

// Titles for notes that have no article yet: the planned file name in sentence case.
const PROPER: Record<string, string> = { ai: 'AI', azure: 'Azure', foundry: 'Foundry', iq: 'IQ', microsoft: 'Microsoft', rbac: 'RBAC' };
const titleFromId = (id: string) =>
  (id.split('/').pop() ?? id)
    .split('-')
    .map((word, index) => PROPER[word] ?? (index === 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');

export function learningPath(published: Article[]) {
  const byId = new Map(published.map((article) => [article.id, article]));
  const stages: Stage[] = STAGES.map(({ name, description }, index) => {
    const number = index + 1;
    const rows = roadmapRows.filter((row) => row.stage === number);
    const notes: StageNote[] = [
      ...published
        .filter((article) => article.data.stage === number)
        .map((article) => ({ kind: 'published' as const, id: article.id, article, order: article.data.stageOrder })),
      ...rows
        .map((row, position) => ({ row, position }))
        .filter(({ row }) => !byId.has(row.id))
        .map(({ row, position }) => ({
          kind: BEING_WRITTEN.has(row.status) ? ('being written' as const) : ('planned' as const),
          id: row.id,
          title: titleFromId(row.id),
          order: position + 1,
        })),
    ].sort((a, b) => a.order - b.order);
    const publishedCount = notes.filter((note) => note.kind === 'published').length;
    let status: StageStatus = 'planned';
    if (notes.length > 0 && publishedCount === notes.length) status = 'published';
    else if (notes.some((note) => note.kind !== 'planned')) status = 'in progress';
    return { number, name, description, status, notes, publishedCount };
  });
  const planned = new Set([...roadmapRows.map((row) => row.id), ...byId.keys()]);
  return { stages, publishedCount: byId.size, plannedCount: planned.size };
}

// Where a stage card on the homepage links: its first published note, if any.
export const stageHref = (stage: Stage) => {
  const first = stage.notes.find((note) => note.kind === 'published');
  return first?.kind === 'published' ? articleHref(first.article) : undefined;
};

export interface PathPosition {
  stage: Stage;
  // 1-based position among the stage's notes, and the stage's note count.
  index: number;
  count: number;
  previous?: Article;
  next?: Article;
}

// Where an article sits on the learning path, and its published neighbours in reading order.
// Returns undefined for an article that has no stage.
export function pathPosition(stages: Stage[], article: Article): PathPosition | undefined {
  const stage = stages.find((entry) => entry.notes.some((note) => note.id === article.id));
  if (!stage) return undefined;
  const ordered = stages.flatMap((entry) =>
    entry.notes.flatMap((note) => (note.kind === 'published' ? [note.article] : [])),
  );
  const at = ordered.findIndex((entry) => entry.id === article.id);
  return {
    stage,
    index: stage.notes.findIndex((note) => note.id === article.id) + 1,
    count: stage.notes.length,
    previous: ordered[at - 1],
    next: ordered[at + 1],
  };
}

// Where a stage section sits on /learn/.
export const stageAnchor = (stage: Stage) => `${import.meta.env.BASE_URL}learn/#stage-${stage.number}`;
