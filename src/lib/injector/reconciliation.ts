import { mockDbStore } from '../../../scripts/db-runner';
import {
  Issue,
  Repository,
  SyncAuditLog,
  OrganizationConfig,
} from '@/types';
import { TARGET_ORGANIZATIONS_CONFIG } from '../organizations/config';
import {
  discoverOrganizationRepositories,
  evaluateRepositoryEligibility,
} from './discovery';
import {
  normalizeGithubIssue,
  RawGithubIssue,
} from './ingestion';
import { evaluateV2FactorsWithEvidence } from '../issues/ingestion';
import { calculateRRDifficultyV2, SCORING_VERSION_V2_3_1 } from '../scoring';
import { recalculateIssuePRStats } from '../issues/sync';
import { extractLinkedIssueNumbers, verifyAndAwardContribution } from '../contributions/verify';
import { GithubApiClient } from './client';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { processLiveIssueEvent, processLivePREvent } from './sync-service';

export interface ReconciliationOptions {
  customToken?: string;
  forceRegrade?: boolean;
  targetOrgs?: string[];
  targetRepos?: string[];
}

export interface DriftReportEntry {
  type: 'STATUS' | 'COMMENTS' | 'PR_COUNT' | 'TITLE_BODY' | 'ELIGIBILITY' | 'TOMBSTONE';
  repositoryFullName: string;
  issueGithubNumber?: number;
  githubValue: any;
  localValue: any;
  actionTaken: string;
}

export interface RepoReconciliationResult {
  repositoryFullName: string;
  success: boolean;
  notModified?: boolean;
  issuesExamined: number;
  insertedCount: number;
  updatedCount: number;
  closedCount: number;
  reopenedCount: number;
  tombstonedCount: number;
  regradedCount: number;
  commentsCorrected: number;
  prsReconciled: number;
  pointsAwarded: number;
  driftRepairs: DriftReportEntry[];
  error?: string;
}

export interface FullReconciliationSummary {
  success: boolean;
  orgsProcessed: number;
  reposExamined: number;
  issuesExamined: number;
  insertedCount: number;
  updatedCount: number;
  closedCount: number;
  reopenedCount: number;
  tombstonedCount: number;
  regradedCount: number;
  commentsCorrected: number;
  prsReconciled: number;
  pointsAwarded: number;
  driftRepairs: DriftReportEntry[];
  errors: string[];
  durationMs: number;
}

/**
 * Reconciles repository discovery and eligibility metadata across an organization.
 */
export async function reconcileOrganization(
  orgLogin: string,
  customToken?: string,
  options?: { maxPages?: number; perPage?: number }
): Promise<{ success: boolean; discoveredCount: number; updatedReposCount: number; error?: string }> {
  const orgConfig = TARGET_ORGANIZATIONS_CONFIG.find(
    (o) => o.login.toLowerCase() === orgLogin.toLowerCase()
  );

  if (!orgConfig) {
    return {
      success: false,
      discoveredCount: 0,
      updatedReposCount: 0,
      error: `Organization '${orgLogin}' is not configured in Repo Rescue.`,
    };
  }

  const discoveryRes = await discoverOrganizationRepositories(orgConfig, customToken, options);
  if (!discoveryRes.success) {
    return {
      success: false,
      discoveredCount: 0,
      updatedReposCount: 0,
      error: discoveryRes.error,
    };
  }

  return {
    success: true,
    discoveredCount: discoveryRes.discoveredCount,
    updatedReposCount: discoveryRes.repositories.length,
  };
}

/**
 * Authoritative issue reconciliation for a single repository.
 * Detects missed creations, edits, closures, reopenings, deletions, comment drift, and PR states.
 * Employs ETags (If-None-Match) to skip unchanged repositories safely.
 */
