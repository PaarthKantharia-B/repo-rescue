import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContributorProfile } from '@/lib/leaderboard/service';
import { ContributorProfileView } from '@/components/profile/ContributorProfileView';

interface ProfilePageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const data = await getContributorProfile(params.username);
  if (!data) {
    return { title: 'Contributor Profile | Repo Rescue' };
  }
  return {
    title: `${data.user.name} (@${data.user.githubUsername}) | Repo Rescue Profile`,
    description: `Contributor profile for ${data.user.name}. Total RR Points: ${data.user.totalPoints}, Rank: #${data.user.rank}, Rescued Issues: ${data.user.totalRescued}.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const data = await getContributorProfile(params.username);

  if (!data) {
    notFound();
  }

  return <ContributorProfileView data={data} />;
}
