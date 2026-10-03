import { prisma, withPrismaRetry } from '@/lib/prisma';
import { ContributionStatus, LedgerTransactionType, PRStatus } from '@prisma/client';
import { calculateRRPointsFromScore } from '../scoring';
import crypto from 'crypto';

export interface GitHubPRPayload {
  action: string; // e.g. 'closed'
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body?: string;
    merged: boolean;
    merged_at?: string | null;
    merged_by?: {
      login: string;
    } | null;
    user: {
      id: number;
      login: string;
    };
    base: {
      repo: {
        id: number;
        name: string;
        full_name: string;
        owner: {
          login: string;
        };
      };
    };
  };
}

export interface VerificationResult {
  status: 'VERIFIED' | 'REJECTED' | 'PENDING' | 'ALREADY_PROCESSED';
  pointsAwarded: number;
  reason: string;
  contributionId?: string;
  ledgerId?: string;
  contributorUsername?: string;
  newBalance?: number;
}

/**
 * Extracts linked issue numbers referenced in PR title or body text.
 * Matches: fixes #123, fixed #123, fix #123, closes #123, closed #123, close #123, resolves #123, resolved #123, resolve #123
 */
export function extractLinkedIssueNumbers(title: string, body = ''): number[] {
  const combined = `${title} ${body}`;
  const regex = /(?:fixes|fixed|fix|closes|closed|close|resolves|resolved|resolve|solves|solved|solve|refs|ref)\s+#(\d+)/gi;
  const matches = new Set<number>();
  let match;

  while ((match = regex.exec(combined)) !== null) {
    if (match[1]) {
      matches.add(parseInt(match[1], 10));
    }
  }

  if (matches.size === 0) {
    const fallbackRegex = /#(\d+)/g;
    while ((match = fallbackRegex.exec(combined)) !== null) {
      if (match[1]) {
        matches.add(parseInt(match[1], 10));
      }
    }
  }

  return Array.from(matches);
}

/**
 * Verifies HMAC-SHA256 signature of incoming GitHub webhook payloads.
 */
export function verifyGitHubWebhookSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSig = signatureHeader.slice(7);
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawPayload).digest('hex');

  if (digest.length !== expectedSig.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expectedSig));
}

/**
 * Main reusable verification engine backed by PostgreSQL.
 * Validates PR merge, repository index, author identity, issue association, maintainer authorization, and idempotency.
 */
