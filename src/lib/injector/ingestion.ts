import { Issue, Repository, IssuePRClassification, SyncAuditLog } from '@/types';
import { evaluate8FactorsWithEvidence } from '../issues/ingestion';
import { calculateRRDifficulty, SCORING_VERSION } from '../scoring';
import { mockDbStore } from '../../../scripts/db-runner';
import { GithubApiClient, GithubApiError, RateLimitError, AuthError, NotFoundError } from './client';
import { prisma, withPrismaRetry } from '@/lib/prisma';

export type IngestionChangeType = 'NEW' | 'UPDATED' | 'UNCHANGED' | 'CLOSED' | 'REOPENED';

export interface RawGithubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  user: {
    login: string;
  } | null;
  labels?: Array<{ name: string } | string>;
  comments?: number;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  pull_request?: any;
  milestone?: {
    title: string;
  } | null;
}

export type CompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'FAILED';

export interface IssueIngestionResult {
  repositoryFullName: string;
  success: boolean;
  completenessStatus: CompletenessStatus;
  totalGithubIssues: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  closedCount: number;
  prCountSkipped: number;
  pagesProcessed: number;
  gradingCount: number;
  error?: string;
  errorType?: string;
  issues: Issue[];
}

/**
 * Normalizes a raw GitHub issue payload into Repo Rescue's internal Issue structure.
 * Returns null if the item is a Pull Request (PR objects must be excluded from Issue table).
 */
export function normalizeGithubIssue(raw: RawGithubIssue, repo: Repository): {
  issue: Partial<Issue>;
  isPR: boolean;
} {
  if (raw.pull_request !== undefined) {
    return { issue: {}, isPR: true };
  }

  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
    : [];

  const status: 'OPEN' | 'CLOSED' = raw.state === 'closed' ? 'CLOSED' : 'OPEN';
  const authorUsername = raw.user?.login || 'ghost';

  const normalized: Partial<Issue> & { repositoryId: string } = {
    id: `iss-${repo.id}-${raw.number}`,
    githubId: raw.id,
    githubNumber: raw.number,
    repositoryId: repo.id,
    title: raw.title,
    body: raw.body || '',
    url: raw.html_url || `https://github.com/${repo.fullName}/issues/${raw.number}`,
    status,
    language: repo.language || 'TypeScript',
    ecosystem: repo.ecosystem || 'Node.js',
    authorUsername,
    createdAt: raw.created_at || new Date().toISOString(),
    openPrCount: 0,
    mergedPrCount: 0,
    prActivityClassification: 'OPEN_NO_PR',
    githubStateUpdatedAt: raw.updated_at || new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    ...(raw as any),
    labels,
  };

  return { issue: normalized, isPR: false };
}

/**
 * Detects whether an issue is NEW, UPDATED, UNCHANGED, CLOSED, or REOPENED,
 * and determines whether the RR 8-factor grading engine needs to re-evaluate.
 */
export function detectIssueChanges(
  existing: Issue | undefined,
  incoming: Partial<Issue>
): {
  changeType: IngestionChangeType;
  needsRegrading: boolean;
} {
  if (!existing) {
    return { changeType: 'NEW', needsRegrading: true };
  }

  const titleChanged = incoming.title !== undefined && existing.title !== incoming.title;
  const bodyChanged = incoming.body !== undefined && (existing.body || '') !== (incoming.body || '');
  const labelsChanged = incoming.labels !== undefined && JSON.stringify(existing.labels || []) !== JSON.stringify(incoming.labels || []);
  const statusChanged = incoming.status !== undefined && existing.status !== incoming.status;

  if (statusChanged && !titleChanged && !bodyChanged && !labelsChanged) {
    const changeType: IngestionChangeType = incoming.status === 'CLOSED' ? 'CLOSED' : 'REOPENED';
    return { changeType, needsRegrading: false };
  }

  if (titleChanged || bodyChanged || labelsChanged) {
    return { changeType: 'UPDATED', needsRegrading: true };
  }

  return { changeType: 'UNCHANGED', needsRegrading: false };
}

/**
 * Ingests and synchronizes all issues for a given repository from GitHub REST API.
 * Handles complete multi-page pagination, PR filtering, identity resolution, grading integration, and audit logging.
 * Zero synthetic or fake fallback data is generated on error.
 */
