import { prisma, withPrismaRetry } from '@/lib/prisma';
import { ContributorSyncStatus } from '@prisma/client';
import { extractLinkedIssueNumbers, verifyAndAwardContribution, GitHubPRPayload } from '@/lib/contributions/verify';
import { evaluateV2FactorsWithEvidence } from '@/lib/issues/ingestion';
import { SCORING_VERSION_V2_3 } from '@/lib/scoring';
import { getOrCreateCaseStudyAnalysis } from '@/lib/ai/case-study-service';

export interface ContributorSyncResult {
  status: 'SUCCESS' | 'PARTIAL' | 'SKIPPED' | 'FAILED';
  discoveredPrsCount: number;
  verifiedContributionsCount: number;
  pointsAwarded: number;
  reason: string;
  errors: string[];
}

interface GithubSearchPrItem {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  closed_at: string | null;
  pull_request?: {
    html_url: string;
    merged_at?: string | null;
  };
  repository_url: string;
  user: {
    login: string;
  };
}

/**
 * Fetches user PRs directly from GitHub API using search query.
 */
async function fetchUserMergedPrsFromGithub(
  githubUsername: string,
  page = 1,
  perPage = 100
): Promise<{ items: GithubSearchPrItem[]; totalCount: number }> {
  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Contributor-Sync',
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  // Broad historical discovery across ALL PR statuses (open, closed, merged, draft)
  const query = encodeURIComponent(`type:pr author:${githubUsername}`);
  const url = `https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=${perPage}&page=${page}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`GitHub API error (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return {
    items: data.items || [],
    totalCount: data.total_count || 0,
  };
}

/**
 * Helper to fetch repo details from GitHub API if repository is not yet indexed in Repo Rescue database.
 */
async function fetchGithubRepoMetadata(owner: string, repoName: string) {
  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Contributor-Sync',
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[ContributorSync] Failed fetching repo metadata for ${owner}/${repoName}:`, err);
  }
  return null;
}

/**
 * Helper to fetch issue details from GitHub API if referenced issue is not yet indexed in Repo Rescue database.
 */
async function fetchGithubIssueMetadata(owner: string, repoName: string, issueNumber: number) {
  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Contributor-Sync',
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (!data.pull_request) {
        return data;
      }
    }
  } catch (err) {
    console.warn(`[ContributorSync] Failed fetching issue metadata for ${owner}/${repoName}#${issueNumber}:`, err);
  }
  return null;
}

/**
 * Main Authoritative Contributor Historical Synchronization Service.
 * Discovers, registers, verifies, scores, and creates PointsLedger entries for a user's GitHub PRs.
 */
