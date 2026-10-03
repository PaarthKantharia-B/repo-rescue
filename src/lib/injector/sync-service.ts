import { prisma, withPrismaRetry } from '@/lib/prisma';
import { PRStatus } from '@prisma/client';
import { Issue, Repository } from '@/types';
import { getTargetOrganizationLogins } from '../organizations/config';
import { evaluateV2FactorsWithEvidence } from '../issues/ingestion';
import { calculateRRDifficultyV2, SCORING_VERSION_V2_3_1 } from '../scoring';
import { extractLinkedIssueNumbers, verifyAndAwardContribution, VerificationResult, GitHubPRPayload } from '../contributions/verify';

const PROCESSED_DELIVERY_IDS = new Set<string>();

export function isDeliveryProcessed(deliveryId: string): boolean {
  return PROCESSED_DELIVERY_IDS.has(deliveryId);
}

export function markDeliveryProcessed(deliveryId: string): void {
  PROCESSED_DELIVERY_IDS.add(deliveryId);
}

export function clearDeliveryCache(): void {
  PROCESSED_DELIVERY_IDS.clear();
}

/**
 * Persistent DB-backed delivery idempotency checker.
 */
export async function checkAndMarkDeliveryProcessed(
  deliveryId: string,
  eventType: string,
  action?: string
): Promise<boolean> {
  if (PROCESSED_DELIVERY_IDS.has(deliveryId)) {
    return true;
  }

  try {
    const existing = await withPrismaRetry(() =>
      prisma.webhookDelivery.findUnique({
        where: { deliveryId },
      })
    );

    if (existing) {
      PROCESSED_DELIVERY_IDS.add(deliveryId);
      return true;
    }

    await withPrismaRetry(() =>
      prisma.webhookDelivery.create({
        data: {
          deliveryId,
          eventType,
          action: action || null,
        },
      })
    );

    PROCESSED_DELIVERY_IDS.add(deliveryId);
    return false;
  } catch (err: any) {
    if (err.code === 'P2002') {
      PROCESSED_DELIVERY_IDS.add(deliveryId);
      return true;
    }
    return false;
  }
}

export interface SyncValidationResult {
  isValid: boolean;
  reason?: string;
  repo?: Repository;
  orgLogin?: string;
}

/**
 * Validates that an incoming event repository belongs to one of the 10 configured target organizations
 * and exists in Repo Rescue's PostgreSQL database.
 */
export async function validateEventRepository(
  repoFullName: string,
  repoGithubId?: number
): Promise<SyncValidationResult> {
  if (!repoFullName) {
    return { isValid: false, reason: 'Missing repository full_name in payload.' };
  }

  const parts = repoFullName.split('/');
  if (parts.length !== 2) {
    return { isValid: false, reason: `Invalid repository full_name format '${repoFullName}'.` };
  }

  const ownerLogin = parts[0].toLowerCase();
  const configuredOrgs = getTargetOrganizationLogins().map((o) => o.toLowerCase());

  if (!configuredOrgs.includes(ownerLogin)) {
    return {
      isValid: false,
      reason: `Organization '${parts[0]}' is not in configured target organizations list.`,
    };
  }

  const dbRepo = await withPrismaRetry(() =>
    prisma.repository.findFirst({
      where: {
        OR: [
          ...(repoGithubId ? [{ githubId: BigInt(repoGithubId) }] : []),
          { fullName: { mode: 'insensitive', equals: repoFullName } },
        ],
      },
    })
  );

  if (!dbRepo) {
    return {
      isValid: false,
      reason: `Repository '${repoFullName}' is not registered in Repo Rescue store.`,
    };
  }

  const formattedRepo: Repository = {
    id: dbRepo.id,
    githubId: Number(dbRepo.githubId),
    name: dbRepo.name,
    fullName: dbRepo.fullName,
    owner: dbRepo.owner,
    description: dbRepo.description || '',
    url: dbRepo.url,
    language: dbRepo.language || 'TypeScript',
    starsCount: dbRepo.starsCount,
    forksCount: dbRepo.forksCount,
    openIssuesCount: dbRepo.openIssuesCount,
    ecosystem: dbRepo.ecosystem || 'Node.js',
    repoType: dbRepo.repoType || 'INFRA',
    maintainerActivityScore: dbRepo.maintainerActivityScore ?? 5.0,
  };

  return { isValid: true, repo: formattedRepo, orgLogin: dbRepo.owner };
}

