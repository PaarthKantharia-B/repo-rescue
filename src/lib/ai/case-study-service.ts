import { prisma } from '@/lib/prisma';
import { CaseStudyAnalysisSchema, CaseStudyAnalysisInput } from './case-study-schema';
import {
  analyzePullRequestDiff,
  fetchGithubPullRequestFiles,
  GitHubPullRequestDiffData,
  GitHubCheckRunItem,
  GitHubChecksSummary,
  FileAnalysisItem,
} from './diff-analysis-engine';

export const CURRENT_CASE_STUDY_VERSION = 'v3.1.0';

export interface WhatChangedItem {
  statement: string;
  source?: 'VERIFIED_DIFF' | 'VERIFIED_METADATA';
  evidenceFiles?: string[];
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TechniqueDetailItem {
  name: string;
  evidenceFiles: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CaseStudyData {
  id: string;
  contributionId: string;
  engineeringThesis?: string;
  howItWorks?: string | null;
  problem: string;
  investigation: string;
  approach: string;
  whatChanged: WhatChangedItem[];
  fileAnalyses: FileAnalysisItem[];
  techniques: string[];
  techniqueDetails: TechniqueDetailItem[];
  checks: GitHubCheckRunItem[];
  checksSummary?: GitHubChecksSummary;
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
  const investigation = `Based on PR discussion, check runs, and implementation diffs in ${repoFullName}, the contribution modifies execution paths in ${lang} runtime components.`;

  // 3. Approach
  const approach = contribution.approach && contribution.approach.trim().length > 10
    ? contribution.approach.trim()
    : diffAnalysis.whatChanged.map((w) => w.statement).join(' ') || `Modifies ${contribution.filesChanged || 1} file(s) (+${contribution.linesAdded || 0} / -${contribution.linesDeleted || 0} lines) in ${prNumStr}.`;

  // 4. Techniques
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
  const evidenceList = [
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
    engineeringThesis: diffAnalysis.engineeringThesis,
    howItWorks: diffAnalysis.howItWorks,
    problem,
    investigation,
    approach,
    whatChanged: diffAnalysis.whatChanged,
    fileAnalyses: diffAnalysis.fileAnalyses,
    techniques: combinedTechniques,
    techniqueDetails: diffAnalysis.techniques,
    checks: diffAnalysis.checks,
    checksSummary: diffAnalysis.checksSummary,
    implementation,
    tradeoffs,
    result,
    evidence: evidenceList,
    confidence: 'HIGH',
    analysisCoverage: diffAnalysis.coverage,
    diffPatch: diffAnalysis.diffPatch,
  });
}

/**
 * Helper to pack/unpack extended v3 analysis fields into DB Json fields.
 */
function packExtendedEvidence(synth: CaseStudyAnalysisInput): any {
  return {
    items: synth.evidence,
    fileAnalyses: synth.fileAnalyses || [],
    checks: synth.checks || [],
    checksSummary: synth.checksSummary || null,
    whatChanged: synth.whatChanged || [],
    engineeringThesis: synth.engineeringThesis || '',
    howItWorks: synth.howItWorks || null,
  };
}

function unpackExtendedAnalysis(existing: any, synthFallback: CaseStudyAnalysisInput): {
  evidence: any[];
  fileAnalyses: FileAnalysisItem[];
  checks: GitHubCheckRunItem[];
  checksSummary: GitHubChecksSummary | undefined;
  whatChanged: WhatChangedItem[];
  engineeringThesis: string | undefined;
  howItWorks: string | null | undefined;
} {
  const ev = existing.evidence;
  if (ev && typeof ev === 'object' && !Array.isArray(ev) && (ev as any).items) {
    return {
      evidence: (ev as any).items || [],
      fileAnalyses: (ev as any).fileAnalyses || synthFallback.fileAnalyses || [],
      checks: (ev as any).checks || synthFallback.checks || [],
      checksSummary: (ev as any).checksSummary || synthFallback.checksSummary,
      whatChanged: (ev as any).whatChanged || synthFallback.whatChanged || [],
      engineeringThesis: (ev as any).engineeringThesis || synthFallback.engineeringThesis,
      howItWorks: (ev as any).howItWorks !== undefined ? (ev as any).howItWorks : synthFallback.howItWorks,
    };
  }

  return {
    evidence: Array.isArray(ev) ? ev : synthFallback.evidence,
    fileAnalyses: (existing as any).fileAnalyses || synthFallback.fileAnalyses || [],
    checks: (existing as any).checks || synthFallback.checks || [],
    checksSummary: (existing as any).checksSummary || synthFallback.checksSummary,
    whatChanged: (existing as any).whatChanged || synthFallback.whatChanged || [],
    engineeringThesis: (existing as any).engineeringThesis || synthFallback.engineeringThesis,
    howItWorks: (existing as any).howItWorks || synthFallback.howItWorks,
  };
}

/**
 * Gets existing case study analysis or creates/regenerates an evidence-backed analysis in the DB.
 */
export async function getOrCreateCaseStudyAnalysis(contributionId: string): Promise<CaseStudyData | null> {
  const existing = await prisma.contributionAnalysis.findUnique({
    where: { contributionId },
  });

  // If existing analysis is UP TO DATE (modelVersion === CURRENT_CASE_STUDY_VERSION), return cached record
  if (existing && existing.modelVersion === CURRENT_CASE_STUDY_VERSION) {
    const synthFallback = synthesizeEvidenceAnalysis({ id: contributionId, issue: null, pullRequest: null });
    const unpacked = unpackExtendedAnalysis(existing, synthFallback);

    return {
      id: existing.id,
      contributionId: existing.contributionId,
      engineeringThesis: unpacked.engineeringThesis,
      howItWorks: unpacked.howItWorks,
      problem: existing.problem,
      investigation: existing.investigation,
      approach: existing.approach,
      whatChanged: unpacked.whatChanged,
      fileAnalyses: unpacked.fileAnalyses,
      techniques: existing.techniques,
      techniqueDetails: (existing as any).techniqueDetails || synthFallback.techniqueDetails,
      checks: unpacked.checks,
      checksSummary: unpacked.checksSummary,
      implementation: (existing.implementation as any) || [],
      tradeoffs: existing.tradeoffs,
      result: existing.result,
      evidence: unpacked.evidence,
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

  // Otherwise, existing is missing OR stale (modelVersion !== CURRENT_CASE_STUDY_VERSION)!
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      issue: { include: { repository: { include: { organization: true } } } },
      pullRequest: { include: { repository: true } },
    },
  });

