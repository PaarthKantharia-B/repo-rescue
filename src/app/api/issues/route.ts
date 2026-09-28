import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFilteredIssues } from '@/lib/issues/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Independent Server-Side Authentication Enforcement (401 if missing)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be signed in with GitHub to query issues.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const difficultyTier = searchParams.get('difficultyTier') || undefined;
    const minDifficulty = searchParams.get('minDifficulty') ? parseFloat(searchParams.get('minDifficulty')!) : 0;
    const maxDifficulty = searchParams.get('maxDifficulty') ? parseFloat(searchParams.get('maxDifficulty')!) : 10;
    const minPoints = searchParams.get('minPoints') ? parseInt(searchParams.get('minPoints')!, 10) : 0;
    const maxPoints = searchParams.get('maxPoints') ? parseInt(searchParams.get('maxPoints')!, 10) : 100;
    const repo = searchParams.get('repo') || undefined;
    const organization = searchParams.get('organization') || undefined;
    const language = searchParams.get('language') || undefined;
    const ecosystem = searchParams.get('ecosystem') || undefined;
    const label = searchParams.get('label') || undefined;
    const issueType = searchParams.get('issueType') || undefined;
    const prActivity = searchParams.get('prActivity') || undefined;
    const minMaintainerActivity = searchParams.get('minMaintainerActivity') ? parseFloat(searchParams.get('minMaintainerActivity')!) : 0;
    const issueAgeDays = searchParams.get('issueAgeDays') ? parseInt(searchParams.get('issueAgeDays')!, 10) : 0;
    const lastActivityDays = searchParams.get('lastActivityDays') ? parseInt(searchParams.get('lastActivityDays')!, 10) : 0;
    const minComments = searchParams.get('minComments') ? parseInt(searchParams.get('minComments')!, 10) : 0;
    const maxComments = searchParams.get('maxComments') ? parseInt(searchParams.get('maxComments')!, 10) : 100;
    const sortBy = (searchParams.get('sortBy') as any) || 'recent';
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 10;

    const result = await getFilteredIssues({
      search,
      status,
      difficultyTier,
      minDifficulty,
      maxDifficulty,
      minPoints,
      maxPoints,
      repo,
      organization,
      language,
      ecosystem,
      label,
      issueType,
      prActivity,
      minMaintainerActivity,
      issueAgeDays,
      lastActivityDays,
      minComments,
      maxComments,
      sortBy,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/issues Error:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}