export interface WebhookIssuePayload {
  action: string; // opened, edited, closed, reopened, labeled, unlabeled, deleted
  issue: {
    id: number;
    number: number;
    title: string;
    body?: string | null;
    state: string; // 'open' | 'closed'
    labels?: Array<{ name: string } | string>;
    assignee?: { login: string } | null;
    assignees?: Array<{ login: string } | string>;
    user?: { login: string } | null;
    comments?: number;
    created_at?: string;
    updated_at?: string;
    closed_at?: string | null;
    pull_request?: any;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export interface WebhookCommentPayload {
  action: string; // created, edited, deleted
  issue?: {
    id: number;
    number: number;
  };
  comment: {
    id: number;
    body: string;
    user?: { login: string } | null;
    created_at?: string;
    updated_at?: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export interface SyncOperationResult {
  status: 'SUCCESS' | 'UPDATED' | 'IGNORED' | 'ALREADY_PROCESSED' | 'FAILED';
  issueId?: string;
  prId?: string;
  gradingRan?: boolean;
  gradingScore?: number;
  reason: string;
}

/**
 * Gets or creates a fallback ghost user in PostgreSQL for PR author references.
 */
async function getGhostUserId(): Promise<string> {
  const ghost = await withPrismaRetry(() =>
    prisma.user.upsert({
      where: { githubUsername: 'ghost' },
      create: {
        githubUsername: 'ghost',
        name: 'GitHub Ghost',
        role: 'CONTRIBUTOR',
      },
      update: {},
    })
  );
  return ghost.id;
}

/**
 * Single authoritative event normalizer and live issue sync processor backed by PostgreSQL.
 * Used by webhooks and scheduled reconciliation.
 */
export async function processLiveIssueEvent(
  payload: WebhookIssuePayload,
  deliveryId?: string
): Promise<SyncOperationResult> {
  const action = payload.action;
  const ghIssue = payload.issue;
  const repoFullName = payload.repository?.full_name;
  const now = new Date();

  // 1. Check Webhook Delivery Idempotency in PostgreSQL
  if (deliveryId) {
    const isDup = await checkAndMarkDeliveryProcessed(deliveryId, `issues.${action}`, action);
    if (isDup) {
      await withPrismaRetry(() =>
        prisma.syncAuditLog.create({
          data: {
            organizationId: payload.repository?.owner?.login,
            repositoryId: repoFullName,
            issueId: `iss-${ghIssue?.number}`,
            eventType: `issues.${action}`,
            status: 'SKIPPED',
            changesSummary: `Duplicate delivery ID '${deliveryId}' skipped.`,
          },
        })
      );

      return {
        status: 'ALREADY_PROCESSED',
        reason: `Duplicate delivery ID '${deliveryId}' skipped.`,
      };
    }
  }

  // 2. Validate Repository and Organization in PostgreSQL
  const validation = await validateEventRepository(repoFullName, payload.repository?.id);
  if (!validation.isValid || !validation.repo) {
    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: payload.repository?.owner?.login,
          repositoryId: repoFullName,
          eventType: `issues.${action}`,
          status: 'SKIPPED',
          changesSummary: validation.reason,
        },
      })
    );

    return {
      status: 'IGNORED',
      reason: validation.reason || 'Invalid repository or organization.',
    };
  }

  const repo = validation.repo;

  // 3. Ignore PR payloads sent through issues webhook
  if (ghIssue.pull_request !== undefined) {
    return {
      status: 'IGNORED',
      reason: 'Pull Request object ignored on issue event handler.',
    };
  }

