import React from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TalkToTheFounderClient } from '@/components/founder/TalkToTheFounderClient';

export const metadata: Metadata = {
  title: 'Talk to the Founder | Repo Rescue',
  description: 'Direct founder feedback channel. Tell me what is working, what is broken, or what you wish existed.',
};

export default async function TalkToTheFounderPage() {
  // 1. Enforce Authenticated Session
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    const destination = '/talk-to-the-founder';
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(destination)}`);
  }

  return <TalkToTheFounderClient />;
}
