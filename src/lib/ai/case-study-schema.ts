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

export const WhatChangedSchema = z.object({
  statement: z.string(),
  evidenceFiles: z.array(z.string()).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export const TechniqueDetailSchema = z.object({
  name: z.string(),
  evidenceFiles: z.array(z.string()).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export const DiffPatchSchema = z.object({
  before: z.string(),
  after: z.string(),
  filename: z.string().optional(),
});

export const CaseStudyAnalysisSchema = z.object({
  problem: z.string().min(1),
  investigation: z.string().min(1),
  approach: z.string().min(1),
  whatChanged: z.array(WhatChangedSchema).optional().default([]),
  techniques: z.array(z.string()).default([]),
  techniqueDetails: z.array(TechniqueDetailSchema).optional().default([]),
  implementation: z.array(ImplementationItemSchema).default([]),
  tradeoffs: z.array(z.string()).default([]),
  result: z.string().min(1),
  evidence: z.array(EvidenceItemSchema).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  analysisCoverage: z.enum(['FULL_DIFF', 'PARTIAL_DIFF', 'METADATA_ONLY']).optional().default('FULL_DIFF'),
  diffPatch: DiffPatchSchema.nullable().optional(),
});

export type CaseStudyAnalysisInput = z.infer<typeof CaseStudyAnalysisSchema>;
