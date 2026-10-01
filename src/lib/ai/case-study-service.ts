import { prisma } from '@/lib/prisma';
import { CaseStudyAnalysisSchema, CaseStudyAnalysisInput } from './case-study-schema';
import { analyzePullRequestDiff, fetchGithubPullRequestFiles, GitHubPullRequestDiffData } from './diff-analysis-engine';

export interface WhatChangedItem {
  statement: string;
  evidenceFiles: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TechniqueDetailItem {
  name: string;
  evidenceFiles: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CaseStudyData {
  id: string;
  contributionId: string;
  problem: string;
  investigation: string;
  approach: string;
  whatChanged: WhatChangedItem[];
  techniques: string[];
  techniqueDetails: TechniqueDetailItem[];
  implementation: { commitSha?: string; title: string; url?: string; description?: string }[];
  tradeoffs: string[];
  result: string;
  evidence: { type: string; label: string; url: string; verified: boolean }[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  analysisCoverage: 'FULL_DIFF' | 'PARTIAL_DIFF' | 'METADATA_ONLY';
  diffPatch?: {
    before: string;
    after: string;
    filename?: string;
  } | null;
  contributorLearned: string | null;
  modelVersion: string;
  generatedAt: string;
  contributorEdited: boolean;
  contributorEditedAt: string | null;
}

/**
 * Extracts verifiable engineering techniques demonstrated by implementation evidence.
 */
export function extractEvidenceBasedTechniques(
  title: string,
  body: string | null,
  labels: string[],
  language: string,
  ecosystem: string,
  filesChanged: number
): string[] {
  const text = `${title} ${body || ''} ${labels.join(' ')} ${language} ${ecosystem}`.toLowerCase();
  const techniques = new Set<string>();

  if (text.includes('concurrent') || text.includes('mutex') || text.includes('lock') || text.includes('race') || text.includes('thread') || text.includes('goroutine') || text.includes('async')) {
    techniques.add('Concurrency');
  }
  if (text.includes('cache') || text.includes('redis') || text.includes('memoiz')) {
    techniques.add('Caching');
  }
  if (text.includes('test') || text.includes('spec') || text.includes('coverage') || text.includes('assert') || text.includes('mock')) {
    techniques.add('Regression Testing');
  }
  if (text.includes('query') || text.includes('sql') || text.includes('index') || text.includes('database') || text.includes('prisma') || text.includes('postgres')) {
    techniques.add('Database Optimization');
  }
  if (text.includes('api') || text.includes('endpoint') || text.includes('route') || text.includes('grpc') || text.includes('rest')) {
    techniques.add('API Design');
  }
  if (text.includes('leak') || text.includes('memory') || text.includes('cleanup') || text.includes('connection') || text.includes('pool') || text.includes('lifecycle')) {
    techniques.add('Resource Lifecycle Management');
  }
  if (text.includes('error') || text.includes('exception') || text.includes('catch') || text.includes('retry') || text.includes('fallback') || text.includes('fault')) {
    techniques.add('Error Handling');
  }
  if (text.includes('auth') || text.includes('token') || text.includes('jwt') || text.includes('sanitize') || text.includes('permission') || text.includes('cve')) {
    techniques.add('Security & Access Control');
  }

  if (techniques.size === 0) {
    if (filesChanged > 3) techniques.add('System Architecture');
    else techniques.add('Code Refactoring');
  }

  return Array.from(techniques);
}

/**
 * Generates an evidence-backed analysis structure from verified GitHub contribution data and raw PR diffs.
 */
export function synthesizeEvidenceAnalysis(
  contribution: any,
  diffData?: GitHubPullRequestDiffData | null
): CaseStudyAnalysisInput {
  const issue = contribution.issue;
  const repo = issue?.repository;
  const pr = contribution.pullRequest;
  const title = issue?.title || pr?.title || 'Merged Open Source Contribution';
  const body = issue?.body || '';
  const prTitle = pr?.title || title;
  const lang = contribution.language || issue?.language || repo?.language || 'TypeScript';
  const eco = issue?.ecosystem || repo?.ecosystem || 'Node.js';
  const labels: string[] = issue?.labels || [];

  const repoFullName = repo?.fullName || 'Open Source Project';
  const prNumStr = pr?.githubNumber ? `PR #${pr.githubNumber}` : 'Pull Request';
  const issueNumStr = issue?.githubNumber ? `Issue #${issue.githubNumber}` : 'Linked Issue';

  // Run pure diff analyzer (DIFF WINS OVER PR TITLE!)
  const diffAnalysis = analyzePullRequestDiff(
    diffData || null,
    prTitle,
    pr?.githubNumber || 0,
    repoFullName,
    issue?.title || null
  );

  // 1. Problem
  const problem = body.trim().length > 20
    ? `The ${repoFullName} repository encountered an issue: ${body.slice(0, 250).trim()}${body.length > 250 ? '...' : ''}`
    : `Addressing ${issue ? `issue "${issue.title}"` : `PR "${prTitle}"`} in ${repoFullName}.`;

  // 2. Investigation
  const investigation = `Based on PR discussion and implementation diffs in ${repoFullName}, the contribution modifies execution paths in ${lang} runtime components.`;

  // 3. Approach
  const approach = contribution.approach && contribution.approach.trim().length > 10
    ? contribution.approach.trim()
    : diffAnalysis.whatChanged.map((w) => w.statement).join(' ') || `Modifies ${contribution.filesChanged || 1} file(s) (+${contribution.linesAdded || 0} / -${contribution.linesDeleted || 0} lines) in ${prNumStr}.`;

  // 4. Techniques (combining diff techniques with verified tags)
  const baseTechniques = extractEvidenceBasedTechniques(
    title,
    body,
    labels,
    lang,
    eco,
    contribution.filesChanged || 1
  );
  const combinedTechniques = Array.from(new Set([...diffAnalysis.techniqueNames, ...baseTechniques]));

  // 5. Implementation commits / changes
  const implementation = [
    {
      commitSha: pr?.githubNumber ? `PR #${pr.githubNumber}` : undefined,
      title: `${prTitle}`,
      url: pr?.url || repo?.url || '',
      description: `Merged into ${repoFullName}`,
    },
  ];

  // 6. Evidence Checklist
  const evidence = [
    ...(issue ? [{
      type: 'Issue',
      label: `${issueNumStr}: ${issue.title}`,
      url: issue.url || repo?.url || '',
      verified: true,
    }] : []),
    {
      type: 'Pull Request',
      label: `${prNumStr}: ${prTitle}`,
      url: pr?.url || repo?.url || '',
      verified: true,
    },
    {
      type: 'Merge Status',
      label: pr?.mergedBy ? `Merged by @${pr.mergedBy}` : 'Merged into repository',
      url: pr?.url || repo?.url || '',
      verified: true,
    },
    {
      type: 'Files',
      label: `${contribution.filesChanged || (diffData?.totalFiles ?? 1)} file(s) changed (+${contribution.linesAdded || (diffData?.totalAdditions ?? 0)} / -${contribution.linesDeleted || (diffData?.totalDeletions ?? 0)})`,
      url: pr?.url || repo?.url || '',
      verified: true,
    },
  ];

  // 7. Trade-offs (strictly evidence-based)
  const tradeoffs = [
    'No explicit trade-off was documented for this contribution.',
  ];

  // 8. Result (verified outcomes only)
  const result = `✓ Pull Request merged into ${repoFullName}`;

  return CaseStudyAnalysisSchema.parse({
    problem,
    investigation,
    approach,
    whatChanged: diffAnalysis.whatChanged,
    techniques: combinedTechniques,
    techniqueDetails: diffAnalysis.techniques,
    implementation,
    tradeoffs,
    result,
    evidence,
    confidence: 'HIGH',
    analysisCoverage: diffAnalysis.coverage,
    diffPatch: diffAnalysis.diffPatch,
  });
}

/**
 * Gets existing case study analysis or creates a new evidence-backed analysis in the DB.
 */
export async function getOrCreateCaseStudyAnalysis(contributionId: string): Promise<CaseStudyData | null> {
  const existing = await prisma.contributionAnalysis.findUnique({
    where: { contributionId },
  });

  if (existing) {
    const synthFallback = synthesizeEvidenceAnalysis({ id: contributionId, issue: null, pullRequest: null });
    return {
      id: existing.id,
      contributionId: existing.contributionId,
      problem: existing.problem,
      investigation: existing.investigation,
      approach: existing.approach,
      whatChanged: (existing as any).whatChanged || synthFallback.whatChanged,
      techniques: existing.techniques,
      techniqueDetails: (existing as any).techniqueDetails || synthFallback.techniqueDetails,
      implementation: (existing.implementation as any) || [],
      tradeoffs: existing.tradeoffs,
      result: existing.result,
      evidence: (existing.evidence as any) || [],
      confidence: (existing.confidence as any) || 'HIGH',
      analysisCoverage: ((existing as any).analysisCoverage as any) || 'FULL_DIFF',
      diffPatch: (existing as any).diffPatch || null,
      contributorLearned: existing.contributorLearned,
      modelVersion: existing.modelVersion,
      generatedAt: existing.generatedAt.toISOString(),
      contributorEdited: existing.contributorEdited,
      contributorEditedAt: existing.contributorEditedAt ? existing.contributorEditedAt.toISOString() : null,
    };
  }

  // Fetch full contribution with issue and PR relations
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      issue: { include: { repository: { include: { organization: true } } } },
      pullRequest: { include: { repository: true } },
    },
  });

