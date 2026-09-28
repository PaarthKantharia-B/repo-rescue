import React from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getFilteredIssues, GetIssuesParams } from '@/lib/issues/service';
import { IssueExplorerClient } from '@/components/issues/IssueExplorerClient';

export const metadata: Metadata = {
  title: 'Issue Explorer | Repo Rescue',
  description: 'Discover open-source problem set issues evaluated by RR Difficulty (0.0 - 10.0) yielding auditable RR Points.',
};

interface IssuesPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  // 1. Enforce Authenticated Session
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    // Reconstruct requested destination URL to preserve search parameters and state
    const queryEntries: [string, string][] = [];
    Object.entries(searchParams).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => queryEntries.push([k, item]));
      } else if (typeof v === 'string') {
        queryEntries.push([k, v]);
      }
    });
    const queryString = new URLSearchParams(queryEntries).toString();
    const destination = `/issues${queryString ? `?${queryString}` : ''}`;
    
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(destination)}`);
  }

  // 2. Parse URL search parameters cleanly for initial server load
  const params: GetIssuesParams = {
    search: typeof searchParams.search === 'string' ? searchParams.search : undefined,
    status: typeof searchParams.status === 'string' ? searchParams.status : undefined,
    difficultyTier: typeof searchParams.difficultyTier === 'string' ? searchParams.difficultyTier : undefined,
    minDifficulty: typeof searchParams.minDifficulty === 'string' ? parseFloat(searchParams.minDifficulty) : 0,
    maxDifficulty: typeof searchParams.maxDifficulty === 'string' ? parseFloat(searchParams.maxDifficulty) : 10,
    minPoints: typeof searchParams.minPoints === 'string' ? parseInt(searchParams.minPoints, 10) : 0,
    maxPoints: typeof searchParams.maxPoints === 'string' ? parseInt(searchParams.maxPoints, 10) : 100,
    repo: typeof searchParams.repo === 'string' ? searchParams.repo : undefined,
    organization: typeof searchParams.organization === 'string' ? searchParams.organization : undefined,
    language: typeof searchParams.language === 'string' ? searchParams.language : undefined,
    ecosystem: typeof searchParams.ecosystem === 'string' ? searchParams.ecosystem : undefined,
    label: typeof searchParams.label === 'string' ? searchParams.label : undefined,
    issueType: typeof searchParams.issueType === 'string' ? searchParams.issueType : undefined,
    prActivity: typeof searchParams.prActivity === 'string' ? searchParams.prActivity : undefined,
    minMaintainerActivity: typeof searchParams.minActivity === 'string' ? parseFloat(searchParams.minActivity) : 0,
    issueAgeDays: typeof searchParams.issueAgeDays === 'string' ? parseInt(searchParams.issueAgeDays, 10) : 0,
    lastActivityDays: typeof searchParams.lastActivityDays === 'string' ? parseInt(searchParams.lastActivityDays, 10) : 0,
    minComments: typeof searchParams.minComments === 'string' ? parseInt(searchParams.minComments, 10) : 0,
    maxComments: typeof searchParams.maxComments === 'string' ? parseInt(searchParams.maxComments, 10) : 100,
    sortBy: typeof searchParams.sortBy === 'string' ? (searchParams.sortBy as GetIssuesParams['sortBy']) : 'recent',
    page: 1,
    pageSize: 10,
  };

  // 3. Query server-side database records
  const result = await getFilteredIssues(params);

  // Flatten searchParams into a string-only map for client component props
  const stringSearchParams: Record<string, string | undefined> = {};
  Object.keys(searchParams).forEach((key) => {
    const val = searchParams[key];
    if (typeof val === 'string' && key !== 'page') {
      stringSearchParams[key] = val;
    }
  });

  return <IssueExplorerClient initialData={result} searchParams={stringSearchParams} />;
}