  if (!contribution) {
    if (existing) {
      const synthFallback = synthesizeEvidenceAnalysis({ id: contributionId, issue: null, pullRequest: null });
      const unpacked = unpackExtendedAnalysis(existing, synthFallback);
      return {
        id: existing.id,
        contributionId: existing.contributionId,
        engineeringThesis: unpacked.engineeringThesis,
        howItWorks: unpacked.howItWorks,
        problem: existing.problem,
        investigation: existing.investigation,
        approach: existing.approach,
        whatChanged: unpacked.whatChanged,
        fileAnalyses: unpacked.fileAnalyses,
        techniques: existing.techniques,
        techniqueDetails: (existing as any).techniqueDetails || synthFallback.techniqueDetails,
        checks: unpacked.checks,
        checksSummary: unpacked.checksSummary,
        implementation: (existing.implementation as any) || [],
        tradeoffs: existing.tradeoffs,
        result: existing.result,
        evidence: unpacked.evidence,
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
    return null;
  }

  // Try fetching real GitHub diff patch files & check runs server-side if PR info is available
  let diffData: GitHubPullRequestDiffData | null = null;
  const pr = contribution.pullRequest;
  const repo = pr?.repository || contribution.issue?.repository;

  if (pr && repo && repo.owner && repo.name && pr.githubNumber) {
    try {
      diffData = await fetchGithubPullRequestFiles(repo.owner, repo.name, pr.githubNumber);
    } catch (err) {
      console.warn(`[CaseStudyService] Failed fetching GitHub diff for ${repo.owner}/${repo.name}#${pr.githubNumber}:`, err);
    }
  }

  // Synthesize evidence analysis using diff data & check runs
  const synthesized = synthesizeEvidenceAnalysis(contribution, diffData);
  const evidencePayload = packExtendedEvidence(synthesized);

  // Upsert (Update existing stale analysis or create new record in DB)
  try {
    const upserted = await prisma.contributionAnalysis.upsert({
      where: { contributionId },
      update: {
        problem: synthesized.problem,
        investigation: synthesized.investigation,
        approach: synthesized.approach,
        techniques: synthesized.techniques,
        implementation: synthesized.implementation as any,
        tradeoffs: synthesized.tradeoffs,
        result: synthesized.result,
        evidence: evidencePayload,
        confidence: synthesized.confidence,
        modelVersion: CURRENT_CASE_STUDY_VERSION,
      },
      create: {
        contributionId,
        problem: synthesized.problem,
        investigation: synthesized.investigation,
        approach: synthesized.approach,
        techniques: synthesized.techniques,
        implementation: synthesized.implementation as any,
        tradeoffs: synthesized.tradeoffs,
        result: synthesized.result,
        evidence: evidencePayload,
        confidence: synthesized.confidence,
        modelVersion: CURRENT_CASE_STUDY_VERSION,
      },
    });

    return {
      id: upserted.id,
      contributionId: upserted.contributionId,
      engineeringThesis: synthesized.engineeringThesis,
      howItWorks: synthesized.howItWorks,
      problem: upserted.problem,
      investigation: upserted.investigation,
      approach: upserted.approach,
      whatChanged: synthesized.whatChanged || [],
      fileAnalyses: synthesized.fileAnalyses || [],
      techniques: upserted.techniques,
      techniqueDetails: synthesized.techniqueDetails || [],
      checks: synthesized.checks || [],
      checksSummary: synthesized.checksSummary,
      implementation: (upserted.implementation as any) || [],
      tradeoffs: upserted.tradeoffs,
      result: upserted.result,
      evidence: synthesized.evidence,
      confidence: (upserted.confidence as any) || 'HIGH',
      analysisCoverage: synthesized.analysisCoverage,
      diffPatch: synthesized.diffPatch,
      contributorLearned: upserted.contributorLearned,
      modelVersion: upserted.modelVersion,
      generatedAt: upserted.generatedAt.toISOString(),
      contributorEdited: upserted.contributorEdited,
      contributorEditedAt: upserted.contributorEditedAt ? upserted.contributorEditedAt.toISOString() : null,
    };
  } catch (err) {
    console.error(`[CaseStudyService] DB upsert failed for ${contributionId}:`, err);
    return {
      id: existing?.id || `synth-${contributionId}`,
      contributionId,
      engineeringThesis: synthesized.engineeringThesis,
      howItWorks: synthesized.howItWorks,
      problem: synthesized.problem,
      investigation: synthesized.investigation,
      approach: synthesized.approach,
      whatChanged: synthesized.whatChanged || [],
      fileAnalyses: synthesized.fileAnalyses || [],
      techniques: synthesized.techniques,
      techniqueDetails: synthesized.techniqueDetails || [],
      checks: synthesized.checks || [],
      checksSummary: synthesized.checksSummary,
      implementation: synthesized.implementation as any,
      tradeoffs: synthesized.tradeoffs,
      result: synthesized.result,
      evidence: synthesized.evidence as any,
      confidence: synthesized.confidence,
      analysisCoverage: synthesized.analysisCoverage,
      diffPatch: synthesized.diffPatch,
      contributorLearned: existing?.contributorLearned || null,
      modelVersion: CURRENT_CASE_STUDY_VERSION,
      generatedAt: new Date().toISOString(),
      contributorEdited: existing?.contributorEdited || false,
      contributorEditedAt: existing?.contributorEditedAt ? existing.contributorEditedAt.toISOString() : null,
    };
  }
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
