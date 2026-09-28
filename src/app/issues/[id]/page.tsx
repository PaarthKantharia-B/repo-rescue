import React from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getIssueById, getRelatedIssues } from '@/lib/issues/service';
import { IssueDetailView } from '@/components/issues/IssueDetailView';

interface IssueDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: IssueDetailPageProps): Promise<Metadata> {
  const data = await getIssueById(params.id);
  if (!data) {
    return {
      title: 'Issue Not Found | Repo Rescue',
    };
  }
  return {
    title: `${data.issue.title} | Repo Rescue (RR Difficulty ${data.issue.rrDifficulty.toFixed(1)})`,
    description: `Evaluate RR Difficulty ${data.issue.rrDifficulty.toFixed(1)} / 10.0 on ${data.issue.repository.fullName} and earn +${Math.round(data.issue.rrDifficulty * 10)} RR Points.`,
  };
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  // 1. Enforce Authenticated Session
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    const destination = `/issues/${params.id}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(destination)}`);
  }

  const data = await getIssueById(params.id);

  if (!data) {
    notFound();
  }

  const relatedIssues = await getRelatedIssues(data.issue.id, 3);

  return <IssueDetailView data={data} relatedIssues={relatedIssues} />;
}