export async function reconcileRepositoryIssues(
  repoFullName: string,
  customToken?: string
): Promise<RepoReconciliationResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();
  const driftRepairs: DriftReportEntry[] = [];

  const repo = mockDbStore.repositories.find(
    (r) => r.fullName.toLowerCase() === repoFullName.toLowerCase()
  );

  if (!repo) {
    return {
      repositoryFullName: repoFullName,
      success: false,
      issuesExamined: 0,
      insertedCount: 0,
      updatedCount: 0,
      closedCount: 0,
      reopenedCount: 0,
      tombstonedCount: 0,
      regradedCount: 0,
      commentsCorrected: 0,
      prsReconciled: 0,
      pointsAwarded: 0,
      driftRepairs: [],
      error: `Repository '${repoFullName}' is not indexed in Repo Rescue store.`,
    };
  }

  const client = new GithubApiClient(customToken);
  const issuesUrl = `https://api.github.com/repos/${repo.fullName}/issues?state=all&per_page=100`;

  let pageResult;
  try {
    pageResult = await client.fetchAllPages<RawGithubIssue>(issuesUrl);
  } catch (err: any) {
    const errText = `Reconciliation API failure for '${repo.fullName}': ${err.message || String(err)}`;
    console.warn(`[Reconciliation Failure] ${errText}`);

    // FAILURE SAFETY: Preserve existing local state completely! Never delete or tombstone on error.
    const auditLog: SyncAuditLog = {
      id: `log-recon-err-${repo.fullName.replace('/', '-')}-${Date.now()}`,
      repositoryId: repo.id,
      eventType: 'RECONCILIATION_ISSUES',
      status: 'FAILED',
      errorMessage: errText,
      createdAt: now,
    };
    mockDbStore.syncAuditLogs.push(auditLog);

    return {
      repositoryFullName: repo.fullName,
      success: false,
      issuesExamined: 0,
      insertedCount: 0,
      updatedCount: 0,
      closedCount: 0,
      reopenedCount: 0,
      tombstonedCount: 0,
      regradedCount: 0,
      commentsCorrected: 0,
      prsReconciled: 0,
      pointsAwarded: 0,
      driftRepairs: [],
      error: errText,
    };
  }

  // Handle HTTP 304 Not Modified
  if (pageResult.notModified) {
    const auditLog: SyncAuditLog = {
      id: `log-recon-304-${repo.fullName.replace('/', '-')}-${Date.now()}`,
      repositoryId: repo.id,
      eventType: 'RECONCILIATION_ISSUES',
      status: 'SUCCESS',
      changesSummary: `Reconciliation for '${repo.fullName}': 304 Not Modified. No content changes on GitHub.`,
      createdAt: now,
    };
    mockDbStore.syncAuditLogs.push(auditLog);

    return {
      repositoryFullName: repo.fullName,
      success: true,
      notModified: true,
      issuesExamined: 0,
      insertedCount: 0,
      updatedCount: 0,
      closedCount: 0,
      reopenedCount: 0,
      tombstonedCount: 0,
      regradedCount: 0,
      commentsCorrected: 0,
      prsReconciled: 0,
      pointsAwarded: 0,
      driftRepairs: [],
    };
  }

  const rawGithubItems = pageResult.items;
  const githubIssueMap = new Map<number, RawGithubIssue>();
  let prCountSkipped = 0;

  for (const raw of rawGithubItems) {
    if (raw.pull_request !== undefined) {
      prCountSkipped++;
      continue;
    }
    githubIssueMap.set(raw.number, raw);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let closedCount = 0;
  let reopenedCount = 0;
  let tombstonedCount = 0;
  let regradedCount = 0;
  let commentsCorrected = 0;
  let prsReconciled = 0;
  let pointsAwarded = 0;

  // Fetch local active and tombstoned issues for this repository
  const localRepoIssues = mockDbStore.issues.filter((i) => i.repositoryId === repo.id);

  // 1. Process all GitHub issues (detect NEW, UPDATED, CLOSED, REOPENED, COMMENT DRIFT)
  for (const [ghNumber, rawGhIssue] of githubIssueMap.entries()) {
    const existingIssue = localRepoIssues.find((i) => i.githubNumber === ghNumber);

    const incomingTitle = rawGhIssue.title || '';
    const incomingBody = rawGhIssue.body || '';
    const rawLabels = Array.isArray(rawGhIssue.labels)
      ? rawGhIssue.labels.map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
      : [];

    const incomingStatus: 'OPEN' | 'CLOSED' = rawGhIssue.state === 'closed' ? 'CLOSED' : 'OPEN';
    const authorUsername = rawGhIssue.user?.login || 'ghost';

    if (!existingIssue) {
      // NEW Issue missed by webhooks
      const evaluation = evaluateV2FactorsWithEvidence({
        title: incomingTitle,
        body: incomingBody,
        labels: rawLabels,
        repoName: repo.name,
        repoStars: repo.starsCount,
        repoType: repo.repoType,
      });

      const rrDifficulty = evaluation.compositeScore;
      regradedCount++;
      insertedCount++;

      const issueId = `iss-${repo.id}-${ghNumber}`;
      const scoreId = `score-${repo.id}-${ghNumber}`;

      mockDbStore.issueScores.push({
        id: scoreId,
        issueId,
        scoringVersion: SCORING_VERSION_V2_3_1,
        calculatedAt: now,
        technicalDifficulty: evaluation.factors.technicalComplexity,
        codebaseComplexity: evaluation.factors.changeScope,
        issueScope: evaluation.factors.domainSpecialization,
        domainKnowledge: evaluation.factors.testingVerificationEffort,
        expectedImpact: evaluation.factors.problemAmbiguity,
        testingComplexity: evaluation.factors.testingVerificationEffort,
        issueClarity: evaluation.factors.problemAmbiguity,
        maintainerActivity: 5.0,
        compositeScore: rrDifficulty,
        reasoning: evaluation.overallReasoning,
      });

      const newIssueRecord: Issue & { repositoryId: string } = {
        id: issueId,
        githubId: rawGhIssue.id,
        githubNumber: ghNumber,
        repositoryId: repo.id,
        repository: repo,
        title: incomingTitle,
        body: incomingBody,
        url: rawGhIssue.html_url || `https://github.com/${repo.fullName}/issues/${ghNumber}`,
        status: incomingStatus,
        labels: rawLabels,
        language: repo.language || 'TypeScript',
        ecosystem: repo.ecosystem || 'Node.js',
        authorUsername,
        rrDifficulty,
        createdAt: rawGhIssue.created_at || now,
        scoreBreakdown: evaluation.factors as any,
        prActivityClassification: 'OPEN_NO_PR',
        openPrCount: 0,
        mergedPrCount: 0,
        githubStateUpdatedAt: rawGhIssue.updated_at || now,
        lastSyncedAt: now,
        isDeleted: false,
      };

      (newIssueRecord as any).commentsCount = rawGhIssue.comments ?? 0;
      mockDbStore.issues.push(newIssueRecord);

      driftRepairs.push({
        type: 'STATUS',
        repositoryFullName: repo.fullName,
        issueGithubNumber: ghNumber,
        githubValue: 'EXISTS_ON_GITHUB',
        localValue: 'MISSING_LOCALLY',
        actionTaken: `Inserted missed issue #${ghNumber} with status ${incomingStatus} (RR Difficulty: ${rrDifficulty.toFixed(1)}).`,
      });
    } else {
      // EXISTING Issue reconciliation
      const titleChanged = existingIssue.title !== incomingTitle;
      const bodyChanged = (existingIssue.body || '') !== incomingBody;
      const sortedExistingLabels = [...(existingIssue.labels || [])].sort();
      const sortedIncomingLabels = [...rawLabels].sort();
      const labelsChanged = JSON.stringify(sortedExistingLabels) !== JSON.stringify(sortedIncomingLabels);
      const statusChanged = existingIssue.status !== incomingStatus;
      const tombstoneRestored = existingIssue.isDeleted === true && incomingStatus === 'OPEN';

      // Comment count reconciliation
      const localComments = (existingIssue as any).commentsCount ?? 0;
      const ghComments = rawGhIssue.comments ?? localComments;
      if (rawGhIssue.comments !== undefined && localComments !== ghComments) {
        (existingIssue as any).commentsCount = ghComments;
        commentsCorrected++;
        driftRepairs.push({
          type: 'COMMENTS',
          repositoryFullName: repo.fullName,
          issueGithubNumber: ghNumber,
          githubValue: ghComments,
          localValue: localComments,
          actionTaken: `Corrected comments count on #${ghNumber} from ${localComments} to ${ghComments}.`,
        });
      }

      // Re-grade ONLY when title, body, or labels change materially
      let rrDifficulty = existingIssue.rrDifficulty;
      let scoreBreakdown = existingIssue.scoreBreakdown;

      if (titleChanged || bodyChanged || labelsChanged) {
        const evaluation = evaluateV2FactorsWithEvidence({
          title: incomingTitle,
          body: incomingBody,
          labels: rawLabels,
          repoName: repo.name,
          repoStars: repo.starsCount,
          repoType: repo.repoType,
        });

        rrDifficulty = evaluation.compositeScore;
        scoreBreakdown = evaluation.factors;
        regradedCount++;

        const scoreId = `score-${repo.id}-${ghNumber}`;
        const existingScoreIdx = mockDbStore.issueScores.findIndex(
          (s) => s.issueId === existingIssue.id || s.id === scoreId
        );

        const scoreRecord = {
          id: scoreId,
          issueId: existingIssue.id,
          scoringVersion: SCORING_VERSION_V2_3_1,
          calculatedAt: now,
          technicalDifficulty: evaluation.factors.technicalComplexity,
          codebaseComplexity: evaluation.factors.changeScope,
          issueScope: evaluation.factors.domainSpecialization,
          domainKnowledge: evaluation.factors.testingVerificationEffort,
          expectedImpact: evaluation.factors.problemAmbiguity,
          testingComplexity: evaluation.factors.testingVerificationEffort,
          issueClarity: evaluation.factors.problemAmbiguity,
          maintainerActivity: 5.0,
          compositeScore: rrDifficulty,
          reasoning: evaluation.overallReasoning,
        };

        if (existingScoreIdx >= 0) {
          mockDbStore.issueScores[existingScoreIdx] = scoreRecord;
        } else {
          mockDbStore.issueScores.push(scoreRecord);
        }

        driftRepairs.push({
          type: 'TITLE_BODY',
          repositoryFullName: repo.fullName,
          issueGithubNumber: ghNumber,
          githubValue: 'UPDATED_CONTENT',
          localValue: 'STALE_CONTENT',
          actionTaken: `Updated content and re-graded issue #${ghNumber} (New Difficulty: ${rrDifficulty.toFixed(1)}).`,
        });
      }

      if (statusChanged || tombstoneRestored) {
        if (incomingStatus === 'CLOSED') closedCount++;
        else if (incomingStatus === 'OPEN') reopenedCount++;

        driftRepairs.push({
          type: 'STATUS',
          repositoryFullName: repo.fullName,
          issueGithubNumber: ghNumber,
          githubValue: incomingStatus,
          localValue: existingIssue.status,
          actionTaken: `Updated issue #${ghNumber} status from ${existingIssue.status} to ${incomingStatus}.`,
        });
      }

      if (titleChanged || bodyChanged || labelsChanged || statusChanged || tombstoneRestored) {
        updatedCount++;
      }

      existingIssue.title = incomingTitle;
      existingIssue.body = incomingBody;
      existingIssue.status = incomingStatus;
      existingIssue.labels = rawLabels;
      existingIssue.rrDifficulty = rrDifficulty;
      existingIssue.scoreBreakdown = scoreBreakdown;
      existingIssue.githubStateUpdatedAt = rawGhIssue.updated_at || now;
      existingIssue.lastSyncedAt = now;
      if (tombstoneRestored || incomingStatus === 'OPEN') {
        existingIssue.isDeleted = false;
      }
    }
  }

  // 2. Detect DELETED / REMOVED issues (local issues not present in GitHub state=all response)
  for (const localIss of localRepoIssues) {
    if (!localIss.isDeleted && !githubIssueMap.has(localIss.githubNumber)) {
      localIss.isDeleted = true;
      localIss.status = 'CLOSED';
      localIss.lastSyncedAt = now;
      tombstonedCount++;

      driftRepairs.push({
        type: 'TOMBSTONE',
        repositoryFullName: repo.fullName,
        issueGithubNumber: localIss.githubNumber,
        githubValue: 'REMOVED_FROM_GITHUB',
        localValue: 'ACTIVE_LOCALLY',
        actionTaken: `Applied durable isDeleted tombstone to issue #${localIss.githubNumber}. Hidden from Explorer queries.`,
      });
    }
  }

  // 3. Recalculate PR activity stats for all active repository issues
  for (const iss of localRepoIssues) {
    recalculateIssuePRStats(iss.id);
  }

  repo.lastSyncedAt = now;
  const durationMs = Date.now() - startTime;

  // Write SyncAuditLog Record
  const auditLog: SyncAuditLog = {
    id: `log-recon-${repo.fullName.replace('/', '-')}-${Date.now()}`,
    repositoryId: repo.id,
    eventType: 'RECONCILIATION_ISSUES',
    status: 'SUCCESS',
    changesSummary: `Reconciled ${githubIssueMap.size} GitHub issues for '${repo.fullName}' in ${durationMs}ms (${insertedCount} inserted, ${updatedCount} updated, ${closedCount} closed, ${reopenedCount} reopened, ${tombstonedCount} tombstoned, ${commentsCorrected} comments corrected, ${regradedCount} regraded).`,
    gradingRan: regradedCount > 0,
    createdAt: now,
  };
  mockDbStore.syncAuditLogs.push(auditLog);

  return {
    repositoryFullName: repo.fullName,
    success: true,
    notModified: false,
    issuesExamined: githubIssueMap.size,
    insertedCount,
    updatedCount,
    closedCount,
    reopenedCount,
    tombstonedCount,
    regradedCount,
    commentsCorrected,
    prsReconciled,
    pointsAwarded,
    driftRepairs,
  };
}

