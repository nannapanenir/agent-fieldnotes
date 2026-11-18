import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    topic: z.enum(['Foundations', 'Architecture', 'Frameworks', 'Deployment', 'Security']),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    order: z.number().default(100),
    // Learning-path stage (1-8, see docs/editorial-roadmap.md) and position within that stage.
    stage: z.number().int().min(1).max(8).optional(),
    stageOrder: z.number().default(100),
    readingMinutes: z.number().int().positive().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
