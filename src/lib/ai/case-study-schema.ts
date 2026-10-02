import { z } from 'zod';

export const ImplementationItemSchema = z.object({
  commitSha: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
  description: z.string().optional(),
});

export const EvidenceItemSchema = z.object({
  type: z.string(),
  label: z.string(),
  url: z.string(),
  verified: z.boolean(),
});

export const WhatChangedSchema = z.object({
  statement: z.string(),
  source: z.enum(['VERIFIED_DIFF', 'VERIFIED_METADATA']).optional().default('VERIFIED_DIFF'),
  evidenceFiles: z.array(z.string()).optional().default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('HIGH'),
});

export const TechniqueDetailSchema = z.object({
  name: z.string(),
  evidenceFiles: z.array(z.string()).optional().default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('HIGH'),
});

export const CheckItemSchema = z.object({
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable().optional(),
  verified: z.boolean().default(true),
  url: z.string().optional(),
});

export const ChecksSummarySchema = z.object({
  totalChecks: z.number().default(0),
  passedChecks: z.number().default(0),
  failedChecks: z.number().default(0),
  pendingChecks: z.number().default(0),
  checkList: z.array(CheckItemSchema).optional().default([]),
  statusText: z.string().default('No GitHub checks reported for this pull request.'),
});

export const FileAnalysisSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number().default(0),
  deletions: z.number().default(0),
  changes: z.number().default(0),
  summary: z.string(),
  techniques: z.array(z.string()).optional().default([]),
  evidence: z.array(z.string()).optional().default([]),
  patch: z.string().optional(),
});

export const DiffPatchSchema = z.object({
  before: z.string(),
  after: z.string(),
  filename: z.string().optional(),
});

export const CaseStudyAnalysisSchema = z.object({
  engineeringThesis: z.string().optional(),
  howItWorks: z.string().nullable().optional(),
  problem: z.string().min(1),
  investigation: z.string().min(1),
  approach: z.string().min(1),
  whatChanged: z.array(WhatChangedSchema).optional().default([]),
  fileAnalyses: z.array(FileAnalysisSchema).optional().default([]),
  techniques: z.array(z.string()).default([]),
  techniqueDetails: z.array(TechniqueDetailSchema).optional().default([]),
  checks: z.array(CheckItemSchema).optional().default([]),
  checksSummary: ChecksSummarySchema.optional(),
  implementation: z.array(ImplementationItemSchema).default([]),
  tradeoffs: z.array(z.string()).default([]),
  result: z.string().min(1),
  evidence: z.array(EvidenceItemSchema).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  analysisCoverage: z.enum(['FULL_DIFF', 'PARTIAL_DIFF', 'METADATA_ONLY']).optional().default('FULL_DIFF'),
  diffPatch: DiffPatchSchema.nullable().optional(),
});

export type CaseStudyAnalysisInput = z.infer<typeof CaseStudyAnalysisSchema>;
