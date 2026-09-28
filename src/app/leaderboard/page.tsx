import React from 'react';
import { Metadata } from 'next';
import { getLeaderboard, GetLeaderboardParams } from '@/lib/leaderboard/service';
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient';

export const metadata: Metadata = {
  title: 'Global Leaderboard | Repo Rescue',
  description: 'Global contributor rankings for open-source engineering. Ranked strictly by authoritative verified RR Points earned through merged PRs.',
};

interface LeaderboardPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params: GetLeaderboardParams = {
    search: typeof searchParams.search === 'string' ? searchParams.search : undefined,
    language: typeof searchParams.language === 'string' ? searchParams.language : undefined,
    page: typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1,
    pageSize: 10,
  };

  const result = await getLeaderboard(params);

  const stringSearchParams: Record<string, string | undefined> = {};
  Object.keys(searchParams).forEach((key) => {
    const val = searchParams[key];
    if (typeof val === 'string') {
      stringSearchParams[key] = val;
    }
  });

  return <LeaderboardClient initialData={result} searchParams={stringSearchParams} />;
}
