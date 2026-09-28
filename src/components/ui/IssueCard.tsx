import React from 'react';
import Link from 'next/link';
import { Issue } from '@/types';
import { calculateRRPoints } from '@/lib/utils';
import { ArrowRight, Tag } from 'lucide-react';

interface IssueCardProps {
  issue: Issue;
  variant?: 'row' | 'card';
  className?: string;
}

function cleanExcerpt(body: string, maxLength = 160): string {
  if (!body) return '';
  const plain = body
    .replace(/#+\s?/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~[\]()]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + '...';
}

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  variant = 'row',
  className = '',
}) => {
  const points = calculateRRPoints(issue.rrDifficulty);
  const excerpt = cleanExcerpt(issue.body);
  const isPrInProgress = issue.prActivityClassification === 'OPEN_PR_IN_PROGRESS';

  // VERTICAL CARD VARIANT (For 3-column grids: Homepage & Related section)
  if (variant === 'card') {
    return (
      <Link
        href={`/issues/${issue.id}`}
        className={`group flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/90 p-5 backdrop-blur-md transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/60 min-h-[260px] h-auto min-w-0 overflow-hidden ${className}`}
      >
        {/* Top Normal Document Flow */}
        <div className="space-y-3 min-w-0">
          {/* 1. Header: Repository & Issue Number */}
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

        {/* 5. Dedicated Bottom Grid Row [1fr 1fr auto] */}
        <div className="mt-4 pt-3 border-t border-slate-900 grid grid-cols-[1fr_1fr_auto] gap-3 items-center min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-mono font-bold text-slate-100 leading-tight">
              {issue.rrDifficulty.toFixed(1)}
            </div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
              RR DIFFICULTY
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-mono font-bold text-amber-400 leading-tight">
              +{points}
            </div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
              RR POINTS
            </div>
          </div>

          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 group-hover:bg-blue-500 text-white font-mono font-bold text-xs transition-all shrink-0">
            <span>SOLVE</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    );
  }

  // HORIZONTAL LIST ROW VARIANT (For Explorer Page /issues)
  return (
    <Link
      href={`/issues/${issue.id}`}
      className={`group block rounded-xl border border-slate-800/80 bg-slate-950/90 p-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/60 min-h-[150px] h-auto min-w-0 overflow-hidden ${className}`}
    >
      <div className="hidden lg:grid lg:grid-cols-[180px_minmax(0,1fr)_220px] lg:gap-6 lg:items-center min-w-0">
        {/* DESKTOP COLUMN 1: Identity */}
        <div className="flex flex-col gap-1 min-w-0 font-mono">
          <div className="flex items-start gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                isPrInProgress ? 'bg-amber-400' : 'bg-blue-400'
              }`}
            />
            <span className="font-semibold text-slate-300 group-hover:text-blue-400 text-xs sm:text-sm transition-colors [overflow-wrap:anywhere] break-words leading-tight">
              {issue.repository.fullName}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono pl-4">
            #{issue.githubNumber}
          </span>
        </div>

        {/* DESKTOP COLUMN 2: Title, Excerpt, Metadata */}
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold text-slate-100 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
            {issue.title}
          </h3>

          {excerpt && (
            <p className="text-xs text-slate-400 font-sans line-clamp-2 leading-relaxed [overflow-wrap:anywhere] break-words">
              {excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 min-w-0">


            {issue.language && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                {issue.language}
              </span>
            )}

            {issue.ecosystem && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                {issue.ecosystem}
              </span>
            )}

            {issue.labels.slice(0, 2).map((label, idx) => (
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

        {/* DESKTOP COLUMN 3: Metrics & CTA */}
        <div className="flex items-center justify-between gap-3 w-full min-w-0">
          <div className="text-right shrink-0">
            <div className="text-base font-mono font-bold text-slate-100 leading-tight">
              {issue.rrDifficulty.toFixed(1)}
            </div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              RR DIFFICULTY
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-base font-mono font-bold text-amber-400 leading-tight">
              +{points}
            </div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              RR POINTS
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 group-hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-sm transition-all shrink-0">
            <span>SOLVE</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* TABLET LAYOUT (768px to 1023px): 2 Columns + Dedicated Bottom Metrics Row */}
      <div className="hidden md:grid lg:hidden md:grid-cols-[150px_minmax(0,1fr)] md:gap-4 md:items-start min-w-0">
        {/* TABLET COLUMN 1: Identity */}
        <div className="flex flex-col gap-1 min-w-0 font-mono">
          <div className="flex items-start gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                isPrInProgress ? 'bg-amber-400' : 'bg-blue-400'
              }`}
            />
            <span className="font-semibold text-slate-300 text-xs font-mono [overflow-wrap:anywhere] break-words leading-tight">
              {issue.repository.fullName}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono pl-3.5">
            #{issue.githubNumber}
          </span>
        </div>

        {/* TABLET COLUMN 2: Title, Excerpt, Badges */}
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold text-slate-100 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
            {issue.title}
          </h3>

          {excerpt && (
            <p className="text-xs text-slate-400 font-sans line-clamp-2 leading-relaxed [overflow-wrap:anywhere] break-words">
              {excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 min-w-0">


            {issue.language && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                {issue.language}
              </span>
            )}

            {issue.ecosystem && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                {issue.ecosystem}
              </span>
            )}
          </div>
        </div>

        {/* TABLET ROW 2: Spans across columns for Metrics & SOLVE CTA */}
        <div className="col-span-2 pt-3 border-t border-slate-900 flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs font-mono font-bold text-slate-100 mr-1.5">{issue.rrDifficulty.toFixed(1)}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase">RR DIFFICULTY</span>
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-amber-400 mr-1.5">+{points}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase">RR POINTS</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 group-hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-sm transition-all shrink-0">
            <span>SOLVE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT (<768px): Completely Vertical Stack */}
      <div className="flex md:hidden flex-col space-y-3 min-w-0">
        {/* MOBILE 1: Identity Row */}
        <div className="flex items-center justify-between font-mono text-xs text-slate-300 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPrInProgress ? 'bg-amber-400' : 'bg-blue-400'
              }`}
            />
            <span className="font-semibold text-slate-300 [overflow-wrap:anywhere] break-words truncate">
              {issue.repository.fullName}
            </span>
          </div>
          <span className="text-slate-400 font-mono shrink-0 pl-2">
            #{issue.githubNumber}
          </span>
        </div>

        {/* MOBILE 2: Title */}
        <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
          {issue.title}
        </h3>

        {/* MOBILE 3: Excerpt */}
        {excerpt && (
          <p className="text-xs text-slate-400 font-sans line-clamp-2 leading-relaxed [overflow-wrap:anywhere] break-words">
            {excerpt}
          </p>
        )}

        {/* MOBILE 4: PR Status & Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 min-w-0">


          {issue.language && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
              {issue.language}
            </span>
          )}
        </div>

        {/* MOBILE 5: Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-center min-w-0">
          <div>
            <div className="text-sm font-mono font-bold text-slate-100">{issue.rrDifficulty.toFixed(1)}</div>
            <div className="text-[9px] font-mono text-slate-400 uppercase">RR DIFFICULTY</div>
          </div>
          <div>
            <div className="text-sm font-mono font-bold text-amber-400">+{points}</div>
            <div className="text-[9px] font-mono text-slate-400 uppercase">RR POINTS</div>
          </div>
        </div>

        {/* MOBILE 6: SOLVE CTA */}
        <div className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-sm transition-all shrink-0">
          <span>SOLVE ISSUE</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
};
