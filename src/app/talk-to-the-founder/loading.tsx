import React from 'react';
import { LoadingState } from '@/components/ui/LoadingState';

export default function TalkToFounderLoading() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <LoadingState type="spinner" />
    </main>
  );
}
