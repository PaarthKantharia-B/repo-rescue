import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | string | null;
  icon: LucideIcon;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'purple';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendUp = true,
  accentColor = 'blue',
  className = '',
}) => {
  const accentStyles = {
    blue: 'border-blue-900/40 hover:border-blue-500/40 text-blue-400 bg-blue-950/20',
    emerald: 'border-emerald-900/40 hover:border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
    amber: 'border-amber-900/40 hover:border-amber-500/40 text-amber-400 bg-amber-950/20',
    purple: 'border-purple-900/40 hover:border-purple-500/40 text-purple-400 bg-purple-950/20',
  }[accentColor];

  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-slate-950/80 p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-xl ${accentStyles} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${accentStyles}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between min-h-[2.25rem]">
        <span className="text-3xl font-mono font-extrabold text-slate-100 tracking-tight">
          {hasValue ? (typeof value === 'number' ? formatNumber(value) : value) : 'N/A'}
        </span>
        {trend && (
          <span
            className={`text-xs font-mono font-medium ${
              trendUp ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-400 font-sans">{subtitle}</p>}
    </div>
  );
};