  try {
    // 4. Identity Resolution in PostgreSQL: (repositoryId, githubNumber)
    const existingIssue = await withPrismaRetry(() =>
      prisma.issue.findFirst({
        where: {
          repositoryId: repo.id,
          githubNumber: ghIssue.number,
        },
        include: { scores: true },
      })
    );

    const rawLabels = Array.isArray(ghIssue.labels)
      ? ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
      : existingIssue?.labels || [];

    const rawAssignees = Array.isArray((ghIssue as any).assignees)
      ? (ghIssue as any).assignees.map((a: any) => (typeof a === 'string' ? a : a.login)).filter(Boolean)
      : (ghIssue as any).assignee?.login
        ? [(ghIssue as any).assignee.login]
        : existingIssue?.assignees || [];
    const assigneeCount = rawAssignees.length;

    const incomingTitle = ghIssue.title || existingIssue?.title || '';
    const incomingBody = ghIssue.body !== undefined ? (ghIssue.body || '') : (existingIssue?.body || '');
    const isDeleted = action === 'deleted';
    const incomingStatus: 'OPEN' | 'CLOSED' = isDeleted || action === 'closed' || ghIssue.state === 'closed' ? 'CLOSED' : 'OPEN';

    // 5. Check if fields changed and if re-grading is required
    const titleChanged = existingIssue ? existingIssue.title !== incomingTitle : true;
    const bodyChanged = existingIssue ? (existingIssue.body || '') !== incomingBody : true;
    const sortedExistingLabels = [...(existingIssue?.labels || [])].sort();
    const sortedIncomingLabels = [...rawLabels].sort();
    const labelsChanged = existingIssue ? JSON.stringify(sortedExistingLabels) !== JSON.stringify(sortedIncomingLabels) : true;
    const needsRegrading = !isDeleted && (
      !existingIssue ||
      action === 'reopened' ||
      titleChanged ||
      bodyChanged ||
      labelsChanged ||
      existingIssue.scores?.scoringVersion !== SCORING_VERSION_V2_3_1
    );

    let rrDifficulty = existingIssue ? existingIssue.rrDifficulty : 0.0;
    let gradingRan = false;

    // Run authoritative RR V2.3.0 Evidence Accumulation Engine when needed
    let evaluationResult: ReturnType<typeof evaluateV2FactorsWithEvidence> | null = null;
    if (needsRegrading) {
      evaluationResult = evaluateV2FactorsWithEvidence({
        title: incomingTitle,
        body: incomingBody,
        labels: rawLabels,
        repoName: repo.name,
        repoStars: repo.starsCount,
        repoType: repo.repoType,
      });

      rrDifficulty = evaluationResult.compositeScore;
      gradingRan = true;
    }

    // 6. Upsert Issue in PostgreSQL
    const upsertedIssue = await withPrismaRetry(() =>
      prisma.issue.upsert({
        where: {
          repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: ghIssue.number },
        },
        create: {
          githubId: BigInt(ghIssue.id),
          githubNumber: ghIssue.number,
          repositoryId: repo.id,
          title: incomingTitle,
          body: incomingBody,
          url: ghIssue.title ? `https://github.com/${repo.fullName}/issues/${ghIssue.number}` : (existingIssue?.url || ''),
          status: incomingStatus,
          labels: rawLabels,
          assignees: rawAssignees,
          assigneeCount,
          language: repo.language || 'TypeScript',
          ecosystem: repo.ecosystem || 'Node.js',
          authorUsername: ghIssue.user?.login || existingIssue?.authorUsername || 'ghost',
          rrDifficulty,
          githubState: ghIssue.state || 'open',
          githubStateUpdatedAt: ghIssue.updated_at ? new Date(ghIssue.updated_at) : now,
          lastSyncedAt: now,
          commentsCount: ghIssue.comments ?? 0,
          createdAt: ghIssue.created_at ? new Date(ghIssue.created_at) : now,
          closedAt: incomingStatus === 'CLOSED' ? (ghIssue.closed_at ? new Date(ghIssue.closed_at) : now) : null,
        },
        update: {
          title: incomingTitle,
          body: incomingBody,
          status: incomingStatus,
          labels: rawLabels,
          assignees: rawAssignees,
          assigneeCount,
          rrDifficulty,
          githubState: ghIssue.state || 'open',
          githubStateUpdatedAt: ghIssue.updated_at ? new Date(ghIssue.updated_at) : now,
          lastSyncedAt: now,
          closedAt: incomingStatus === 'CLOSED' ? (ghIssue.closed_at ? new Date(ghIssue.closed_at) : now) : null,
          ...(ghIssue.comments !== undefined ? { commentsCount: ghIssue.comments } : {}),
        },
      })
    );

