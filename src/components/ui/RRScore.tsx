import React from 'react';
import { getRRTier, getTierColorClasses } from '@/lib/utils';
import { Shield, Sparkles } from 'lucide-react';

interface RRScoreProps {
  score: number; // 0.0 to 10.0
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBar?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const RRScore: React.FC<RRScoreProps> = ({
  score,
  size = 'md',
  showBar = false,
  showLabel = true,
  className = '',
}) => {
  const normalizedScore = Math.min(10.0, Math.max(0.0, score));
  const tier = getRRTier(normalizedScore);
  const colors = getTierColorClasses(tier);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 space-x-1',
    md: 'text-sm px-2.5 py-1 space-x-1.5',
    lg: 'text-base px-3.5 py-1.5 space-x-2',
    xl: 'text-xl px-4 py-2 space-x-2.5 font-bold',
  }[size];

  const scoreNumClasses = {
    sm: 'text-xs font-mono font-semibold',
    md: 'text-sm font-mono font-bold',
    lg: 'text-lg font-mono font-extrabold',
    xl: 'text-2xl font-mono font-black',
  }[size];

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className}`}>
      <div
        className={`inline-flex items-center rounded-lg border backdrop-blur-md transition-all duration-300 ${colors.bg} ${colors.border} ${colors.text} ${sizeClasses}`}
      >
        <Shield className={`shrink-0 ${size === 'sm' ? 'w-3 h-3' : size === 'xl' ? 'w-5 h-5' : 'w-4 h-4'}`} />
        <span className={scoreNumClasses}>
          {normalizedScore.toFixed(1)}
        </span>
        {showLabel && (
          <span className="text-xs font-sans opacity-80 uppercase tracking-wider font-semibold">
            RR Score
          </span>
        )}
      </div>

      {showBar && (
        <div className="w-full bg-slate-900/80 rounded-full h-1.5 border border-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${(normalizedScore / 10) * 100}%`,
              backgroundColor: colors.accent,
              boxShadow: `0 0 10px ${colors.accent}`,
            }}
          />
        </div>
      )}
    </div>
  );
};
