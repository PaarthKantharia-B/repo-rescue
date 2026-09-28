import React from 'react';
import { SearchX, FolderOpen, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No issues found',
  description = 'Try adjusting your filters or search keywords to find open-source issues.',
  actionLabel = 'Reset Filters',
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 backdrop-blur-sm ${className}`}
    >
      <div className="p-4 rounded-full bg-slate-900 border border-slate-800 mb-4 text-slate-500 shadow-inner">
        <SearchX className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-200 font-mono">{title}</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-md">{description}</p>

      {onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 transition-all"
        >
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
