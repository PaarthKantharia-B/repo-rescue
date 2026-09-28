import React from 'react';
import { Coins, Flame } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface PointsDisplayProps {
  points: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  highlight?: boolean;
  className?: string;
}

export const PointsDisplay: React.FC<PointsDisplayProps> = ({
  points,
  size = 'md',
  showLabel = true,
  highlight = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3.5 py-1.5 gap-2 font-bold',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-md font-mono font-semibold border transition-colors ${
        highlight
          ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
          : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
      } ${sizeClasses} ${className}`}
    >
      <Coins className={`${iconSizes} text-amber-400 shrink-0`} />
      <span>+{formatNumber(points)}</span>
      {showLabel && <span className="font-sans text-xs text-slate-400 font-normal">RR Points</span>}
    </div>
  );
};