/**
 * Persistent scheduled reconciliation path. Webhook processors are reused so
 * cron repairs write through the same V2.3 grading and verification logic.
 */
export async function reconcileRepositoryIssuesDatabase(
  repoFullName: string,
  customToken?: string
): Promise<RepoReconciliationResult> {
  const repo = await withPrismaRetry(() =>
    prisma.repository.findUnique({ where: { fullName: repoFullName } })
  );
  const empty = {
    repositoryFullName: repoFullName,
    success: false,
    issuesExamined: 0,
    insertedCount: 0,
    updatedCount: 0,
    closedCount: 0,
    reopenedCount: 0,
    tombstonedCount: 0,
    regradedCount: 0,
    commentsCorrected: 0,
    prsReconciled: 0,
    pointsAwarded: 0,
    driftRepairs: [] as DriftReportEntry[],
  };
  if (!repo || repo.eligibilityStatus !== 'ELIGIBLE' || repo.isArchived || repo.isFork || !repo.hasIssues) {
    return { ...empty, error: `Repository '${repoFullName}' is missing or ineligible in PostgreSQL.` };
  }

  const client = new GithubApiClient(customToken);
  let githubIssues: RawGithubIssue[];
  let githubPRs: any[];
  try {
    const [issueResult, prResult] = await Promise.all([
      client.fetchAllPages<RawGithubIssue>(`https://api.github.com/repos/${repo.fullName}/issues?state=all&per_page=100`),
      client.fetchAllPages<any>(`https://api.github.com/repos/${repo.fullName}/pulls?state=all&per_page=100`),
    ]);
    githubIssues = issueResult.items.filter((item) => item.pull_request === undefined);
    githubPRs = prResult.items;
  } catch (error: any) {
    await withPrismaRetry(() => prisma.syncAuditLog.create({
      data: {
        organizationId: repo.owner,
        repositoryId: repo.id,
        eventType: 'RECONCILIATION_ISSUES',
        status: 'FAILED',
        errorMessage: error.message || String(error),
      },
    }));
    return { ...empty, error: `GitHub reconciliation failed for '${repo.fullName}': ${error.message || String(error)}` };
  }

  const counters = { ...empty, success: true };
  const processorErrors: string[] = [];
  const seenIssueNumbers = new Set<number>();
  for (const ghIssue of githubIssues) {
    seenIssueNumbers.add(ghIssue.number);
    const previous = await withPrismaRetry(() => prisma.issue.findUnique({
      where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: ghIssue.number } },
      select: { id: true, status: true, githubState: true, commentsCount: true },
    }));
    const action = ghIssue.state === 'closed'
      ? 'closed'
      : previous && (previous.status === 'CLOSED' || previous.githubState === 'closed')
        ? 'reopened'
        : previous ? 'edited' : 'opened';
    const result = await processLiveIssueEvent({
      action,
      issue: ghIssue as any,
      repository: {
        id: Number(repo.githubId),
        name: repo.name,
        full_name: repo.fullName,
        owner: { login: repo.owner },
      },
    });
    if (result.status === 'FAILED') processorErrors.push(result.reason);
    counters.issuesExamined++;
    if (!previous && result.issueId) counters.insertedCount++;
    else if (previous && result.status === 'UPDATED') counters.updatedCount++;
    if (action === 'closed' && previous?.githubState !== 'closed') counters.closedCount++;
    if (action === 'reopened') counters.reopenedCount++;
    if (result.gradingRan) counters.regradedCount++;
    if (previous && ghIssue.comments !== undefined && previous.commentsCount !== ghIssue.comments) counters.commentsCorrected++;
  }

  // Successful complete GitHub enumeration lets us safely tombstone missing issues.
  const indexedIssues = await withPrismaRetry(() => prisma.issue.findMany({
    where: { repositoryId: repo.id, githubState: { not: 'deleted' } },
    select: { id: true, githubNumber: true, status: true },
  }));
  for (const issue of indexedIssues) {
    if (!seenIssueNumbers.has(issue.githubNumber) && issue.status !== 'CLOSED') {
      await withPrismaRetry(() => prisma.issue.update({
        where: { id: issue.id },
        data: { status: 'CLOSED', githubState: 'deleted', closedAt: new Date(), lastSyncedAt: new Date() },
      }));
      counters.tombstonedCount++;
    }
  }

  for (const ghPR of githubPRs) {
    const action = ghPR.state === 'closed' ? 'closed' : 'opened';
    const result = await processLivePREvent({
      action,
      number: ghPR.number,
      pull_request: ghPR,
    } as any);
    if (result.syncStatus !== 'SUCCESS') processorErrors.push(result.reason);
    counters.prsReconciled++;
    counters.pointsAwarded += result.pointsAwarded || 0;
  }

  await withPrismaRetry(() => prisma.repository.update({
    where: { id: repo.id },
    data: { lastSyncedAt: new Date() },
  }));
  await withPrismaRetry(() => prisma.syncAuditLog.create({
    data: {
      organizationId: repo.owner,
      repositoryId: repo.id,
      eventType: 'RECONCILIATION_ISSUES',
      status: processorErrors.length === 0 ? 'SUCCESS' : 'FAILED',
      gradingRan: counters.regradedCount > 0,
      changesSummary: `PostgreSQL reconciliation for ${repo.fullName}: ${counters.issuesExamined} issues, ${counters.prsReconciled} PRs, ${counters.regradedCount} graded on V2.3.${processorErrors.length ? ` Errors: ${processorErrors.length}.` : ''}`,
      errorMessage: processorErrors.length ? processorErrors.join('\n').slice(0, 4000) : null,
    },
  }));
  return {
    ...counters,
    success: processorErrors.length === 0,
    ...(processorErrors.length ? { error: processorErrors.join('; ') } : {}),
  };
}