export async function verifyAndAwardContribution(payload: GitHubPRPayload): Promise<VerificationResult> {
  const pr = payload.pull_request;
  const action = payload.action;

  // 1. Verify PR is closed AND actually merged
  if (action !== 'closed' || !pr.merged || !pr.merged_at) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: 'PR was closed without being merged.',
    };
  }

  // 2. Repository verification by GitHub repo ID or full_name in PostgreSQL
  const repo = await withPrismaRetry(() =>
    prisma.repository.findFirst({
      where: {
        OR: [
          { githubId: BigInt(pr.base.repo.id) },
          { fullName: { mode: 'insensitive', equals: pr.base.repo.full_name } },
        ],
      },
    })
  );

  if (!repo) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: `Repository '${pr.base.repo.full_name}' is not indexed in Repo Rescue.`,
    };
  }

  // 3. Contributor identity verification (PR author must be registered in PostgreSQL)
  const contributor = await withPrismaRetry(() =>
    prisma.user.findFirst({
      where: {
        githubUsername: { mode: 'insensitive', equals: pr.user.login },
      },
    })
  );

  if (!contributor) {
    return {
      status: 'PENDING',
      pointsAwarded: 0,
      reason: `PR author '@${pr.user.login}' does not have a registered Repo Rescue account. Points pending account registration.`,
    };
  }

  // 4. Issue association resolution (matches closing keywords #123)
  const linkedIssueNums = extractLinkedIssueNumbers(pr.title, pr.body || '');
  if (linkedIssueNums.length === 0) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: 'No valid closing issue reference (e.g. Fixes #123) found in PR title or body.',
    };
  }

  // Find issue belonging strictly to the SAME repository in PostgreSQL
  const matchedIssue = await withPrismaRetry(() =>
    prisma.issue.findFirst({
      where: {
        repositoryId: repo.id,
        githubNumber: { in: linkedIssueNums },
      },
    })
  );

  if (!matchedIssue) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: `Referenced issue #${linkedIssueNums[0]} does not belong to repository '${repo.fullName}' or is not indexed.`,
    };
  }

  // 5. Maintainer verification (PR must be merged by authorized maintainer, not self-merged points farming)
  const mergerUsername = pr.merged_by?.login || 'unknown';
  const isSelfMerged = mergerUsername.toLowerCase() === pr.user.login.toLowerCase();

  if (isSelfMerged) {
    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: `Self-merged PR by author '@${pr.user.login}' rejected to prevent points farming. Merge must be executed by a repository maintainer.`,
    };
  }

  // 6. Idempotency Check in PostgreSQL: Verify if contribution or PR already processed
  const existingPR = await withPrismaRetry(() =>
    prisma.pullRequest.findFirst({
      where: {
        OR: [
          { githubId: BigInt(pr.id) },
          { repositoryId: repo.id, githubNumber: pr.number },
        ],
      },
    })
  );

  const existingContribution = await withPrismaRetry(() =>
    prisma.contribution.findFirst({
      where: {
        OR: [
          { userId: contributor.id, issueId: matchedIssue.id },
          ...(existingPR ? [{ pullRequestId: existingPR.id }] : []),
        ],
      },
    })
  );

  if (existingContribution && existingContribution.status === ContributionStatus.MERGED_AND_AUDITED) {
    return {
      status: 'ALREADY_PROCESSED',
      pointsAwarded: 0,
      reason: `Contribution for issue #${matchedIssue.githubNumber} by @${contributor.githubUsername || pr.user.login} was already verified and awarded points.`,
      contributionId: existingContribution.id,
      contributorUsername: contributor.githubUsername || pr.user.login,
      newBalance: contributor.totalPoints,
    };
  }

  // 7. Calculate Points from stored IssueScore (RR Points = RR Difficulty * 10)
  const rrPoints = calculateRRPointsFromScore(matchedIssue.rrDifficulty);
  const prId = existingPR ? existingPR.id : `pr-${pr.id}`;
  const now = new Date();

  // 8. Execute Atomic Database Transaction in PostgreSQL
  const result = await withPrismaRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      // Upsert PullRequest record
      const upsertedPR = existingPR
        ? await tx.pullRequest.update({
            where: { id: existingPR.id },
            data: {
              status: PRStatus.MERGED,
              githubState: 'closed',
              isMerged: true,
              mergedAt: new Date(pr.merged_at!),
              mergedBy: mergerUsername,
              latestActivityAt: now,
              lastSyncedAt: now,
              issueId: matchedIssue.id,
            },
          })
        : await tx.pullRequest.upsert({
            where: { githubId: BigInt(pr.id) },
            create: {
              id: prId,
              githubId: BigInt(pr.id),
              githubNumber: pr.number,
              repositoryId: repo.id,
              userId: contributor.id,
              issueId: matchedIssue.id,
              title: pr.title,
              url: `https://github.com/${repo.fullName}/pull/${pr.number}`,
              status: PRStatus.MERGED,
              githubState: 'closed',
              isMerged: true,
              openedAt: now,
              closedAt: new Date(pr.merged_at!),
              mergedAt: new Date(pr.merged_at!),
              mergedBy: mergerUsername,
              lastSyncedAt: now,
              latestActivityAt: now,
            },
            update: {
              status: PRStatus.MERGED,
              githubState: 'closed',
              isMerged: true,
              mergedAt: new Date(pr.merged_at!),
              mergedBy: mergerUsername,
              latestActivityAt: now,
              lastSyncedAt: now,
              issueId: matchedIssue.id,
            },
          });

      // Create Contribution
      const contribution = await tx.contribution.upsert({
        where: { userId_issueId: { userId: contributor.id, issueId: matchedIssue.id } },
        create: {
          userId: contributor.id,
          issueId: matchedIssue.id,
          pullRequestId: upsertedPR.id,
          status: ContributionStatus.MERGED_AND_AUDITED,
          rrPoints,
          verifiedAt: now,
        },
        update: {
          pullRequestId: upsertedPR.id,
          status: ContributionStatus.MERGED_AND_AUDITED,
          rrPoints,
          verifiedAt: now,
        },
      });

      // Update User points balance
      const updatedUser = await tx.user.update({
        where: { id: contributor.id },
        data: {
          totalPoints: { increment: rrPoints },
        },
      });

      // Create PointsLedger entry
      const ledgerEntry = await tx.pointsLedger.create({
        data: {
          userId: contributor.id,
          type: LedgerTransactionType.ISSUE_SOLVED,
          amount: rrPoints,
          balanceAfter: updatedUser.totalPoints,
          reason: `Rescued ${repo.fullName}#${matchedIssue.githubNumber} via PR #${pr.number} (${matchedIssue.rrDifficulty.toFixed(1)} RR Difficulty × 10)`,
          contributionId: contribution.id,
          createdAt: now,
        },
      });

      // Update Issue status to RESOLVED
      await tx.issue.update({
        where: { id: matchedIssue.id },
        data: {
          status: 'RESOLVED',
          mergedPrCount: { increment: 1 },
          latestPrActivityAt: now,
          lastSyncedAt: now,
        },
      });

      // Recalculate active open PRs count on Issue
      const activeOpenPrCount = await tx.pullRequest.count({
        where: { issueId: matchedIssue.id, status: PRStatus.OPEN },
      });
      await tx.issue.update({
        where: { id: matchedIssue.id },
        data: { openPrCount: activeOpenPrCount },
      });

      return {
        contributionId: contribution.id,
        ledgerId: ledgerEntry.id,
        newBalance: updatedUser.totalPoints,
      };
    });
  });

  return {
    status: 'VERIFIED',
    pointsAwarded: rrPoints,
    reason: `Successfully verified PR #${pr.number} merged by @${mergerUsername}. Awarded +${rrPoints} RR Points.`,
    contributionId: result.contributionId,
    ledgerId: result.ledgerId,
    contributorUsername: contributor.githubUsername || pr.user.login,
    newBalance: result.newBalance,
  };
}