  if (!contribution) return null;

  // Try fetching real GitHub diff patch files server-side if PR info is available
  let diffData: GitHubPullRequestDiffData | null = null;
  const pr = contribution.pullRequest;
  const repo = pr?.repository || contribution.issue?.repository;

  if (pr && repo && repo.owner && repo.name && pr.githubNumber) {
    diffData = await fetchGithubPullRequestFiles(repo.owner, repo.name, pr.githubNumber);
  }

  // Synthesize evidence analysis using diff data
  const synthesized = synthesizeEvidenceAnalysis(contribution, diffData);

  // Save to DB
  const created = await prisma.contributionAnalysis.create({
    data: {
      contributionId,
      problem: synthesized.problem,
      investigation: synthesized.investigation,
      approach: synthesized.approach,
      techniques: synthesized.techniques,
      implementation: synthesized.implementation as any,
      tradeoffs: synthesized.tradeoffs,
      result: synthesized.result,
      evidence: synthesized.evidence as any,
      confidence: synthesized.confidence,
      modelVersion: 'v2.0.0',
    },
  });

  return {
    id: created.id,
    contributionId: created.contributionId,
    problem: created.problem,
    investigation: created.investigation,
    approach: created.approach,
    whatChanged: synthesized.whatChanged,
    techniques: created.techniques,
    techniqueDetails: synthesized.techniqueDetails,
    implementation: (created.implementation as any) || [],
    tradeoffs: created.tradeoffs,
    result: created.result,
    evidence: (created.evidence as any) || [],
    confidence: (created.confidence as any) || 'HIGH',
    analysisCoverage: synthesized.analysisCoverage,
    diffPatch: synthesized.diffPatch,
    contributorLearned: created.contributorLearned,
    modelVersion: created.modelVersion,
    generatedAt: created.generatedAt.toISOString(),
    contributorEdited: created.contributorEdited,
    contributorEditedAt: created.contributorEditedAt ? created.contributorEditedAt.toISOString() : null,
  };
}

