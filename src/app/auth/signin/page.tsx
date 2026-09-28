import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { SignInContent } from '@/components/auth/SignInContent';
import { LoadingState } from '@/components/ui/LoadingState';

export const metadata: Metadata = {
  title: 'Sign In Required | Repo Rescue',
  description: 'Please sign in with GitHub to access protected open-source problem sets.',
};

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingState type="spinner" />}>
      <SignInContent />
    </Suspense>
  );
}
