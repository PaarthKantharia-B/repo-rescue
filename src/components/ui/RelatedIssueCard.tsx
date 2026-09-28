import React from 'react';
import Link from 'next/link';
import { Issue } from '@/types';
import { calculateRRPoints } from '@/lib/utils';
import { ArrowRight, Tag } from 'lucide-react';

interface RelatedIssueCardProps {
  issue: Issue;
  className?: string;
}

export const RelatedIssueCard: React.FC<RelatedIssueCardProps> = ({ issue, className = '' }) => {
  const points = calculateRRPoints(issue.rrDifficulty);
  const isPrInProgress = issue.prActivityClassification === 'OPEN_PR_IN_PROGRESS';

  return (
    <Link
      href={`/issues/${issue.id}`}
      className={`group flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/90 p-5 backdrop-blur-md transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/60 min-h-[260px] h-auto min-w-0 ${className}`}
    >
      {/* Top Document Flow Content */}
      <div className="space-y-3 min-w-0">
        {/* 1. Header: Repository Name & Issue Number */}
        <div className="flex items-start justify-between gap-2 font-mono text-xs text-slate-400 min-w-0">
          <div className="flex items-start gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                isPrInProgress ? 'bg-amber-400' : 'bg-blue-400'
              }`}
            />
            <span className="font-semibold text-slate-300 group-hover:text-blue-400 transition-colors [overflow-wrap:anywhere] break-words leading-tight">
              {issue.repository.fullName}
            </span>
          </div>
          <span className="font-mono text-slate-400 shrink-0 pl-1">
            #{issue.githubNumber}
          </span>
        </div>

        {/* 2. Issue Title (Max 2 lines) */}
        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
          {issue.title}
        </h3>



        {/* 4. Language & Ecosystem Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1 min-w-0">
          {issue.language && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
              {issue.language}
            </span>
          )}
          {issue.ecosystem && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
              {issue.ecosystem}
            </span>
          )}
          {issue.labels.slice(0, 1).map((label, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/60 border border-slate-800/60 text-slate-400 shrink-0"
            >
              <Tag className="w-2.5 h-2.5 opacity-50 shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 5. Bottom Section: Dedicated Grid [1fr 1fr auto] */}
      <div className="mt-4 pt-3 border-t border-slate-900 grid grid-cols-[1fr_1fr_auto] gap-3 items-center min-w-0">
        {/* Metric 1: Difficulty */}
        <div className="min-w-0">
          <div className="text-sm font-mono font-bold text-slate-100 leading-tight">
            {issue.rrDifficulty.toFixed(1)}
          </div>
          <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
            RR DIFFICULTY
          </div>
        </div>

        {/* Metric 2: Points */}
        <div className="min-w-0">
          <div className="text-sm font-mono font-bold text-amber-400 leading-tight">
            +{points}
          </div>
          <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
            RR POINTS
          </div>
        </div>

        {/* Column 3: SOLVE CTA */}
        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 group-hover:bg-blue-500 text-white font-mono font-bold text-xs transition-all shrink-0">
          <span>SOLVE</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
};
