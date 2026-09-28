import React from 'react';

interface LoadingStateProps {
  type?: 'cards' | 'table' | 'spinner' | 'list';
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'list',
  count = 6,
  className = '',
}) => {
  if (type === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
        <div className="relative flex h-10 w-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-10 w-10 bg-blue-600 border border-blue-400"></span>
        </div>
        <span className="mt-4 text-xs font-mono text-slate-400 tracking-wider uppercase animate-pulse">
          Evaluating open-source issues...
        </span>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-slate-950 border border-slate-900 animate-pulse flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900" />
              <div className="space-y-2">
                <div className="w-36 h-4 rounded bg-slate-900" />
                <div className="w-24 h-3 rounded bg-slate-900" />
              </div>
            </div>
            <div className="w-20 h-6 rounded bg-slate-900" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-xl border border-slate-900 bg-slate-950/80 p-4 animate-pulse flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="w-44 h-4 rounded bg-slate-900 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="w-3/4 h-5 rounded bg-slate-900" />
            <div className="w-1/2 h-3 rounded bg-slate-900" />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-12 h-6 rounded bg-slate-900" />
            <div className="w-12 h-6 rounded bg-slate-900" />
            <div className="w-20 h-8 rounded-lg bg-slate-900" />
          </div>
        </div>
      ))}
    </div>
  );
};
