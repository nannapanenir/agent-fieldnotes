import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;
export type TopicName = Article['data']['topic'];

// The learning path, in reading order. Both the homepage and /learn/ read this list.
export const TOPICS: { name: TopicName; slug: string; short: string; description: string }[] = [
  { name: 'Foundations', slug: 'foundations', short: 'Build the mental model first.', description: 'Start with definitions and mental models before the implementation details.' },
  { name: 'Architecture', slug: 'architecture', short: 'Understand the pieces and control flow.', description: 'Trace the model, state, tools, and application control flow.' },
  { name: 'Frameworks', slug: 'frameworks', short: 'Choose tools with clear tradeoffs.', description: 'Compare orchestration options against a concrete task and constraints.' },
  { name: 'Deployment', slug: 'deployment', short: 'Run, evaluate, and operate systems.', description: 'Prepare to evaluate, release, observe, and operate agentic systems.' },
  { name: 'Security', slug: 'security', short: 'Map risks and apply layered controls.', description: 'Threat-model the whole application and match controls to real risks.' },
];

const topicIndex = (topic: TopicName) => TOPICS.findIndex((entry) => entry.name === topic);

// Reading order: topic, then `order`, then newest first.
const byReadingOrder = (a: Article, b: Article) =>
  topicIndex(a.data.topic) - topicIndex(b.data.topic) ||
  a.data.order - b.data.order ||
  b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf();

// Every article with draft: false, in reading order.
export async function getPublishedArticles(): Promise<Article[]> {
  return (await getCollection('articles', ({ data }) => !data.draft)).sort(byReadingOrder);
}

export function articlesInTopic(articles: Article[], topic: TopicName): Article[] {
  return articles.filter((article) => article.data.topic === topic);
}

// Newest first by publish date; articles published the same day keep reading order.
export function latestArticles(articles: Article[], count: number, exclude?: Article): Article[] {
  return articles
    .filter((article) => article.id !== exclude?.id)
    .map((article, index) => ({ article, index }))
    .sort((a, b) => b.article.data.publishedAt.valueOf() - a.article.data.publishedAt.valueOf() || a.index - b.index)
    .slice(0, count)
    .map(({ article }) => article);
}

export const articleHref = (article: Article) => `${import.meta.env.BASE_URL}learn/${article.id}/`;
