import React from 'react';
import { ContributorProfileResult } from '@/lib/leaderboard/service';
import { RankDisplay } from '@/components/ui/RankDisplay';
import { PointsDisplay } from '@/components/ui/PointsDisplay';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { ContributionStatus } from '@/components/ui/ContributionStatus';
import { LanguageTag } from '@/components/ui/LanguageTag';
import { GitHubLink } from '@/components/ui/GitHubLink';
import {
  ShieldCheck,
  Trophy,
  Sparkles,
  Building,
  MapPin,
  ArrowLeft,
  History,
  BarChart3,
  Layers,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface ContributorProfileViewProps {
  data: ContributorProfileResult;
}

export const ContributorProfileView: React.FC<ContributorProfileViewProps> = ({ data }) => {
  const { user, difficultyDistribution, languageBreakdown, ecosystemBreakdown, contributions, ledgerEntries } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Global Leaderboard</span>
        </Link>
        <span className="text-slate-600">Contributor ID: {user.id}</span>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <img
              src={user.image}
              alt={user.name}
              className="w-20 h-20 rounded-full border-2 border-slate-700 shadow-xl bg-slate-900"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100">{user.name}</h1>
                <RankDisplay rank={user.rank} size="sm" />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                <span className="font-semibold text-slate-300">@{user.githubUsername}</span>
                {user.company && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      {user.company}
                    </span>
                  </>
                )}
                {user.location && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {user.location}
                    </span>
                  </>
                )}
              </div>

              {user.bio && <p className="mt-2 text-xs text-slate-400 font-sans max-w-xl leading-relaxed">{user.bio}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PointsDisplay points={user.totalPoints} highlight size="lg" />
            <GitHubLink href={`https://github.com/${user.githubUsername}`} label="GitHub" size="md" />
          </div>
        </div>

        {/* 5 Competitive Statistics Cards */}
        <div className="pt-6 border-t border-slate-900 grid grid-cols-2 md:grid-cols-5 gap-4 font-mono">
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">RR Points</div>
            <div className="text-2xl font-black text-amber-400 mt-1">+{user.totalPoints}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Authoritative Sum</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Global Rank</div>
            <div className="text-2xl font-black text-blue-400 mt-1">#{user.rank}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Leaderboard Position</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Rescued Issues</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{user.totalRescued}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Verified Merged PRs</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Avg Difficulty</div>
            <div className="text-2xl font-black text-purple-400 mt-1">{user.avgDifficulty.toFixed(1)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Score Mean / 10.0</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Peak Difficulty</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{user.peakDifficulty.toFixed(1)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Best Solved Score</div>
          </div>
        </div>
      </div>

      {/* Grid: Difficulty Distribution + Languages & Ecosystems */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Difficulty Distribution Histogram (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-900 bg-slate-950/80 p-6 backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-4">
            <h2 className="text-base font-mono font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Completed Issue Difficulty Distribution
            </h2>
            <span className="text-xs font-mono text-slate-500">{user.totalRescued} Solved</span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {difficultyDistribution.map((dist) => (
              <div key={dist.bucket} className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Difficulty {dist.bucket}</span>
                  <span className="font-bold text-slate-200">
                    {dist.count} issues ({dist.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_#3b82f6]"
                    style={{ width: `${dist.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Languages & Ecosystems Representation (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-900 bg-slate-950/80 p-6 backdrop-blur-xl space-y-6">
          <div className="border-b border-slate-900 pb-4">
            <h2 className="text-base font-mono font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Languages & Ecosystems Solved
            </h2>
          </div>

          <div className="space-y-5 font-mono text-xs">
            <div>
              <div className="text-slate-500 text-[11px] uppercase mb-2">Primary Languages</div>
              <div className="space-y-2">
                {languageBreakdown.map((lb) => (
                  <div key={lb.language} className="flex items-center justify-between">
                    <LanguageTag language={lb.language} />
                    <span className="font-bold text-slate-300">{lb.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-900">
              <div className="text-slate-500 text-[11px] uppercase mb-2">Represented Ecosystems</div>
              <div className="flex flex-wrap gap-2">
                {ecosystemBreakdown.map((eb) => (
                  <span
                    key={eb.ecosystem}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs"
                  >
                    {eb.ecosystem} ({eb.count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Contribution History Timeline */}
      <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-emerald-400" />
              Verified Contribution History
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Timeline of merged pull requests verified by Repo Rescue
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold">{contributions.length} Verified</span>
        </div>

        {contributions.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No verified contributions recorded yet.
          </div>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            {contributions.map((c) => (
              <div
                key={c.id}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-900 bg-slate-950/90 hover:border-slate-800 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-semibold text-slate-200">{c.repoFullName}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">PR #{c.prNumber}</span>
                  </div>

                  <Link
                    href={c.issueUrl}
                    className="text-sm font-bold text-slate-100 hover:text-blue-400 transition-colors line-clamp-1"
                  >
                    {c.issueTitle}
                  </Link>

                  <div className="text-[11px] text-slate-500">Merged on {c.mergedAt}</div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
                  <DifficultyBadge score={c.rrDifficulty} />
                  <PointsDisplay points={c.rrPoints} highlight size="sm" />
                  <ContributionStatus status="MERGED_AND_AUDITED" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PointsLedger Audit History Table */}
      <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Auditable Points Ledger Transactions
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Immutable ledger trail verifying total balance of +{user.totalPoints} RR Points
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strict Ledger Balance</span>
          </span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {ledgerEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-900 bg-slate-950/90"
            >
              <div>
                <div className="font-semibold text-slate-200">{entry.reason}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  ID: {entry.id} • {new Date(entry.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-bold text-amber-400 text-sm">+{entry.amount} RR</div>
                <div className="text-slate-500 text-[11px]">Balance: {entry.balanceAfter} RR</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