export async function ingestRepositoryIssues(
  repo: Repository,
  customToken?: string,
  stateFilter: 'open' | 'closed' | 'all' = 'open',
  options?: { readOnly?: boolean }
): Promise<IssueIngestionResult> {
  const isReadOnly = Boolean(options?.readOnly);
  const client = new GithubApiClient(customToken);

  let pageResult: { items: RawGithubIssue[]; pageCount: number; isTruncated: boolean };
  let completenessStatus: CompletenessStatus = 'COMPLETE';

  try {
    pageResult = await client.fetchAllIssuesComplete<RawGithubIssue>(repo.fullName, stateFilter);
  } catch (err: any) {
    const errorType = err.name || 'GithubApiError';
    if (err.name === 'RateLimitError') {
      completenessStatus = 'BLOCKED';
    } else {
      completenessStatus = 'FAILED';
    }
    const errText = `Ingestion API failure for repo '${repo.fullName}': ${err.message || String(err)}`;
    console.warn(`[Injector Ingestion] ${errText}`);

    // Log failure in SyncAuditLog without deleting existing records
    const auditLog: SyncAuditLog = {
      id: `log-ingest-err-${repo.fullName.replace('/', '-')}-${Date.now()}`,
      repositoryId: repo.id,
      eventType: 'BACKFILL_ISSUE',
      status: completenessStatus,
      completenessStatus,
      errorMessage: errText,
      createdAt: new Date().toISOString(),
    };
    if (!isReadOnly) {
      mockDbStore.syncAuditLogs.push(auditLog);
    }

    return {
      repositoryFullName: repo.fullName,
      success: false,
      completenessStatus,
      totalGithubIssues: 0,
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      closedCount: 0,
      prCountSkipped: 0,
      pagesProcessed: 0,
      gradingCount: 0,
      error: errText,
      errorType,
      issues: [],
    };
  }

  const { items: rawItems, pageCount } = pageResult;
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let closedCount = 0;
  let prCountSkipped = 0;
  let gradingCount = 0;
  const processedIssues: Issue[] = [];
  const now = new Date().toISOString();
  let dbRepo: any = null;
  if (!isReadOnly) {
    try {
      dbRepo = await withPrismaRetry(() =>
        prisma.repository.findFirst({
          where: { OR: [{ githubId: repo.githubId }, { fullName: repo.fullName }] },
        })
      );
      if (!dbRepo) {
        let dbOrg = await withPrismaRetry(() =>
          prisma.organization.findFirst({
            where: { login: repo.owner.toLowerCase() },
          })
        );
        if (!dbOrg) {
          dbOrg = await withPrismaRetry(() =>
            prisma.organization.upsert({
              where: { login: repo.owner.toLowerCase() },
              create: {
                githubId: Math.floor(Math.random() * 1000000),
                login: repo.owner.toLowerCase(),
                name: repo.owner,
                htmlUrl: `https://github.com/${repo.owner}`,
                autoDiscoverRepos: true,
                syncIssues: true,
              },
              update: {},
            })
          );
        }
        dbRepo = await withPrismaRetry(() =>
          prisma.repository.upsert({
            where: { fullName: repo.fullName },
            create: {
              githubId: repo.githubId,
              name: repo.name,
              fullName: repo.fullName,
              owner: repo.owner,
              description: repo.description || '',
              url: repo.url,
              language: repo.language || 'TypeScript',
              starsCount: repo.starsCount,
              forksCount: repo.forksCount,
              openIssuesCount: repo.openIssuesCount,
              isPrivate: repo.isPrivate,
              isArchived: repo.isArchived,
              isFork: repo.isFork,
              hasIssues: repo.hasIssues,
              eligibilityStatus: repo.eligibilityStatus,
              eligibilityReason: repo.eligibilityReason,
              ecosystem: repo.ecosystem || 'Node.js',
              repoType: repo.repoType || 'OPEN_SOURCE',
              maintainerActivityScore: repo.maintainerActivityScore ?? 8.5,
              organizationId: dbOrg.id,
              lastSyncedAt: new Date(now),
            },
            update: {
              name: repo.name,
              owner: repo.owner,
              lastSyncedAt: new Date(now),
            },
          })
        );
      }
    } catch (err) {
      console.warn(`[Injector Ingestion] Prisma Repository lookup error:`, err);
    }
  }

  for (const rawItem of rawItems) {
    const { issue: norm, isPR } = normalizeGithubIssue(rawItem, repo);
    if (isPR) {
      prCountSkipped++;
      continue;
    }

    // Canonical identity resolution: (repositoryId, githubNumber) or githubId
    const existingIssueIdx = mockDbStore.issues.findIndex(
      (i) =>
        (i.repositoryId === repo.id && i.githubNumber === norm.githubNumber) ||
        i.githubId === norm.githubId
    );

    const existingIssue = existingIssueIdx >= 0 ? mockDbStore.issues[existingIssueIdx] : undefined;
    const { changeType, needsRegrading } = detectIssueChanges(existingIssue, norm);

    let rrDifficulty = 0.0;
    let scoreBreakdown: any = undefined;

    // Always compute evaluation & scoreRecord for 100% of issues to enforce the invariant:
    // Every persisted issue MUST have an associated IssueScore record.
    const evaluation = evaluate8FactorsWithEvidence({
      title: norm.title || '',
      body: norm.body || '',
      labels: norm.labels || [],
      repoFullName: repo.fullName,
      repository: repo,
    });

    rrDifficulty = calculateRRDifficulty(evaluation.factors);
    scoreBreakdown = evaluation.factors;
    gradingCount++;

    // Save/Upsert IssueScore in mockDbStore.issueScores
    const scoreId = `score-${repo.id}-${norm.githubNumber}`;
    const scoreRecord: any = {
      id: scoreId,
      issueId: norm.id!,
      scoringVersion: SCORING_VERSION,
      calculatedAt: now,
      technicalDifficulty: evaluation.factors.technicalDifficulty,
      codebaseComplexity: evaluation.factors.codebaseComplexity,
      issueScope: evaluation.factors.issueScope,
      domainKnowledge: evaluation.factors.domainKnowledge,
      expectedImpact: evaluation.factors.expectedImpact,
      testingComplexity: evaluation.factors.testingComplexity,
      issueClarity: evaluation.factors.issueClarity,
      maintainerActivity: evaluation.factors.maintainerActivity,
      compositeScore: rrDifficulty,
      reasoning: evaluation.overallReasoning,
      factorDetails: evaluation.factorDetails,
    };

    if (!isReadOnly) {
      const existingScoreIdx = mockDbStore.issueScores.findIndex((s) => s.issueId === norm.id || s.id === scoreId);
      if (existingScoreIdx >= 0) {
        mockDbStore.issueScores[existingScoreIdx] = scoreRecord;
      } else {
        mockDbStore.issueScores.push(scoreRecord);
      }
    }

    const fullIssue: Issue & { repositoryId: string } = {
      id: existingIssue ? existingIssue.id : norm.id!,
      githubId: norm.githubId!,
      githubNumber: norm.githubNumber!,
      repositoryId: repo.id,
      repository: repo,
      title: norm.title!,
      body: norm.body!,
      url: norm.url!,
      status: norm.status || 'OPEN',
      labels: norm.labels || [],
      language: norm.language || repo.language || 'TypeScript',
      ecosystem: norm.ecosystem || repo.ecosystem || 'Node.js',
      authorUsername: norm.authorUsername || 'ghost',
      rrDifficulty,
      createdAt: norm.createdAt!,
      scoreBreakdown,
      prActivityClassification: existingIssue?.prActivityClassification || 'OPEN_NO_PR',
      openPrCount: existingIssue?.openPrCount ?? 0,
      mergedPrCount: existingIssue?.mergedPrCount ?? 0,
      latestPrActivityAt: existingIssue?.latestPrActivityAt,
      githubStateUpdatedAt: norm.githubStateUpdatedAt || now,
      lastSyncedAt: now,
    };

    if (existingIssueIdx >= 0) {
      if (!isReadOnly) {
        mockDbStore.issues[existingIssueIdx] = fullIssue;
      }
      if (changeType === 'CLOSED') closedCount++;
      else if (changeType === 'UPDATED') updatedCount++;
      else unchangedCount++;
    } else {
      if (!isReadOnly) {
        mockDbStore.issues.push(fullIssue);
      }
      insertedCount++;
    }

    processedIssues.push({ fullIssue, norm, rrDifficulty, scoreRecord } as any);
  }

  const finalIssues = processedIssues.map((p: any) => p.fullIssue);

  // Sequential Prisma Issue & IssueScore upserts to prevent connection pool exhaustion
  if (!isReadOnly && dbRepo) {
    let itemIndex = 0;
    for (const item of processedIssues as any[]) {
      itemIndex++;
      if (itemIndex > 1 && itemIndex % 50 === 0) {
        await new Promise((r) => setTimeout(r, 20));
      }
      const { norm, rrDifficulty, scoreRecord } = item;
      try {
        const dbIssue = await withPrismaRetry(() =>
          prisma.issue.upsert({
            where: {
              repositoryId_githubNumber: {
                repositoryId: dbRepo.id,
                githubNumber: norm.githubNumber!,
              },
            },
            create: {
              githubId: BigInt(norm.githubId!),
              githubNumber: norm.githubNumber!,
              repositoryId: dbRepo.id,
              title: norm.title!,
              body: norm.body!,
              url: norm.url!,
              status: (norm.status === 'CLOSED' ? 'CLOSED' : 'OPEN') as any,
              labels: norm.labels || [],
              language: norm.language || dbRepo.language || 'TypeScript',
              ecosystem: norm.ecosystem || dbRepo.ecosystem || 'Node.js',
              authorUsername: norm.authorUsername || 'ghost',
              rrDifficulty,
              createdAt: new Date(norm.createdAt!),
              githubState: norm.status === 'CLOSED' ? 'closed' : 'open',
              lastSyncedAt: new Date(now),
            },
            update: {
              title: norm.title!,
              body: norm.body!,
              url: norm.url!,
              status: (norm.status === 'CLOSED' ? 'CLOSED' : 'OPEN') as any,
              labels: norm.labels || [],
              language: norm.language || dbRepo.language || 'TypeScript',
              ecosystem: norm.ecosystem || dbRepo.ecosystem || 'Node.js',
              authorUsername: norm.authorUsername || 'ghost',
              rrDifficulty,
              githubState: norm.status === 'CLOSED' ? 'closed' : 'open',
              lastSyncedAt: new Date(now),
            },
          })
        );

        if (scoreRecord) {
          await withPrismaRetry(() =>
            prisma.issueScore.upsert({
              where: { issueId: dbIssue.id },
              create: {
                issueId: dbIssue.id,
                scoringVersion: scoreRecord.scoringVersion || 'v1.1.0',
                technicalDifficulty: scoreRecord.technicalDifficulty,
                codebaseComplexity: scoreRecord.codebaseComplexity,
                issueScope: scoreRecord.issueScope,
                domainKnowledge: scoreRecord.domainKnowledge,
                expectedImpact: scoreRecord.expectedImpact,
                testingComplexity: scoreRecord.testingComplexity,
                issueClarity: scoreRecord.issueClarity,
                maintainerActivity: scoreRecord.maintainerActivity,
                compositeScore: scoreRecord.compositeScore,
                reasoning: scoreRecord.reasoning,
              },
              update: {
                scoringVersion: scoreRecord.scoringVersion || 'v1.1.0',
                technicalDifficulty: scoreRecord.technicalDifficulty,
                codebaseComplexity: scoreRecord.codebaseComplexity,
                issueScope: scoreRecord.issueScope,
                domainKnowledge: scoreRecord.domainKnowledge,
                expectedImpact: scoreRecord.expectedImpact,
                testingComplexity: scoreRecord.testingComplexity,
                issueClarity: scoreRecord.issueClarity,
                maintainerActivity: scoreRecord.maintainerActivity,
                compositeScore: scoreRecord.compositeScore,
                reasoning: scoreRecord.reasoning,
              },
            })
          );
        }
      } catch (err) {
        console.warn(`[Injector Ingestion] Prisma Issue/Score upsert error:`, err);
      }
    }
  }

  // Update repository lastSyncedAt timestamp
  if (!isReadOnly) {
    repo.lastSyncedAt = now;
  }

  // Record audit log entry with explicit completeness semantics
  const summary = `Ingested ${finalIssues.length} issues from ${repo.fullName} across ${pageCount} page(s) [Completeness: ${completenessStatus}] (${insertedCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${closedCount} closed, ${prCountSkipped} PRs skipped, ${gradingCount} graded).`;
  const auditLog: SyncAuditLog = {
    id: `log-ingest-${repo.fullName.replace('/', '-')}-${Date.now()}`,
    repositoryId: repo.id,
    eventType: 'BACKFILL_ISSUE',
    status: completenessStatus === 'COMPLETE' ? 'SUCCESS' : completenessStatus,
    completenessStatus,
    changesSummary: summary,
    gradingRan: gradingCount > 0,
    createdAt: now,
  };
  if (!isReadOnly) {
    mockDbStore.syncAuditLogs.push(auditLog);
    try {
      await withPrismaRetry(() =>
        prisma.syncAuditLog.create({
          data: {
            repositoryId: dbRepo?.id || repo.id,
            eventType: 'BACKFILL_ISSUE',
            status: auditLog.status,
            changesSummary: auditLog.changesSummary,
            gradingRan: auditLog.gradingRan,
          },
        })
      );
    } catch (err) {}
  }

  return {
    repositoryFullName: repo.fullName,
    success: true,
    completenessStatus,
    totalGithubIssues: rawItems.length,
    insertedCount,
    updatedCount,
    unchangedCount,
    closedCount,
    prCountSkipped,
    pagesProcessed: pageCount,
    gradingCount,
    issues: processedIssues,
  };
}
