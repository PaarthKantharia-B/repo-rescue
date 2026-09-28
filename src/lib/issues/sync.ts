import { mockDbStore } from '../../../scripts/db-runner';
import { extractLinkedIssueNumbers, verifyAndAwardContribution, VerificationResult, GitHubPRPayload } from '../contributions/verify';
import { PRStatus } from '@prisma/client';
import { IssuePRClassification } from '@/types';

export interface GitHubIssuePayload {
  action: string; // e.g. 'opened', 'edited', 'closed', 'reopened', 'labeled', 'unlabeled'
  issue: {
    id: number;
    number: number;
    title: string;
    body?: string | null;
    state: string; // 'open' | 'closed'
    labels?: { name: string }[];
    user: {
      login: string;
    };
    created_at?: string;
    updated_at?: string;
    closed_at?: string | null;
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

/**
 * Classifies an active issue's current PR activity status.
 * Single authoritative classification: OPEN_NO_PR | OPEN_PR_IN_PROGRESS
 */
export function classifyIssuePRActivity(issue: {
  status: string;
  openPrCount?: number;
  mergedPrCount?: number;
}): IssuePRClassification {
  const openCount = issue.openPrCount ?? 0;
  if (openCount > 0) {
    return 'OPEN_PR_IN_PROGRESS';
  }
  return 'OPEN_NO_PR';
}

/**
 * Returns user-facing label text for PR activity classification.
 */
export function formatPRActivityLabel(classification?: IssuePRClassification): string {
  if (classification === 'OPEN_PR_IN_PROGRESS') {
    return 'OPEN • PR IN PROGRESS';
  }
  return 'OPEN • NO PR';
}

/**
 * Recalculates PR counts (openPrCount, mergedPrCount) and latest activity timestamp for a given issue.
 */
export function recalculateIssuePRStats(issueId: string) {
  const issue = mockDbStore.issues.find((i) => i.id === issueId);
  if (!issue) return;

  const prs = mockDbStore.pullRequests.filter((p) => p.issueId === issueId);
  const openPrs = prs.filter((p) => p.status === 'OPEN' || p.githubState === 'open');
  const mergedPrs = prs.filter((p) => p.status === 'MERGED' || p.isMerged === true);

  issue.openPrCount = openPrs.length;
  issue.mergedPrCount = mergedPrs.length;
  issue.prActivityClassification = classifyIssuePRActivity(issue);

  const timestamps = prs
    .map((p) => new Date(p.latestActivityAt || p.updatedAt || p.createdAt).getTime())
    .filter((t) => !isNaN(t));

  if (timestamps.length > 0) {
    issue.latestPrActivityAt = new Date(Math.max(...timestamps)).toISOString();
  }
}

/**
 * Handles GitHub issue webhook events (opened, edited, closed, reopened, labeled, unlabeled).
 * Idempotent state synchronization.
 */
export async function handleGitHubIssueEvent(payload: GitHubIssuePayload) {
  const action = payload.action;
  const ghIssue = payload.issue;
  const repoFullName = payload.repository.full_name;

  const repo = mockDbStore.repositories.find(
    (r) => r.githubId === payload.repository.id || r.fullName.toLowerCase() === repoFullName.toLowerCase()
  );

  if (!repo) {
    return { status: 'IGNORED', reason: `Repository '${repoFullName}' is not indexed in Repo Rescue.` };
  }

  const existingIssue = mockDbStore.issues.find(
    (i) => i.repositoryId === repo.id && i.githubNumber === ghIssue.number
  );

  if (!existingIssue) {
    return { status: 'IGNORED', reason: `Issue #${ghIssue.number} in '${repoFullName}' is not indexed.` };
  }

  const now = new Date().toISOString();
  existingIssue.lastSyncedAt = now;

  if (action === 'closed') {
    existingIssue.status = 'CLOSED';
    existingIssue.githubState = 'closed';
    existingIssue.githubStateUpdatedAt = ghIssue.closed_at || now;
    recalculateIssuePRStats(existingIssue.id);

    return {
      status: 'UPDATED',
      issueId: existingIssue.id,
      issueStatus: 'CLOSED',
      reason: `Issue #${ghIssue.number} closed on GitHub. Excluded from active explorer; historical data preserved.`,
    };
  }

  if (action === 'reopened') {
    existingIssue.status = 'OPEN';
    existingIssue.githubState = 'open';
    existingIssue.githubStateUpdatedAt = now;
    recalculateIssuePRStats(existingIssue.id);

    return {
      status: 'UPDATED',
      issueId: existingIssue.id,
      issueStatus: 'OPEN',
      reason: `Issue #${ghIssue.number} reopened on GitHub. Re-enabled for active discovery.`,
    };
  }

  if (action === 'edited' || action === 'labeled' || action === 'unlabeled') {
    existingIssue.title = ghIssue.title || existingIssue.title;
    existingIssue.body = ghIssue.body ?? existingIssue.body;
    if (ghIssue.labels) {
      existingIssue.labels = ghIssue.labels.map((l) => l.name);
    }
    recalculateIssuePRStats(existingIssue.id);

    return {
      status: 'UPDATED',
      issueId: existingIssue.id,
      reason: `Issue #${ghIssue.number} metadata updated.`,
    };
  }

  return { status: 'NOOP', reason: `Action '${action}' required no changes.` };
}

/**
 * Handles GitHub Pull Request webhook events (opened, edited, reopened, closed, synchronize).
 * Idempotent PR state synchronization & delegates merged PRs to Phase 6 verification engine.
 */
export async function handleGitHubPREvent(payload: GitHubPRPayload): Promise<VerificationResult & { syncStatus?: string }> {
  const action = payload.action;
  const pr = payload.pull_request;
  const repoFullName = pr.base.repo.full_name;

  const repo = mockDbStore.repositories.find(
    (r) => r.githubId === pr.base.repo.id || r.fullName.toLowerCase() === repoFullName.toLowerCase()
  );

  const linkedNums = extractLinkedIssueNumbers(pr.title, pr.body || '');
  const now = new Date().toISOString();

  // Locate associated issue if indexed
  const matchedIssue = repo
    ? mockDbStore.issues.find((i) => i.repositoryId === repo.id && linkedNums.includes(i.githubNumber))
    : undefined;

  // Find or create PullRequest in mockDbStore
  let existingPR = mockDbStore.pullRequests.find(
    (p) => p.githubId === pr.id || (p.githubNumber === pr.number && repo && p.repositoryId === repo.id)
  );

  if (!existingPR && repo) {
    const contributor = mockDbStore.users.find(
      (u) => u.githubUsername.toLowerCase() === pr.user.login.toLowerCase()
    );

    existingPR = {
      id: `pr-${pr.id}`,
      githubId: pr.id,
      githubNumber: pr.number,
      repositoryId: repo.id,
      userId: contributor ? contributor.id : 'usr-ghost',
      issueId: matchedIssue ? matchedIssue.id : null,
      title: pr.title,
      url: `https://github.com/${repo.fullName}/pull/${pr.number}`,
      status: pr.merged ? 'MERGED' : pr.merged_at ? 'MERGED' : action === 'closed' ? 'CLOSED' : 'OPEN',
      githubState: pr.merged ? 'closed' : action === 'closed' ? 'closed' : 'open',
      isMerged: Boolean(pr.merged),
      openedAt: now,
      latestActivityAt: now,
      lastSyncedAt: now,
    };
    mockDbStore.pullRequests.push(existingPR);
  }

  if (existingPR) {
    existingPR.title = pr.title;
    existingPR.latestActivityAt = now;
    existingPR.lastSyncedAt = now;
    if (matchedIssue) {
      existingPR.issueId = matchedIssue.id;
    }
  }

  // 1. PR Opened or Reopened
  if (action === 'opened' || action === 'reopened') {
    if (existingPR) {
      existingPR.status = 'OPEN';
      existingPR.githubState = 'open';
      existingPR.isMerged = false;
      existingPR.openedAt = existingPR.openedAt || now;
    }

    if (matchedIssue) {
      recalculateIssuePRStats(matchedIssue.id);
    }

    return {
      status: 'PENDING',
      pointsAwarded: 0,
      reason: `PR #${pr.number} ${action} logged. Issue PR activity updated; no points awarded on PR open.`,
    };
  }

  // 2. PR Synchronize (New Commits) or Edited
  if (action === 'synchronize' || action === 'edited') {
    if (existingPR) {
      existingPR.latestActivityAt = now;
    }

    if (matchedIssue) {
      recalculateIssuePRStats(matchedIssue.id);
    }

    return {
      status: 'PENDING',
      pointsAwarded: 0,
      reason: `PR #${pr.number} ${action} metadata synchronized. No points awarded.`,
    };
  }

  // 3. PR Closed WITHOUT Merge
  if (action === 'closed' && (!pr.merged || !pr.merged_at)) {
    if (existingPR) {
      existingPR.status = 'CLOSED';
      existingPR.githubState = 'closed';
      existingPR.isMerged = false;
      existingPR.closedAt = pr.merged_at || now;
    }

    if (matchedIssue) {
      recalculateIssuePRStats(matchedIssue.id);
    }

    return {
      status: 'REJECTED',
      pointsAwarded: 0,
      reason: `PR #${pr.number} closed without being merged. 0 points awarded.`,
    };
  }

  // 4. PR MERGED (pull_request closed + merged=true) -> Execute Phase 6 Verification
  if (action === 'closed' && pr.merged && pr.merged_at) {
    const verificationResult = await verifyAndAwardContribution(payload);

    if (existingPR) {
      existingPR.status = 'MERGED';
      existingPR.githubState = 'closed';
      existingPR.isMerged = true;
      existingPR.mergedAt = new Date(pr.merged_at).toISOString();
      existingPR.mergedBy = pr.merged_by?.login || existingPR.mergedBy;
    }

    if (matchedIssue) {
      recalculateIssuePRStats(matchedIssue.id);
    }

    return verificationResult;
  }

  return {
    status: 'REJECTED',
    pointsAwarded: 0,
    reason: `Unhandled webhook action '${action}'.`,
  };
}
