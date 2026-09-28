import React from 'react';
import { Trophy, Crown, Medal, Award } from 'lucide-react';

interface RankDisplayProps {
  rank: number;
  rankTitle?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RankDisplay: React.FC<RankDisplayProps> = ({
  rank,
  rankTitle,
  size = 'md',
  className = '',
}) => {
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  let icon = <Award className="w-3.5 h-3.5 text-slate-400" />;

  if (rank === 1) {
    badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]';
    icon = <Crown className="w-4 h-4 text-amber-400" />;
  } else if (rank === 2) {
    badgeColor = 'bg-slate-800/90 text-slate-200 border-slate-400/60 shadow-[0_0_10px_rgba(148,163,184,0.2)]';
    icon = <Medal className="w-4 h-4 text-slate-300" />;
  } else if (rank === 3) {
    badgeColor = 'bg-orange-950/60 text-orange-300 border-orange-600/60 shadow-[0_0_10px_rgba(234,88,12,0.2)]';
    icon = <Trophy className="w-4 h-4 text-orange-400" />;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3.5 py-1.5 gap-2 font-bold',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center font-mono font-bold border rounded-md ${badgeColor} ${sizeClasses}`}
      >
        {icon}
        <span>#{rank}</span>
      </span>
      {rankTitle && (
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          {rankTitle}
        </span>
      )}
    </div>
  );
};