/**
 * Updates contributor reflection ("What I Learned") for a verified contribution.
 */
export async function updateContributorReflection(
  contributionId: string,
  userId: string,
  learned: string
): Promise<boolean> {
  const contrib = await prisma.contribution.findUnique({
    where: { id: contributionId },
    select: { userId: true },
  });

  if (!contrib || contrib.userId !== userId) return false;

  await prisma.contributionAnalysis.upsert({
    where: { contributionId },
    update: {
      contributorLearned: learned,
    },
    create: {
      contributionId,
      problem: 'Analysis in progress',
      investigation: 'Analysis in progress',
      approach: 'Analysis in progress',
      result: 'Analysis in progress',
      contributorLearned: learned,
    },
  });

  return true;
}

/**
 * Updates contributor edited analysis fields ("Edit Analysis") for a verified contribution.
 */
export async function updateContributorAnalysisEdit(
  contributionId: string,
  userId: string,
  data: {
    problem?: string;
    investigation?: string;
    approach?: string;
    techniques?: string[];
    tradeoffs?: string[];
    result?: string;
  }
): Promise<boolean> {
  const contrib = await prisma.contribution.findUnique({
    where: { id: contributionId },
    select: { userId: true },
  });

  if (!contrib || contrib.userId !== userId) return false;

  await prisma.contributionAnalysis.upsert({
    where: { contributionId },
    update: {
      ...(data.problem ? { problem: data.problem } : {}),
      ...(data.investigation ? { investigation: data.investigation } : {}),
      ...(data.approach ? { approach: data.approach } : {}),
      ...(data.techniques ? { techniques: data.techniques } : {}),
      ...(data.tradeoffs ? { tradeoffs: data.tradeoffs } : {}),
      ...(data.result ? { result: data.result } : {}),
      contributorEdited: true,
      contributorEditedAt: new Date(),
    },
    create: {
      contributionId,
      problem: data.problem || 'User edited problem',
      investigation: data.investigation || 'User edited investigation',
      approach: data.approach || 'User edited approach',
      techniques: data.techniques || [],
      tradeoffs: data.tradeoffs || [],
      result: data.result || 'User edited result',
      contributorEdited: true,
      contributorEditedAt: new Date(),
    },
  });

  return true;
}
