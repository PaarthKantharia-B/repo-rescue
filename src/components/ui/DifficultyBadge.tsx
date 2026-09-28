import React from 'react';
import { getRRTier, getTierColorClasses } from '@/lib/utils';
import { Zap } from 'lucide-react';

interface DifficultyBadgeProps {
  score: number;
  showIcon?: boolean;
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  score,
  showIcon = true,
  className = '',
}) => {
  const tier = getRRTier(score);
  const colors = getTierColorClasses(tier);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${colors.bg} ${colors.border} ${colors.text} ${className}`}
    >
      {showIcon && <Zap className="w-3 h-3 shrink-0" />}
      <span>{colors.label}</span>
    </span>
  );
};
