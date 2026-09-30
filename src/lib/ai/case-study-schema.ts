import { z } from 'zod';

export const ImplementationItemSchema = z.object({
  commitSha: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
  description: z.string().optional(),
});

export const EvidenceItemSchema = z.object({
  type: z.string(), // "Issue" | "Pull Request" | "Commits" | "Reviews" | "Tests" | "Files" | "Merge"
  label: z.string(),
  url: z.string(),
  verified: z.boolean(),
});

export const CaseStudyAnalysisSchema = z.object({
  problem: z.string().min(1),
  investigation: z.string().min(1),
  approach: z.string().min(1),
  techniques: z.array(z.string()).default([]),
  implementation: z.array(ImplementationItemSchema).default([]),
  tradeoffs: z.array(z.string()).default([]),
  result: z.string().min(1),
  evidence: z.array(EvidenceItemSchema).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export type CaseStudyAnalysisInput = z.infer<typeof CaseStudyAnalysisSchema>;