    // 7. Upsert IssueScore in PostgreSQL if regraded
    if (needsRegrading && evaluationResult) {
      await withPrismaRetry(() =>
        prisma.issueScore.upsert({
          where: { issueId: upsertedIssue.id },
          create: {
            issueId: upsertedIssue.id,
            scoringVersion: SCORING_VERSION_V2_3_1,
            calculatedAt: now,
            technicalDifficulty: evaluationResult!.factors.technicalComplexity,
            codebaseComplexity: evaluationResult!.factors.changeScope,
            issueScope: evaluationResult!.factors.domainSpecialization,
            domainKnowledge: evaluationResult!.factors.testingVerificationEffort,
            expectedImpact: evaluationResult!.factors.problemAmbiguity,
            testingComplexity: evaluationResult!.factors.testingVerificationEffort,
            issueClarity: evaluationResult!.factors.problemAmbiguity,
            maintainerActivity: 5.0,
            compositeScore: rrDifficulty,
            reasoning: evaluationResult!.overallReasoning,
          },
          update: {
            scoringVersion: SCORING_VERSION_V2_3_1,
            calculatedAt: now,
            technicalDifficulty: evaluationResult!.factors.technicalComplexity,
            codebaseComplexity: evaluationResult!.factors.changeScope,
            issueScope: evaluationResult!.factors.domainSpecialization,
            domainKnowledge: evaluationResult!.factors.testingVerificationEffort,
            expectedImpact: evaluationResult!.factors.problemAmbiguity,
            testingComplexity: evaluationResult!.factors.testingVerificationEffort,
            issueClarity: evaluationResult!.factors.problemAmbiguity,
            maintainerActivity: 5.0,
            compositeScore: rrDifficulty,
            reasoning: evaluationResult!.overallReasoning,
          },
        })
      );
    }

    // 8. Recalculate open PR count in PostgreSQL
    const activeOpenPrCount = await withPrismaRetry(() =>
      prisma.pullRequest.count({
        where: { issueId: upsertedIssue.id, status: 'OPEN' },
      })
    );

    await withPrismaRetry(() =>
      prisma.issue.update({
        where: { id: upsertedIssue.id },
        data: { openPrCount: activeOpenPrCount },
      })
    );

    // 9. Write SyncAuditLog in PostgreSQL
    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: repo.owner,
          repositoryId: repo.id,
          issueId: upsertedIssue.id,
          eventType: `issues.${action}`,
          status: 'SUCCESS',
          gradingRan,
          gradingScore: rrDifficulty,
          changesSummary: `Processed issues.${action} for ${repo.fullName}#${ghIssue.number} (Status: ${incomingStatus}, Graded: ${gradingRan}).`,
        },
      })
    );

    return {
      status: existingIssue ? 'UPDATED' : 'SUCCESS',
      issueId: upsertedIssue.id,
      gradingRan,
      gradingScore: rrDifficulty,
      reason: `Processed issues.${action} for ${repo.fullName}#${ghIssue.number}.`,
    };
  } catch (err: any) {
    const errText = `Failed processing issue event: ${err.message || String(err)}`;
    console.warn(`[SyncService Issue Error] ${errText}`);

    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: repo.owner,
          repositoryId: repo.id,
          eventType: `issues.${action}`,
          status: 'FAILED',
          errorMessage: errText,
        },
      })
    );

    return {
      status: 'FAILED',
      reason: errText,
    };
  }
}

/**
 * Handles Live Pull Request events with full idempotency and anti-cheating contribution verification backed by PostgreSQL.
 */
