import React from 'react';
import { Repository } from '@/types';
import { Star, GitFork, AlertCircle, ExternalLink } from 'lucide-react';
import { ActivityIndicator } from './ActivityIndicator';
import { LanguageTag } from './LanguageTag';
import { TechnologyTag } from './TechnologyTag';
import { formatNumber } from '@/lib/utils';
import { GitHubLink } from './GitHubLink';

interface RepositoryCardProps {
  repository: Repository;
  className?: string;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repository, className = '' }) => {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-950/80 p-5 backdrop-blur-md hover:border-slate-700 transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold font-mono text-slate-100">{repository.fullName}</h4>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{repository.description}</p>
        </div>
        <ActivityIndicator score={repository.maintainerActivityScore} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {repository.language && <LanguageTag language={repository.language} />}
        {repository.ecosystem && <TechnologyTag technology={repository.ecosystem} size="sm" />}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            {formatNumber(repository.starsCount)}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="w-3.5 h-3.5 text-slate-400" />
            {formatNumber(repository.forksCount)}
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {repository.openIssuesCount} issues
          </span>
        </div>

        <GitHubLink href={repository.url} label="Repo" size="sm" />
      </div>
    </div>
  );
};
