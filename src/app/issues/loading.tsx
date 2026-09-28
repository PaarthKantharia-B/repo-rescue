import React from 'react';
import { LoadingState } from '@/components/ui/LoadingState';

export default function IssuesLoading() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-slate-100">Issue Explorer</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Discover evaluated open-source problem sets</p>
        </div>
      </div>
      <LoadingState type="list" count={6} />
    </main>
  );
}
