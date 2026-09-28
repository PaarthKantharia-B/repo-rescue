'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { GetLeaderboardResult } from '@/lib/leaderboard/service';
import { RankDisplay } from '@/components/ui/RankDisplay';
import { PointsDisplay } from '@/components/ui/PointsDisplay';
import { LanguageTag } from '@/components/ui/LanguageTag';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Award,
  Sparkles,
  RotateCcw,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface LeaderboardClientProps {
  initialData: GetLeaderboardResult;
  searchParams: Record<string, string | undefined>;
}

export const LeaderboardClient: React.FC<LeaderboardClientProps> = ({
  initialData,
  searchParams,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.search || '');
  const [language, setLanguage] = useState(searchParams.language || '');
  const [page, setPage] = useState(searchParams.page ? parseInt(searchParams.page, 10) : 1);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrlParams({ search, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateUrlParams = (newParams: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(window.location.search);

    const merged = {
      search,
      language,
      page,
      ...newParams,
    };

    Object.entries(merged).forEach(([key, val]) => {
      if (val === undefined || val === '' || (key === 'page' && val === 1)) {
        current.delete(key);
      } else {
        current.set(key, String(val));
      }
    });

    const searchString = current.toString();
    const query = searchString ? `?${searchString}` : '';

    startTransition(() => {
      router.push(`${pathname}${query}`);
    });
  };

  const handleReset = () => {
    setSearch('');
    setLanguage('');
    setPage(1);

    startTransition(() => {
      router.push(pathname);
    });
  };

  const { entries, totalContributors, totalPages, availableLanguages } = initialData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-900 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-300 text-xs font-mono mb-3">
            <Trophy className="w-3.5 h-3.5" />
            <span>Competitive Open Source • Global Rankings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-100 tracking-tight">
            GLOBAL CONTRIBUTORS
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl font-sans">
            Recognizing engineers solving the most valuable and difficult open-source challenges. Ranked strictly by authoritative verified RR Points earned through maintainer-merged pull requests.
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3 backdrop-blur-md">
          <div className="text-center px-2">
            <div className="text-xs font-mono text-slate-500 uppercase">Contributors</div>
            <div className="text-lg font-mono font-bold text-blue-400">{totalContributors} Active</div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center px-2">
            <div className="text-xs font-mono text-slate-500 uppercase">Points Source</div>
            <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PointsLedger Audited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search contributor username or name..."
            value={search}
            disabled={totalContributors === 0 && !search && !language}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={language}
            disabled={totalContributors === 0 && !search && !language}
            onChange={(e) => {
              setLanguage(e.target.value);
              updateUrlParams({ language: e.target.value, page: 1 });
            }}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Primary Languages</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          {(search || language) && (
            <button
              onClick={handleReset}
              className="text-xs text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* High-Density Leaderboard Table */}
      {isPending ? (
        <LoadingState type="table" count={5} />
      ) : entries.length === 0 ? (
        search || language ? (
          <EmptyState
            title="No matching contributors found"
            description="No contributors match your search criteria. Try clearing your search term or language filter."
            actionLabel="Reset Leaderboard Filters"
            onAction={handleReset}
          />
        ) : (
          <EmptyState
            title="NO VERIFIED CONTRIBUTORS YET"
            description="The leaderboard will appear once contributors complete and have a pull request verified by Repo Rescue."
            actionLabel="Explore Open Issues"
            onAction={() => router.push('/issues')}
          />
        )
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Rank</th>
                  <th className="py-4 px-6">Contributor</th>
                  <th className="py-4 px-6 text-right">RR Points</th>
                  <th className="py-4 px-6 text-center">Rescued</th>
                  <th className="py-4 px-6 text-center">Avg Difficulty</th>
                  <th className="py-4 px-6 text-center">Peak Difficulty</th>
                  <th className="py-4 px-6">Primary Language</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-mono text-xs">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="group hover:bg-slate-900/80 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <RankDisplay rank={entry.rank} size="sm" />
                    </td>

                    {/* Contributor Profile Info */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={entry.image}
                          alt={entry.name}
                          className="w-9 h-9 rounded-full border border-slate-700 bg-slate-900"
                        />
                        <div>
                          <Link
                            href={`/profile/${entry.githubUsername}`}
                            className="font-bold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{entry.name}</span>
                          </Link>
                          <span className="text-[11px] text-slate-500 font-normal">
                            @{entry.githubUsername}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* RR Points */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <PointsDisplay points={entry.totalPoints} highlight size="sm" />
                    </td>

                    {/* Rescued Issues Count */}
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/50">
                        {entry.rescuedCount} Issues
                      </span>
                    </td>

                    {/* Average RR Difficulty */}
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className="font-bold text-blue-400">
                        {entry.avgDifficulty.toFixed(1)} / 10
                      </span>
                    </td>

                    {/* Best / Peak RR Difficulty */}
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <DifficultyBadge score={entry.peakDifficulty} />
                    </td>

                    {/* Primary Language */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <LanguageTag language={entry.primaryLanguage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-900 bg-slate-950/90 flex items-center justify-between font-mono text-xs">
              <button
                disabled={page <= 1 || isPending}
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  updateUrlParams({ page: newPage });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="text-slate-400">
                Page <span className="text-slate-100 font-bold">{page}</span> of{' '}
                <span className="text-slate-100 font-bold">{totalPages}</span>
              </div>

              <button
                disabled={page >= totalPages || isPending}
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  setPage(newPage);
                  updateUrlParams({ page: newPage });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-all"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
