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

    return NextResponse.json({
      syncStatus: user.contributorSyncStatus,
      lastSyncedAt: user.lastSyncedAt?.toISOString() ?? null,
      syncStartedAt: user.syncStartedAt?.toISOString() ?? null,
      syncCompletedAt: user.syncCompletedAt?.toISOString() ?? null,
      syncError: user.syncError ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed retrieving sync status.', details: err.message }, { status: 500 });
  }
}
