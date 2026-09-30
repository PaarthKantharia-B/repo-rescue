import React from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getContributionAnalytics } from '@/lib/analytics/contribution-analytics-service';
import { EngineeringJournalView } from '@/components/contributions/EngineeringJournalView';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Engineering Journal | Repo Rescue',
  description: 'A verified history of the engineering problems you have solved through open source.',
};

export const dynamic = 'force-dynamic';

export default async function MyContributionsPage() {
  // 1. Enforce Authenticated Session (Strict Access Requirement)
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin?callbackUrl=/contributions');
  }

  // 2. Resolve Authenticated Contributor's Username
  let usernameCandidate: string | undefined = session.user.githubUsername ?? undefined;

  // Fallback query if githubUsername is missing from session object
  if (!usernameCandidate && session.user.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { githubUsername: true },
    });
    usernameCandidate = dbUser?.githubUsername ?? undefined;
  }

  if (typeof usernameCandidate !== 'string' || !usernameCandidate) {
    redirect('/auth/signin?callbackUrl=/contributions');
  }

  const authenticatedUsername: string = usernameCandidate;

  // 3. Fetch Analytics STRICTLY for the Authenticated User Only
  const data = await getContributionAnalytics(authenticatedUsername);

  if (!data) {
    redirect('/auth/signin?callbackUrl=/contributions');
  }

  return <EngineeringJournalView data={data} isOwner={true} />;
}