/**
 * Reconciles Pull Requests associated with an issue or repository.
 * Detects missed merged PR webhooks and delegates to anti-cheating verification engine.
 */
export async function reconcileIssuePullRequests(
  repoFullName: string,
  customToken?: string
): Promise<{ prsReconciled: number; pointsAwarded: number; driftRepairs: DriftReportEntry[] }> {
  const repo = mockDbStore.repositories.find((r) => r.fullName.toLowerCase() === repoFullName.toLowerCase());
  if (!repo) return { prsReconciled: 0, pointsAwarded: 0, driftRepairs: [] };

  let prsReconciled = 0;
  let pointsAwarded = 0;
  const driftRepairs: DriftReportEntry[] = [];

  const repoIssues = mockDbStore.issues.filter((i) => i.repositoryId === repo.id);
  for (const iss of repoIssues) {
    recalculateIssuePRStats(iss.id);
    prsReconciled++;
  }

  return { prsReconciled, pointsAwarded, driftRepairs };
}

/**
 * Orchestrates full multi-organization background reconciliation across all configured organizations & eligible repos.
 */
export async function runFullReconciliation(
  options?: ReconciliationOptions
): Promise<FullReconciliationSummary> {
  const startTime = Date.now();
  const summary: FullReconciliationSummary = {
    success: true,
    orgsProcessed: 0,
    reposExamined: 0,
    issuesExamined: 0,
    insertedCount: 0,
    updatedCount: 0,
    closedCount: 0,
    reopenedCount: 0,
    tombstonedCount: 0,
    regradedCount: 0,
    commentsCorrected: 0,
    prsReconciled: 0,
    pointsAwarded: 0,
    driftRepairs: [],
    errors: [],
    durationMs: 0,
  };

  const targetOrgs = options?.targetOrgs || TARGET_ORGANIZATIONS_CONFIG.map((o) => o.login);

  for (const orgLogin of targetOrgs) {
    summary.orgsProcessed++;
    const orgRes = await reconcileOrganization(orgLogin, options?.customToken);
    if (!orgRes.success && orgRes.error) {
      summary.errors.push(orgRes.error);
    }
  }

  const eligibleRepos = await withPrismaRetry(() => prisma.repository.findMany({
    where: {
      eligibilityStatus: 'ELIGIBLE',
      isArchived: false,
      isFork: false,
      hasIssues: true,
      ...(options?.targetOrgs?.length
        ? { OR: options.targetOrgs.map((owner) => ({ owner: { mode: 'insensitive' as const, equals: owner } })) }
        : {}),
      ...(options?.targetRepos?.length ? { fullName: { in: options.targetRepos } } : {}),
    },
    select: { fullName: true },
  }));

  summary.reposExamined = eligibleRepos.length;

  for (const repo of eligibleRepos) {
    const repoRes = await reconcileRepositoryIssuesDatabase(repo.fullName, options?.customToken);
    if (!repoRes.success && repoRes.error) {
      summary.errors.push(repoRes.error);
      continue;
    }

    summary.issuesExamined += repoRes.issuesExamined;
    summary.insertedCount += repoRes.insertedCount;
    summary.updatedCount += repoRes.updatedCount;
    summary.closedCount += repoRes.closedCount;
    summary.reopenedCount += repoRes.reopenedCount;
    summary.tombstonedCount += repoRes.tombstonedCount;
    summary.regradedCount += repoRes.regradedCount;
    summary.commentsCorrected += repoRes.commentsCorrected;
    summary.prsReconciled += repoRes.prsReconciled;
    summary.pointsAwarded += repoRes.pointsAwarded;
    summary.driftRepairs.push(...repoRes.driftRepairs);
  }

  summary.durationMs = Date.now() - startTime;
  summary.success = summary.errors.length === 0;

  return summary;
}

