import React from 'react';
import { Activity } from 'lucide-react';

interface ActivityIndicatorProps {
  score: number; // 0.0 to 10.0 scale for maintainer activity
  showText?: boolean;
  className?: string;
}

export const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  score,
  showText = true,
  className = '',
}) => {
  let label = 'Active Maintainer';
  let dotColor = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
  let textColor = 'text-emerald-400';

  if (score < 3.0) {
    label = 'Stale Maintainer';
    dotColor = 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
    textColor = 'text-rose-400';
  } else if (score < 6.0) {
    label = 'Moderate Response';
    dotColor = 'bg-amber-500 shadow-[0_0_8px_#f59e0b]';
    textColor = 'text-amber-400';
  } else if (score < 8.0) {
    label = 'Responsive';
    dotColor = 'bg-blue-500 shadow-[0_0_8px_#3b82f6]';
    textColor = 'text-blue-400';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      {showText && (
        <span className={`inline-flex items-center gap-1 ${textColor}`}>
          <Activity className="w-3 h-3 opacity-70" />
          <span>{label} ({score.toFixed(1)})</span>
        </span>
      )}
    </div>
  );
};
