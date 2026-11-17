import roadmap from '../../docs/editorial-roadmap.md?raw';
import { articleHref, type Article } from './articles';

// The eight stages of the learning path, in order. Which files belong to a stage comes from the
// status tracker in docs/editorial-roadmap.md; whether a file is live comes from the content collection.
export const STAGES = [
  'Concepts',
  'Architecture',
  'Safe implementation',
  'Build locally',
  'Security evaluation',
  'Frameworks',
  'Production readiness',
  'Microsoft Foundry',
] as const;

export type StageStatus = 'published' | 'in progress' | 'planned';

export interface Stage {
  number: number;
  name: string;
  status: StageStatus;
  files: string[];
  firstArticle?: Article;
}

// Rows look like: | 3 | security/trust-boundaries-for-agents.md | published | Notes |
const ROW = /^\|\s*(\d+)\s*\|\s*([\w/-]+)\.md\s*\|\s*([^|]+?)\s*\|/;
const STARTED = new Set(['in repo', 'written', 'in pr']);

const roadmapRows = roadmap
  .split('\n')
  .map((line) => line.match(ROW))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map(([, stage, id, status]) => ({ stage: Number(stage), id, status: status.toLowerCase() }));

export function learningPath(published: Article[]) {
  const byId = new Map(published.map((article) => [article.id, article]));
  const stages: Stage[] = STAGES.map((name, index) => {
    const rows = roadmapRows.filter((row) => row.stage === index + 1);
    const live = rows.filter((row) => byId.has(row.id));
    let status: StageStatus = 'planned';
    if (rows.length > 0 && live.length === rows.length) status = 'published';
    else if (live.length > 0 || rows.some((row) => STARTED.has(row.status))) status = 'in progress';
    return { number: index + 1, name, status, files: rows.map((row) => row.id), firstArticle: live[0] && byId.get(live[0].id) };
  });
  const planned = new Set([...roadmapRows.map((row) => row.id), ...byId.keys()]);
  return { stages, publishedCount: byId.size, plannedCount: planned.size };
}

export const stageHref = (stage: Stage) => (stage.firstArticle ? articleHref(stage.firstArticle) : undefined);
