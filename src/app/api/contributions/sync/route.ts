import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncContributorGithubActivity } from '@/lib/contributors/sync-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/contributions/sync
 * Manually or programmatically triggers background contributor GitHub activity discovery.
 * Identity is strictly derived from the authenticated session (never client-provided params).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required.' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const forceFull = Boolean(body.forceFull);

    // Trigger sync service
    const result = await syncContributorGithubActivity(userId, { forceFull });

    return NextResponse.json(
      {
        message: result.reason,
        status: result.status,
        discoveredPrsCount: result.discoveredPrsCount,
        verifiedContributionsCount: result.verifiedContributionsCount,
        pointsAwarded: result.pointsAwarded,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('❌ POST /api/contributions/sync Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error executing contributor sync.', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contributions/sync
 * Retrieves current contributor sync status and lastSyncedAt timestamp for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        contributorSyncStatus: true,
        lastSyncedAt: true,
        syncStartedAt: true,
        syncCompletedAt: true,
        syncError: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    let activeSyncPrs: Array<{
      githubNumber: number;
      title: string;
      repositoryFullName: string;
      status: string;
      isMerged: boolean;
      hasLinkedIssue: boolean;
      isVerified: boolean;
      rrPoints: number | null;
      rrDifficulty: number | null;
      ineligibilityReason: string | null;
    }> = [];

    if (user.syncStartedAt) {
      try {
        const prs = await prisma.pullRequest.findMany({
          where: {
            userId: session.user.id,
            lastSyncedAt: { gte: user.syncStartedAt },
          },
          orderBy: { lastSyncedAt: 'desc' },
          take: 20,
          select: {
            githubNumber: true,
            title: true,
            status: true,
            isMerged: true,
            issueId: true,
            repository: { select: { fullName: true } },
            issue: {
              select: {
                githubNumber: true,
                title: true,
                rrDifficulty: true,
                contributions: {
                  where: { userId: session.user.id },
                  select: { status: true, rrPoints: true }
                }
              }
            }
          }
        });

        activeSyncPrs = prs.map((pr) => {
          const linkedIssue = pr.issue;
          const contrib = linkedIssue?.contributions[0];
          const isVerified = contrib?.status === 'MERGED_AND_AUDITED';
          const hasLinkedIssue = Boolean(pr.issueId || linkedIssue);
          let ineligibilityReason: string | null = null;
          if (pr.isMerged && !hasLinkedIssue) {
            ineligibilityReason = 'Merged — no linked issue';
          } else if (!pr.isMerged) {
            ineligibilityReason = pr.status === 'OPEN' ? 'PR is open' : 'PR closed unmerged';
          }

          return {
            githubNumber: pr.githubNumber,
            title: pr.title,
            repositoryFullName: pr.repository?.fullName || '',
            status: pr.status,
            isMerged: pr.isMerged,
            hasLinkedIssue,
            isVerified,
            rrPoints: isVerified ? (contrib?.rrPoints ?? null) : null,
            rrDifficulty: isVerified ? (linkedIssue?.rrDifficulty ?? null) : null,
            ineligibilityReason,
          };
        });
      } catch (_) {}
    }

    return NextResponse.json({
      syncStatus: user.contributorSyncStatus,
      lastSyncedAt: user.lastSyncedAt?.toISOString() ?? null,
      syncStartedAt: user.syncStartedAt?.toISOString() ?? null,
      syncCompletedAt: user.syncCompletedAt?.toISOString() ?? null,
      syncError: user.syncError ?? null,
      activeSyncPrs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed retrieving sync status.', details: err.message }, { status: 500 });
  }
}