export async function syncContributorGithubActivity(
  userId: string,
  options?: { forceFull?: boolean; customToken?: string; customGithubUsername?: string }
): Promise<ContributorSyncResult> {
  const errors: string[] = [];
  let discoveredPrsCount = 0;
  let verifiedContributionsCount = 0;
  let pointsAwarded = 0;

  // 1. User & Identity Verification in PostgreSQL
  let user = await withPrismaRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
    })
  );

  // Fallback: If githubUsername is missing in DB but provided in options, update record
  if (user && !user.githubUsername && options?.customGithubUsername) {
    try {
      user = await withPrismaRetry(() =>
        prisma.user.update({
          where: { id: userId },
          data: { githubUsername: options.customGithubUsername },
        })
      );
    } catch (err) {
      console.warn(`[ContributorSync] Failed updating missing githubUsername for user ${userId}:`, err);
    }
  }

  if (!user || !user.githubUsername) {
    return {
      status: 'FAILED',
      discoveredPrsCount: 0,
      verifiedContributionsCount: 0,
      pointsAwarded: 0,
      reason: 'User not found or GitHub username is missing.',
      errors: ['User not found or missing githubUsername.'],
    };
  }

  const githubUsername = user.githubUsername;
  const now = new Date();

  // 2. Concurrency Lock & Lease Check (Auto-expires stale RUNNING locks after 5 minutes)
  if (user.contributorSyncStatus === ContributorSyncStatus.RUNNING) {
    const timeSinceStart = user.syncStartedAt ? now.getTime() - new Date(user.syncStartedAt).getTime() : Infinity;
    if (timeSinceStart < 300000) {
      // Lease duration: 5 minutes (300,000 ms)
      console.log(`[CONTRIBUTOR_SYNC] userId=${userId} githubUsername=@${githubUsername} status=SKIPPED (lease active)`);
      return {
        status: 'SKIPPED',
        discoveredPrsCount: 0,
        verifiedContributionsCount: 0,
        pointsAwarded: 0,
        reason: `Sync already running for @${githubUsername} (started ${Math.round(timeSinceStart / 1000)}s ago).`,
        errors: [],
      };
    }
  }

  console.log(`[CONTRIBUTOR_SYNC] userId=${userId} githubUsername=@${githubUsername} status=STARTED`);

  // Update User state to RUNNING
  await withPrismaRetry(() =>
    prisma.user.update({
      where: { id: userId },
      data: {
        contributorSyncStatus: ContributorSyncStatus.RUNNING,
        syncStartedAt: now,
        syncError: null,
      },
    })
  );

  try {
    // 3. GitHub PR Discovery with Pagination (Phase 3 & Phase 4)
    const allDiscoveredPrs: GithubSearchPrItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      // Max 1000 items (10 pages of 100)
      try {
        const { items, totalCount } = await fetchUserMergedPrsFromGithub(githubUsername, page, 100);
        if (items.length === 0) {
          hasMore = false;
        } else {
          allDiscoveredPrs.push(...items);
          if (allDiscoveredPrs.length >= totalCount || items.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } catch (err: any) {
        console.warn(`[ContributorSync] Search API page ${page} error for @${githubUsername}:`, err);
        errors.push(`Page ${page} GitHub Search API error: ${err.message || String(err)}`);
        hasMore = false;
      }
    }

    discoveredPrsCount = allDiscoveredPrs.length;

    // 4. Iterate Discovered PRs & Process through Verification Pipeline (Phase 5, 6, 7, 8, 9)
    for (const prItem of allDiscoveredPrs) {
      try {
        // Extract repo owner & name from repository_url or html_url
        let owner = '';
        let repoName = '';

        if (prItem.repository_url) {
          const parts = prItem.repository_url.split('/repos/')[1]?.split('/');
          if (parts && parts.length === 2) {
            owner = parts[0];
            repoName = parts[1];
          }
        }

        if (!owner || !repoName) {
          const urlMatch = prItem.html_url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
          if (urlMatch) {
            owner = urlMatch[1];
            repoName = urlMatch[2];
          }
        }

        if (!owner || !repoName) {
          errors.push(`Could not parse repository owner/name for PR #${prItem.number}`);
          continue;
        }

        const repoFullName = `${owner}/${repoName}`;

        // Ensure Repository is registered in PostgreSQL (Phase 5)
        let repo = await withPrismaRetry(() =>
          prisma.repository.findFirst({
            where: { fullName: { mode: 'insensitive', equals: repoFullName } },
          })
        );

        if (!repo) {
          const repoMeta = await fetchGithubRepoMetadata(owner, repoName);
          if (repoMeta) {
            repo = await withPrismaRetry(() =>
              prisma.repository.create({
                data: {
                  githubId: BigInt(repoMeta.id),
                  name: repoMeta.name,
                  fullName: repoMeta.full_name,
                  owner: repoMeta.owner?.login || owner,
                  description: repoMeta.description || '',
                  url: repoMeta.html_url || `https://github.com/${repoFullName}`,
                  language: repoMeta.language || 'TypeScript',
                  starsCount: repoMeta.stargazers_count || 0,
                  forksCount: repoMeta.forks_count || 0,
                  openIssuesCount: repoMeta.open_issues_count || 0,
                  ecosystem: repoMeta.language || 'Node.js',
                  repoType: 'OPEN_SOURCE',
                  eligibilityStatus: 'ELIGIBLE',
                },
              })
            );
          }
        }

        if (!repo) {
          errors.push(`Repository '${repoFullName}' could not be registered in store.`);
          continue;
        }

        const isMerged = Boolean(prItem.pull_request?.merged_at);
        const prStatus = isMerged ? 'MERGED' : prItem.state === 'closed' ? 'CLOSED' : 'OPEN';

        // Resolve Linked Issue if closing keyword reference present (e.g. Fixes #123)
        const linkedNums = extractLinkedIssueNumbers(prItem.title, prItem.body || '');
        let matchedIssue = null;

        if (linkedNums.length > 0) {
          matchedIssue = await withPrismaRetry(() =>
            prisma.issue.findFirst({
              where: {
                repositoryId: repo.id,
                githubNumber: { in: linkedNums },
              },
            })
          );

          if (!matchedIssue) {
            // Attempt to register referenced issue from GitHub API
            const issueMeta = await fetchGithubIssueMetadata(owner, repoName, linkedNums[0]);
            if (issueMeta) {
              const rawLabels = (issueMeta.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
              const evaluation = evaluateV2FactorsWithEvidence({
                title: issueMeta.title,
                body: issueMeta.body || '',
                labels: rawLabels,
                repoName: repo.name,
                repoStars: repo.starsCount,
                repoType: repo.repoType,
              });

              const issueNow = new Date();
              matchedIssue = await withPrismaRetry(() =>
                prisma.issue.create({
                  data: {
                    githubId: BigInt(issueMeta.id),
                    githubNumber: issueMeta.number,
                    repositoryId: repo.id,
                    title: issueMeta.title,
                    body: issueMeta.body || '',
                    url: issueMeta.html_url || `https://github.com/${repoFullName}/issues/${issueMeta.number}`,
                    status: issueMeta.state === 'closed' ? 'CLOSED' : 'OPEN',
                    labels: rawLabels,
                    language: repo.language || 'TypeScript',
                    ecosystem: repo.ecosystem || 'Node.js',
                    authorUsername: issueMeta.user?.login || 'ghost',
                    rrDifficulty: evaluation.compositeScore,
                    githubState: issueMeta.state || 'open',
                    lastSyncedAt: issueNow,
                  },
                })
              );

              await withPrismaRetry(() =>
                prisma.issueScore.create({
                  data: {
                    issueId: matchedIssue!.id,
                    scoringVersion: SCORING_VERSION_V2_3,
                    calculatedAt: issueNow,
                    technicalDifficulty: evaluation.factors.technicalComplexity,
                    codebaseComplexity: evaluation.factors.changeScope,
                    issueScope: evaluation.factors.domainSpecialization,
                    domainKnowledge: evaluation.factors.testingVerificationEffort,
                    expectedImpact: evaluation.factors.problemAmbiguity,
                    testingComplexity: evaluation.factors.testingVerificationEffort,
                    issueClarity: evaluation.factors.problemAmbiguity,
                    maintainerActivity: 5.0,
                    compositeScore: evaluation.compositeScore,
                    reasoning: evaluation.overallReasoning,
                  },
                })
              );
            }
          }
        }

        // Persist/Upsert PullRequest lifecycle record for ALL discovered PRs
        const mergedAtDate = isMerged && (prItem.pull_request?.merged_at || prItem.closed_at)
          ? new Date(prItem.pull_request?.merged_at || prItem.closed_at!)
          : null;
        const closedAtDate = prItem.closed_at ? new Date(prItem.closed_at) : null;
        const openedAtDate = (prItem as any).created_at ? new Date((prItem as any).created_at) : now;

        await withPrismaRetry(() =>
          prisma.pullRequest.upsert({
            where: { githubId: BigInt(prItem.id) },
            create: {
              id: `pr-${prItem.id}`,
              githubId: BigInt(prItem.id),
              githubNumber: prItem.number,
              repositoryId: repo.id,
              userId: user.id,
              issueId: matchedIssue?.id || null,
              title: prItem.title,
              url: prItem.html_url || `https://github.com/${repoFullName}/pull/${prItem.number}`,
              status: prStatus as any,
              githubState: prItem.state || (isMerged ? 'closed' : 'open'),
              isMerged: isMerged,
              openedAt: openedAtDate,
              closedAt: closedAtDate,
              mergedAt: mergedAtDate,
              lastSyncedAt: now,
              latestActivityAt: now,
            },
            update: {
              title: prItem.title,
              status: prStatus as any,
              githubState: prItem.state || (isMerged ? 'closed' : 'open'),
              isMerged: isMerged,
              closedAt: closedAtDate,
              mergedAt: mergedAtDate,
              lastSyncedAt: now,
              latestActivityAt: now,
              ...(matchedIssue ? { issueId: matchedIssue.id } : {}),
            },
          })
        );

        // Authoritative Verification ONLY for Merged PRs with indexed issue
        if (isMerged && matchedIssue) {
          const verificationPayload: GitHubPRPayload = {
            action: 'closed',
            number: prItem.number,
            pull_request: {
              id: prItem.id,
              number: prItem.number,
              title: prItem.title,
              body: prItem.body || '',
              merged: true,
              merged_at: mergedAtDate ? mergedAtDate.toISOString() : now.toISOString(),
              merged_by: { login: 'maintainer-audit' },
              user: {
                id: 0,
                login: githubUsername,
              },
              base: {
                repo: {
                  id: Number(repo.githubId),
                  name: repo.name,
                  full_name: repo.fullName,
                  owner: { login: repo.owner },
                },
              },
            },
          };

          const result = await verifyAndAwardContribution(verificationPayload);

          if (result.status === 'VERIFIED') {
            verifiedContributionsCount++;
            pointsAwarded += result.pointsAwarded;

            // Queue AI case study synthesis asynchronously without blocking contribution verification (Phase 16)
            if (result.contributionId) {
              try {
                await getOrCreateCaseStudyAnalysis(result.contributionId);
              } catch (aiErr) {
                console.warn(`[ContributorSync] Asynchronous AI case study generation error for contribution ${result.contributionId}:`, aiErr);
              }
            }
          } else if (result.status === 'ALREADY_PROCESSED') {
            // Idempotent hit — already awarded safely (Phase 9)
          } else if (result.status === 'REJECTED') {
            errors.push(`PR #${prItem.number} rejected: ${result.reason}`);
          }
        }
      } catch (prErr: any) {
        // Individual PR failure resilience (Phase 13)
        const msg = `Error processing PR #${prItem.number}: ${prErr.message || String(prErr)}`;
        console.warn(`[ContributorSync] ${msg}`);
        errors.push(msg);
      }
    }

    // 5. Update Contributor Sync State in PostgreSQL (Phase 2 & Phase 14)
    const completedAt = new Date();
    const finalStatus = errors.length > 0 && verifiedContributionsCount === 0 && discoveredPrsCount > 0
      ? ContributorSyncStatus.FAILED
      : ContributorSyncStatus.SUCCESS;

    await withPrismaRetry(() =>
      prisma.user.update({
        where: { id: userId },
        data: {
          contributorSyncStatus: finalStatus,
          lastSyncedAt: completedAt,
          syncCompletedAt: completedAt,
          syncError: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
        },
      })
    );

    console.log(`[CONTRIBUTOR_SYNC] userId=${userId} githubUsername=@${githubUsername} discoveredPRs=${discoveredPrsCount} verified=${verifiedContributionsCount} pointsAwarded=${pointsAwarded} status=${finalStatus}`);

    return {
      status: finalStatus === ContributorSyncStatus.SUCCESS ? 'SUCCESS' : 'PARTIAL',
      discoveredPrsCount,
      verifiedContributionsCount,
      pointsAwarded,
      reason: `Completed contributor sync for @${githubUsername}. Discovered ${discoveredPrsCount} PRs, verified ${verifiedContributionsCount} contributions, awarded +${pointsAwarded} RR Points.`,
      errors,
    };
  } catch (err: any) {
    const errMessage = err.message || String(err);
    console.error(`❌ [CONTRIBUTOR_SYNC] userId=${userId} githubUsername=@${githubUsername} status=FAILED error=${errMessage}`);

    await withPrismaRetry(() =>
      prisma.user.update({
        where: { id: userId },
        data: {
          contributorSyncStatus: ContributorSyncStatus.FAILED,
          syncError: errMessage,
        },
      })
    );

    return {
      status: 'FAILED',
      discoveredPrsCount,
      verifiedContributionsCount,
      pointsAwarded,
      reason: `Contributor sync failed for @${githubUsername}: ${errMessage}`,
      errors: [errMessage, ...errors],
    };
  }
}
