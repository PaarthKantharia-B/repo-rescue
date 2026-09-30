import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkIsAdmin } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce Server-Side Session Authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sign in required to access admin statistics.' },
        { status: 401 }
      );
    }

    // 2. Enforce Server-Side Admin Authorization BEFORE querying data
    const isAdmin = await checkIsAdmin(session);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have administrator access.' },
        { status: 403 }
      );
    }

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter out internal admin and API route visits
    const publicPageViewFilter = {
      NOT: [
        { path: { startsWith: '/admin' } },
        { path: { startsWith: '/api' } },
      ],
    };

    const [
      totalUsers,
      realUsersCount,
      users24h,
      users7d,
      users30d,
      activeSessions,
      totalContributions,
      totalPullRequests,
      totalPointsAggregate,
      totalOrganizations,
      totalRepositories,
      totalIssues,
      recentUsers,
      allUsersForTimeline,
      // PageView Analytics (Public pages only)
      totalPageViews,
      pageViews24h,
      uniqueVisitorsGrouped,
      uniqueVisitors24hGrouped,
      topPagesGrouped,
      recentPageViews,
      allPageViewsForTimeline,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          accounts: {
            some: {},
          },
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: past24h } } }),
      prisma.user.count({ where: { createdAt: { gte: past7d } } }),
      prisma.user.count({ where: { createdAt: { gte: past30d } } }),
      prisma.session.count({ where: { expires: { gt: now } } }),
      prisma.contribution.count(),
      prisma.pullRequest.count(),
      prisma.pointsLedger.aggregate({ _sum: { amount: true } }),
      prisma.organization.count(),
      prisma.repository.count(),
      prisma.issue.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          githubUsername: true,
          role: true,
          totalPoints: true,
          rrRating: true,
          createdAt: true,
          accounts: {
            select: {
              provider: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          accounts: {
            some: {},
          },
        },
        select: { createdAt: true },
      }),
      // PageViews filtering out /admin and /api
      prisma.pageView.count({ where: publicPageViewFilter }),
      prisma.pageView.count({ where: { ...publicPageViewFilter, createdAt: { gte: past24h } } }),
      prisma.pageView.groupBy({
        by: ['visitorId'],
        where: { ...publicPageViewFilter, visitorId: { not: null } },
      }),
      prisma.pageView.groupBy({
        by: ['visitorId'],
        where: { ...publicPageViewFilter, visitorId: { not: null }, createdAt: { gte: past24h } },
      }),
      prisma.pageView.groupBy({
        by: ['path'],
        where: publicPageViewFilter,
        _count: { path: true },
        orderBy: { _count: { path: 'desc' } },
        take: 5,
      }),
      prisma.pageView.findMany({
        where: publicPageViewFilter,
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          path: true,
          visitorId: true,
          userId: true,
          createdAt: true,
        },
      }),
      prisma.pageView.findMany({
        where: { ...publicPageViewFilter, createdAt: { gte: past30d } },
        select: { createdAt: true, visitorId: true },
      }),
    ]);

    const seededUsersCount = totalUsers - realUsersCount;
    const uniqueVisitors = uniqueVisitorsGrouped.length;
    const uniqueVisitors24h = uniqueVisitors24hGrouped.length;

    const topPages = topPagesGrouped.map((item) => ({
      path: item.path,
      count: item._count.path,
    }));

    // Format recent users with OAuth sign-in indicator
    const formattedRecentUsers = recentUsers.map((u) => ({
      ...u,
      hasOAuthAccount: u.accounts.length > 0,
    }));

    // Group user signups & pageviews by day for the last 14 days
    const dailyTrafficMap: Record<string, { signups: number; pageViews: number; visitorsSet: Set<string> }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      dailyTrafficMap[dateStr] = { signups: 0, pageViews: 0, visitorsSet: new Set() };
    }

    allUsersForTimeline.forEach((u) => {
      const dateStr = u.createdAt.toISOString().split('T')[0];
      if (dailyTrafficMap[dateStr]) {
        dailyTrafficMap[dateStr].signups += 1;
      }
    });

    allPageViewsForTimeline.forEach((pv) => {
      const dateStr = pv.createdAt.toISOString().split('T')[0];
      if (dailyTrafficMap[dateStr]) {
        dailyTrafficMap[dateStr].pageViews += 1;
        if (pv.visitorId) {
          dailyTrafficMap[dateStr].visitorsSet.add(pv.visitorId);
        }
      }
    });

    const dailyTraffic = Object.entries(dailyTrafficMap).map(([date, data]) => ({
      date,
      signups: data.signups,
      pageViews: data.pageViews,
      uniqueVisitors: data.visitorsSet.size,
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        realUsersCount,
        seededUsersCount,
        users24h,
        users7d,
        users30d,
        activeSessions,
        totalContributions,
        totalPullRequests,
        totalPointsAwarded: totalPointsAggregate._sum.amount || 0,
        totalOrganizations,
        totalRepositories,
        totalIssues,
        // Public Traffic Metrics Only
        totalPageViews,
        pageViews24h,
        uniqueVisitors,
        uniqueVisitors24h,
      },
      topPages,
      recentPageViews,
      dailyTraffic,
      recentUsers: formattedRecentUsers,
    });
  } catch (error: any) {
    console.error('❌ Admin Stats API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin stats', details: error.message },
      { status: 500 }
    );
  }
}
