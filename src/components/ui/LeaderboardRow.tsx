import React from 'react';
import { Contributor } from '@/types';
import { RankDisplay } from './RankDisplay';
import { PointsDisplay } from './PointsDisplay';
import { LanguageTag } from './LanguageTag';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface LeaderboardRowProps {
  contributor: Contributor;
  className?: string;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ contributor, className = '' }) => {
  return (
    <div
      className={`group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-900 bg-slate-950/70 hover:bg-slate-900/80 hover:border-slate-800 transition-all ${className}`}
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <RankDisplay rank={contributor.rank} size="md" />

        {/* User Avatar & Info */}
        <div className="flex items-center gap-3">
          <img
            src={contributor.image}
            alt={contributor.name}
            className="w-10 h-10 rounded-full border border-slate-700 bg-slate-900"
          />
          <div>
            <Link
              href={`/profile/${contributor.githubUsername}`}
              className="font-bold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <span>{contributor.name}</span>
              <span className="text-xs font-mono text-slate-500 font-normal">
                @{contributor.githubUsername}
              </span>
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono font-semibold text-purple-400">
                {contributor.rankTitle}
              </span>
              <span className="text-slate-700">•</span>
              <LanguageTag language={contributor.primaryLanguage} />
            </div>
          </div>
        </div>
      </div>

      {/* Right Stats */}
      <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{contributor.issuesRescued} Rescued</span>
          </div>
        </div>

        <PointsDisplay points={contributor.totalPoints} highlight size="md" />
      </div>
    </div>
  );
};
