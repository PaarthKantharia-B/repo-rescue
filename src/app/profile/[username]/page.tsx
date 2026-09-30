import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContributionAnalytics } from '@/lib/analytics/contribution-analytics-service';
import { ContributionAnalyticsView } from '@/components/contributions/ContributionAnalyticsView';

interface ProfilePageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const data = await getContributionAnalytics(params.username);
  if (!data) {
    return { title: 'Contributor Profile | Repo Rescue' };
  }
  return {
    title: `${data.user.name} (@${data.user.githubUsername}) | Contribution Analytics`,
    description: `Open-source contribution intelligence profile for ${data.user.name}. Verified Contributions: ${data.user.verifiedContributionsCount}, Repositories: ${data.user.repositoriesCount}.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const data = await getContributionAnalytics(params.username);

  if (!data) {
    notFound();
  }

  return <ContributionAnalyticsView data={data} />;
}
