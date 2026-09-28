import React from 'react';
import {
  Shield,
  Sparkles,
  Trophy,
  GitPullRequest,
  CheckCircle2,
  ArrowRight,
  Code2,
  Zap,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { IssueCard } from '@/components/ui/IssueCard';
import { LeaderboardRow } from '@/components/ui/LeaderboardRow';
import { getFilteredIssues } from '@/lib/issues/service';
import { getLeaderboard } from '@/lib/leaderboard/service';
import { getPlatformStats } from '@/lib/stats/service';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  // Query live database records for featured issues, top contributors & platform stats
  const issuesData = await getFilteredIssues({ pageSize: 3, sortBy: 'difficulty_desc' });
  const leaderboardData = await getLeaderboard({ pageSize: 3 });
  const stats = await getPlatformStats();

  const featuredIssues = issuesData.issues;
  const topContributors = leaderboardData.entries;

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 lg:pt-36 pb-16 overflow-hidden">
        {/* Ambient Glow Backdrops */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[250px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-blue-400 mb-8 shadow-xl">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Competitive Open-Source Engineering • V1</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-mono font-black text-slate-100 tracking-tight leading-none">
            Codeforces for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Open-Source Issues
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-3xl mx-auto font-sans leading-relaxed">
            Discover real codebase challenges, conquer 8-factor evaluated difficulty scores, merge pull requests, and earn auditable <strong className="text-slate-200">RR Points</strong> on the global developer leaderboard.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/issues"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-sm shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all group"
            >
              <Search className="w-4 h-4" />
              <span>Explore Issues</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/leaderboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-mono font-semibold text-sm transition-all"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Global Leaderboard</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <StatCard title="Issues Listed" value={stats.issuesListed} icon={Shield} accentColor="blue" />
            <StatCard title="Total RR Points" value={stats.totalRRPoints} icon={Sparkles} accentColor="amber" />
            <StatCard title="Active Contributors" value={stats.activeContributors} icon={Code2} accentColor="purple" />
            <StatCard
              title="Avg Rescue Time"
              value={stats.avgRescueTime}
              icon={Zap}
              accentColor="emerald"
              subtitle={stats.avgRescueTime ? undefined : 'Awaiting first verified PR'}
            />
          </div>
        </div>
      </section>

      {/* Core Loop Section */}
      <section className="py-12 bg-slate-950/80 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
              Platform Core Loop
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-mono font-bold text-slate-100">
              How Repo Rescue Operates
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {[
              {
                step: '01',
                title: 'Discover Issue',
                desc: 'Filter by programming language, ecosystem, and maintainer responsiveness.',
                icon: Search,
              },
              {
                step: '02',
                title: 'Evaluate Difficulty',
                desc: 'Review 8-factor RR Difficulty score from 0.0 to 10.0 scale.',
                icon: Shield,
              },
              {
                step: '03',
                title: 'Solve & Submit PR',
                desc: 'Work on original GitHub repo and open resolving Pull Request.',
                icon: GitPullRequest,
              },
              {
                step: '04',
                title: 'Idempotent Verification',
                desc: 'Repo Rescue verifies maintainer merge event and identity.',
                icon: CheckCircle2,
              },
              {
                step: '05',
                title: 'Points & Ranking',
                desc: 'RR Points (Difficulty × 10) posted to immutable PointsLedger.',
                icon: Trophy,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-slate-900 bg-slate-950/90 hover:border-slate-800 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-3">
                    <span>STEP</span>
                    <span className="text-blue-400 font-bold">{item.step}</span>
                  </div>
                  <item.icon className="w-6 h-6 text-blue-400 mb-3" />
                  <h3 className="text-sm font-bold font-mono text-slate-200">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Issues Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
              Live Feed
            </span>
            <h2 className="text-2xl font-mono font-bold text-slate-100">Featured Open Issues</h2>
          </div>
          <Link href="/issues" className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold">
            <span>View All Issues</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {featuredIssues.length === 0 ? (
          <EmptyState
            title="No open issues listed"
            description="No active open-source issues available at the moment."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} variant="card" />
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard Teaser Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-2xl border border-slate-900 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
                Global Ranking
              </span>
              <h2 className="text-2xl font-mono font-bold text-slate-100">Top Rescuers</h2>
            </div>
            <Link href="/leaderboard" className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold">
              <span>Full Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topContributors.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/50 backdrop-blur-sm">
              <div className="p-3 rounded-full bg-slate-900 border border-slate-800 mb-3 text-slate-500 shadow-inner">
                <Trophy className="w-6 h-6 text-amber-500/60" />
              </div>
              <h3 className="text-base font-bold text-slate-200 font-mono">NO VERIFIED CONTRIBUTORS YET</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md">
                The leaderboard will appear once contributors complete and have a pull request verified by Repo Rescue.
              </p>
              <Link
                href="/issues"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-mono font-semibold text-white transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Explore Open Issues</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topContributors.map((contributor) => (
                <LeaderboardRow
                  key={contributor.id}
                  contributor={{
                    id: contributor.id,
                    name: contributor.name,
                    githubUsername: contributor.githubUsername,
                    image: contributor.image,
                    totalPoints: contributor.totalPoints,
                    rrRating: contributor.rrRating,
                    rank: contributor.rank,
                    rankTitle: contributor.rank === 1 ? 'Grandmaster' : contributor.rank === 2 ? 'Master' : 'Candidate Master',
                    issuesRescued: contributor.rescuedCount,
                    primaryLanguage: contributor.primaryLanguage,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