export async function processLivePREvent(
  payload: GitHubPRPayload,
  deliveryId?: string
): Promise<VerificationResult & { syncStatus?: string }> {
  const action = payload.action;
  const pr = payload.pull_request;
  const repoFullName = pr.base?.repo?.full_name || (pr as any).repository?.full_name || (payload as any).repository?.full_name;
  const now = new Date();

  // 1. Delivery Idempotency Check in PostgreSQL
  if (deliveryId) {
    const isDup = await checkAndMarkDeliveryProcessed(deliveryId, `pull_request.${action}`, action);
    if (isDup) {
      return {
        status: 'ALREADY_PROCESSED',
        pointsAwarded: 0,
        syncStatus: 'ALREADY_PROCESSED',
        reason: `Duplicate PR webhook delivery '${deliveryId}' skipped.`,
      };
    }
  }

  // 2. Validate Repository and Organization in PostgreSQL
  const repoGithubId = pr.base?.repo?.id || (pr as any).repository?.id || (payload as any).repository?.id;
  const validation = await validateEventRepository(repoFullName, repoGithubId);
  if (!validation.isValid || !validation.repo) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      syncStatus: 'IGNORED',
      reason: validation.reason || 'Unindexed repository for PR event.',
    };
  }

  const repo = validation.repo;
  const linkedNums = extractLinkedIssueNumbers(pr.title, pr.body || '');

  const matchedIssue = await withPrismaRetry(() =>
    prisma.issue.findFirst({
      where: {
        repositoryId: repo.id,
        githubNumber: { in: linkedNums },
      },
    })
  );

  // 3. User Resolution in PostgreSQL
  const prAuthorLogin = pr.user?.login || (pr as any).user_login || 'ghost';
  const prUser = await withPrismaRetry(() =>
    prisma.user.findFirst({
      where: { githubUsername: { mode: 'insensitive', equals: prAuthorLogin } },
    })
  );
  const userId = prUser ? prUser.id : await getGhostUserId();

  // 4. Upsert PullRequest in PostgreSQL
  const isMerged = Boolean(pr.merged || pr.merged_at || (pr as any).pull_request?.merged_at);
  const mergedAtDate = pr.merged_at
    ? new Date(pr.merged_at)
    : (pr as any).pull_request?.merged_at
      ? new Date((pr as any).pull_request.merged_at)
      : null;

  const prStatus: PRStatus = isMerged ? 'MERGED' : action === 'closed' ? 'CLOSED' : 'OPEN';
  const githubState = isMerged ? 'closed' : action === 'closed' ? 'closed' : 'open';

  const upsertedPR = await withPrismaRetry(() =>
    prisma.pullRequest.upsert({
      where: { githubId: BigInt(pr.id) },
      create: {
        id: `pr-${pr.id}`,
        githubId: BigInt(pr.id),
        githubNumber: pr.number,
        repositoryId: repo.id,
        userId,
        issueId: matchedIssue ? matchedIssue.id : null,
        title: pr.title,
        url: `https://github.com/${repo.fullName}/pull/${pr.number}`,
        status: prStatus,
        githubState,
        isMerged,
        openedAt: now,
        latestActivityAt: now,
        lastSyncedAt: now,
        closedAt: action === 'closed' ? now : null,
        mergedAt: mergedAtDate,
        mergedBy: pr.merged_by?.login || null,
      },
      update: {
        title: pr.title,
        status: prStatus,
        githubState,
        isMerged,
        latestActivityAt: now,
        lastSyncedAt: now,
        closedAt: action === 'closed' ? now : undefined,
        mergedAt: mergedAtDate || undefined,
        mergedBy: pr.merged_by?.login || undefined,
        ...(matchedIssue ? { issueId: matchedIssue.id } : {}),
      },
    })
  );

  // 5. Recalculate openPrCount for matched issue
  if (matchedIssue) {
    const activeOpenPrCount = await withPrismaRetry(() =>
      prisma.pullRequest.count({
        where: { issueId: matchedIssue.id, status: 'OPEN' },
      })
    );

    await withPrismaRetry(() =>
      prisma.issue.update({
        where: { id: matchedIssue.id },
        data: {
          openPrCount: activeOpenPrCount,
          latestPrActivityAt: now,
        },
      })
    );
  }

  // 6. Write SyncAuditLog in PostgreSQL
  await withPrismaRetry(() =>
    prisma.syncAuditLog.create({
      data: {
        organizationId: repo.owner,
        repositoryId: repo.id,
        issueId: matchedIssue?.id || null,
        eventType: `pull_request.${action}`,
        status: 'SUCCESS',
        changesSummary: `Processed pull_request.${action} for ${repo.fullName}#${pr.number}.`,
      },
    })
  );

  // 7. Delegate merged PRs to Phase 6 anti-cheating verification engine
  if ((action === 'closed' || isMerged) && isMerged && mergedAtDate) {
    const verificationPayload: GitHubPRPayload = {
      action: 'closed',
      number: pr.number,
      pull_request: {
        ...pr,
        merged: true,
        merged_at: mergedAtDate.toISOString(),
        base: pr.base || { repo: { id: Number(repo.githubId), full_name: repo.fullName, name: repo.name, owner: { login: repo.owner } } },
      },
    };
    const result = await verifyAndAwardContribution(verificationPayload);
    return { ...result, syncStatus: 'SUCCESS' };
  }

  return {
    status: action === 'closed' && !pr.merged ? 'REJECTED' : 'PENDING',
    pointsAwarded: 0,
    syncStatus: 'SUCCESS',
    reason: `PR #${pr.number} ${action} synchronized. Points awarded: 0.`,
  };
}

