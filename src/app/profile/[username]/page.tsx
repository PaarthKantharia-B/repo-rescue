import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getContributionAnalytics } from '@/lib/analytics/contribution-analytics-service';
import { EngineeringJournalView } from '@/components/contributions/EngineeringJournalView';

interface ProfilePageProps {
  params: { username: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const data = await getContributionAnalytics(params.username);
  if (!data) {
    return { title: 'Contributor Engineering Journal | Repo Rescue' };
  }
  return {
    title: `${data.user.name} (@${data.user.githubUsername}) | Engineering Journal`,
    description: `Verified engineering journal and contribution case studies for ${data.user.name}. Verified Contributions: ${data.user.verifiedContributionsCount}, Repositories: ${data.user.repositoriesCount}.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const session = await getServerSession(authOptions);
  const data = await getContributionAnalytics(params.username);

  if (!data) {
    notFound();
  }

  const currentUsername = session?.user?.githubUsername;
  const isOwner = Boolean(
    currentUsername &&
    currentUsername.toLowerCase() === params.username.toLowerCase()
  );

  return <EngineeringJournalView data={data} isOwner={isOwner} />;
}
