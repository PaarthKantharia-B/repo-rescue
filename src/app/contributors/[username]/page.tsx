import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContributionAnalytics } from '@/lib/analytics/contribution-analytics-service';
import { ContributionAnalyticsView } from '@/components/contributions/ContributionAnalyticsView';

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getContributionAnalytics(params.username);
  if (!data) {
    return { title: 'Contributor Profile | Repo Rescue' };
  }
  return {
    title: `${data.user.name} (@${data.user.githubUsername}) | Public Contributor Profile`,
    description: `Public open-source contribution intelligence profile for ${data.user.name}. Verified Contributions: ${data.user.verifiedContributionsCount}, Repositories: ${data.user.repositoriesCount}.`,
  };
}

export default async function PublicContributorProfilePage({ params }: PageProps) {
  const data = await getContributionAnalytics(params.username);

  if (!data) {
    notFound();
  }

  // Ensure zero sensitive account data is passed to public view
  const safeData = {
    ...data,
    user: {
      ...data.user,
      email: undefined,
    },
  };

  return <ContributionAnalyticsView data={safeData} />;
}