/**
 * Handles Live Comment events and updates issue comment metrics in PostgreSQL.
 */
export async function processLiveCommentEvent(
  payload: WebhookCommentPayload,
  deliveryId?: string
): Promise<SyncOperationResult> {
  const action = payload.action;
  const ghIssue = payload.issue;
  const repoFullName = payload.repository?.full_name;
  const now = new Date();

  if (deliveryId) {
    const isDup = await checkAndMarkDeliveryProcessed(deliveryId, `issue_comment.${action}`, action);
    if (isDup) {
      return { status: 'ALREADY_PROCESSED', reason: 'Duplicate comment delivery skipped.' };
    }
  }

  const validation = await validateEventRepository(repoFullName, payload.repository?.id);
  if (!validation.isValid || !validation.repo || !ghIssue) {
    return { status: 'IGNORED', reason: 'Comment for unindexed repository or missing issue reference.' };
  }

  const repo = validation.repo;
  const issue = await withPrismaRetry(() =>
    prisma.issue.findFirst({
      where: { repositoryId: repo.id, githubNumber: ghIssue.number },
    })
  );

  if (!issue) {
    return { status: 'IGNORED', reason: `Issue #${ghIssue.number} not indexed for comment event.` };
  }

  let commentsCount = (ghIssue as any).comments !== undefined
    ? (ghIssue as any).comments
    : issue.commentsCount ?? 0;

  if ((ghIssue as any).comments === undefined) {
    if (action === 'created') {
      commentsCount += 1;
    } else if (action === 'deleted') {
      commentsCount = Math.max(0, commentsCount - 1);
    }
  }

  await withPrismaRetry(() =>
    prisma.issue.update({
      where: { id: issue.id },
      data: {
        commentsCount,
        latestPrActivityAt: now,
        lastSyncedAt: now,
      },
    })
  );

  await withPrismaRetry(() =>
    prisma.syncAuditLog.create({
      data: {
        organizationId: repo.owner,
        repositoryId: repo.id,
        issueId: issue.id,
        eventType: `issue_comment.${action}`,
        status: 'SUCCESS',
        changesSummary: `Comment ${action} on ${repo.fullName}#${ghIssue.number}. Updated commentsCount to ${commentsCount}.`,
      },
    })
  );

  return {
    status: 'UPDATED',
    issueId: issue.id,
    reason: `Comment ${action} logged for ${repo.fullName}#${ghIssue.number}.`,
  };
}