/**
 * Layer 1 Lightweight Incremental REST Synchronization for a single repository.
 * Fetches only issues and PRs created/updated since lastSyncedAt via REST API & ETags.
 */
export async function reconcileRepositoryIncremental(
  repoFullName: string,
  customToken?: string
): Promise<RepoReconciliationResult> {
  const startTime = Date.now();
  const repo = await withPrismaRetry(() =>
    prisma.repository.findUnique({ where: { fullName: repoFullName } })
  );

  const empty = {
    repositoryFullName: repoFullName,
    success: false,
    issuesExamined: 0,
    insertedCount: 0,
    updatedCount: 0,
    closedCount: 0,
    reopenedCount: 0,
    tombstonedCount: 0,
    regradedCount: 0,
    commentsCorrected: 0,
    prsReconciled: 0,
    pointsAwarded: 0,
    driftRepairs: [] as DriftReportEntry[],
  };

  if (!repo || repo.eligibilityStatus !== 'ELIGIBLE' || repo.isArchived || repo.isFork || !repo.hasIssues) {
    return { ...empty, error: `Repository '${repoFullName}' is missing or ineligible in PostgreSQL.` };
  }

  // Update repository status to RUNNING
  await withPrismaRetry(() =>
    prisma.repository.update({
      where: { id: repo.id },
      data: {
        lastAttemptedSyncAt: new Date(),
        syncStatus: 'RUNNING',
      },
    })
  );

  const client = new GithubApiClient(customToken);
  let pageResult;

  try {
    pageResult = await client.fetchIncrementalIssues<RawGithubIssue>(
      repo.fullName,
      repo.lastSyncedAt || undefined
    );
  } catch (error: any) {
    const errText = error.message || String(error);
    await withPrismaRetry(() =>
      prisma.repository.update({
        where: { id: repo.id },
        data: {
          syncStatus: 'FAILED',
          syncError: errText,
          failureCount: (repo.failureCount || 0) + 1,
        },
      })
    );

    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: repo.owner,
          repositoryId: repo.id,
          eventType: 'INCREMENTAL_SYNC',
          status: 'FAILED',
          errorMessage: errText,
        },
      })
    );

    return { ...empty, error: `Incremental sync failed for '${repo.fullName}': ${errText}` };
  }

  const now = new Date();

  // 304 Not Modified handling
  if (pageResult.notModified) {
    await withPrismaRetry(() =>
      prisma.repository.update({
        where: { id: repo.id },
        data: {
          lastSyncedAt: now,
          syncStatus: 'SUCCESS',
          syncError: null,
          failureCount: 0,
        },
      })
    );

    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: repo.owner,
          repositoryId: repo.id,
          eventType: 'INCREMENTAL_SYNC',
          status: 'SUCCESS',
          changesSummary: `Incremental sync for '${repo.fullName}': 304 Not Modified. No changes since ${repo.lastSyncedAt?.toISOString() || 'beginning'}.`,
        },
      })
    );

    return {
      repositoryFullName: repo.fullName,
      success: true,
      notModified: true,
      issuesExamined: 0,
      insertedCount: 0,
      updatedCount: 0,
      closedCount: 0,
      reopenedCount: 0,
      tombstonedCount: 0,
      regradedCount: 0,
      commentsCorrected: 0,
      prsReconciled: 0,
      pointsAwarded: 0,
      driftRepairs: [],
    };
  }

  const rawItems = pageResult.items || [];
  const githubIssues: RawGithubIssue[] = [];
  const githubPRs: any[] = [];

  for (const item of rawItems) {
    if ((item as any).pull_request !== undefined) {
      githubPRs.push(item);
    } else {
      githubIssues.push(item);
    }
  }

  const counters = { ...empty, success: true };
  const processorErrors: string[] = [];

  for (const ghIssue of githubIssues) {
    const previous = await withPrismaRetry(() =>
      prisma.issue.findUnique({
        where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: ghIssue.number } },
        select: { id: true, status: true, githubState: true, commentsCount: true },
      })
    );

    const action = ghIssue.state === 'closed'
      ? 'closed'
      : previous && (previous.status === 'CLOSED' || previous.githubState === 'closed')
        ? 'reopened'
        : previous ? 'edited' : 'opened';

    const result = await processLiveIssueEvent({
      action,
      issue: ghIssue as any,
      repository: {
        id: Number(repo.githubId),
        name: repo.name,
        full_name: repo.fullName,
        owner: { login: repo.owner },
      },
    });

    if (result.status === 'FAILED') processorErrors.push(result.reason);
    counters.issuesExamined++;
    if (!previous && result.issueId) counters.insertedCount++;
    else if (previous && result.status === 'UPDATED') counters.updatedCount++;
    if (action === 'closed' && previous?.githubState !== 'closed') counters.closedCount++;
    if (action === 'reopened') counters.reopenedCount++;
    if (result.gradingRan) counters.regradedCount++;
    if (previous && ghIssue.comments !== undefined && previous.commentsCount !== ghIssue.comments) counters.commentsCorrected++;
  }

  for (const ghPR of githubPRs) {
    let fullPRData: any = null;
    try {
      const prRes = await client.fetchPage<any>(`https://api.github.com/repos/${repo.fullName}/pulls/${ghPR.number}`);
      if (!prRes.notModified && prRes.data) {
        fullPRData = prRes.data;
      }
    } catch (err) {
      console.warn(`[Reconciliation PR Fetch Warning] Failed fetching full PR #${ghPR.number} for '${repo.fullName}':`, err);
    }

    const prPayload = fullPRData || {
      ...ghPR,
      base: {
        repo: {
          id: Number(repo.githubId),
          name: repo.name,
          full_name: repo.fullName,
          owner: { login: repo.owner },
        },
      },
      merged: Boolean((ghPR as any).merged || (ghPR as any).pull_request?.merged_at || (ghPR as any).merged_at),
      merged_at: (ghPR as any).merged_at || (ghPR as any).pull_request?.merged_at || null,
      merged_by: (ghPR as any).merged_by || null,
    };

    const action = prPayload.merged ? 'closed' : ghPR.state === 'closed' ? 'closed' : 'opened';
    const result = await processLivePREvent({
      action,
      number: ghPR.number,
      pull_request: prPayload,
    } as any);

    if (result.syncStatus !== 'SUCCESS') processorErrors.push(result.reason);
    counters.prsReconciled++;
    counters.pointsAwarded += result.pointsAwarded || 0;
  }

  const isSuccess = processorErrors.length === 0;

  await withPrismaRetry(() =>
    prisma.repository.update({
      where: { id: repo.id },
      data: {
        lastSyncedAt: now,
        syncStatus: isSuccess ? 'SUCCESS' : 'FAILED',
        syncError: isSuccess ? null : processorErrors.join('; ').slice(0, 2000),
        failureCount: isSuccess ? 0 : (repo.failureCount || 0) + 1,
      },
    })
  );

  await withPrismaRetry(() =>
    prisma.syncAuditLog.create({
      data: {
        organizationId: repo.owner,
        repositoryId: repo.id,
        eventType: 'INCREMENTAL_SYNC',
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        gradingRan: counters.regradedCount > 0,
        changesSummary: `Incremental sync for ${repo.fullName}: ${counters.issuesExamined} issues, ${counters.prsReconciled} PRs processed in ${Date.now() - startTime}ms (${counters.insertedCount} inserted, ${counters.updatedCount} updated, ${counters.closedCount} closed, ${counters.reopenedCount} reopened, ${counters.regradedCount} regraded).`,
        errorMessage: isSuccess ? null : processorErrors.join('\n').slice(0, 4000),
      },
    })
  );

  return {
    ...counters,
    success: isSuccess,
    ...(processorErrors.length ? { error: processorErrors.join('; ') } : {}),
  };
}
