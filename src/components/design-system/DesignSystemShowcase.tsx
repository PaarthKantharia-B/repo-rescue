'use client';

import React, { useState } from 'react';
import { RRScore } from '../ui/RRScore';
import { DifficultyBadge } from '../ui/DifficultyBadge';
import { IssueCard } from '../ui/IssueCard';
import { RepositoryCard } from '../ui/RepositoryCard';
import { ActivityIndicator } from '../ui/ActivityIndicator';
import { PointsDisplay } from '../ui/PointsDisplay';
import { RankDisplay } from '../ui/RankDisplay';
import { LeaderboardRow } from '../ui/LeaderboardRow';
import { TechnologyTag } from '../ui/TechnologyTag';
import { LanguageTag } from '../ui/LanguageTag';
import { ContributionStatus } from '../ui/ContributionStatus';
import { GitHubLink } from '../ui/GitHubLink';
import { FilterControls } from '../ui/FilterControls';
import { StatCard } from '../ui/StatCard';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { Issue, Repository, Contributor, FilterOptions } from '@/types';
import { Terminal, Shield, Sparkles, Layers, Sliders } from 'lucide-react';

export const DesignSystemShowcase: React.FC = () => {
  const [activeScore, setActiveScore] = useState<number>(7.8);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    language: '',
    ecosystem: '',
    minDifficulty: 0,
    maxDifficulty: 10,
    minMaintainerActivity: 0,
    repoType: '',
    sortBy: 'difficulty_desc',
  });

  const sampleRepo: Repository = {
    id: 'repo-1',
    githubId: 102938,
    name: 'react',
    fullName: 'facebook/react',
    owner: 'facebook',
    description: 'The library for web and native user interfaces.',
    url: 'https://github.com/facebook/react',
    language: 'TypeScript',
    starsCount: 228000,
    forksCount: 45000,
    openIssuesCount: 640,
    ecosystem: 'Node.js',
    repoType: 'FRAMEWORK',
    maintainerActivityScore: 9.2,
  };

  const sampleIssue: Issue = {
    id: 'issue-101',
    githubId: 991203,
    githubNumber: 28412,
    repository: sampleRepo,
    title: 'Concurrent Mode hydration mismatch error when streaming server components with custom suspense boundary',
    body: 'Investigate and resolve hydration mismatch occurring during streaming RSC rendering under heavy concurrent load.',
    url: 'https://github.com/facebook/react/issues/28412',
    status: 'OPEN',
    labels: ['component: scheduler', 'type: bug', 'difficulty: hard'],
    language: 'TypeScript',
    ecosystem: 'Node.js',
    authorUsername: 'gaearon',
    rrDifficulty: activeScore,
    createdAt: '2026-09-18T10:00:00Z',
  };

  const sampleContributor: Contributor = {
    id: 'user-1',
    name: 'Dan Abramov',
    githubUsername: 'gaearon',
    image: 'https://avatars.githubusercontent.com/u/810438?v=4',
    totalPoints: 3420,
    rrRating: 2450,
    rank: 1,
    rankTitle: 'Grandmaster',
    issuesRescued: 42,
    primaryLanguage: 'TypeScript',
  };

  return (
    <section id="design-system" className="py-16 border-t border-slate-900 bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-xs font-mono mb-2">
              <Terminal className="w-3.5 h-3.5" />
              <span>System Components</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
              Repo Rescue Design System
            </h2>
            <p className="mt-1 text-slate-400 text-sm max-w-2xl font-sans">
              16 core reusable UI components adhering to GitHub × Linear × Competitive Platform aesthetics.
            </p>
          </div>

          {/* Interactive Score Slider */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-mono text-slate-400">Live RR Score Test:</span>
            <input
              type="range"
              min="0.0"
              max="10.0"
              step="0.1"
              value={activeScore}
              onChange={(e) => setActiveScore(parseFloat(e.target.value))}
              className="w-32 accent-blue-500 cursor-pointer"
            />
            <span className="text-sm font-mono font-bold text-blue-400 w-8">{activeScore.toFixed(1)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: Scores & Badges */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/80 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              1. Scores & Difficulty Badges
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <RRScore score={activeScore} size="sm" showBar />
              <RRScore score={activeScore} size="md" showBar />
              <RRScore score={activeScore} size="lg" showBar />
              <RRScore score={activeScore} size="xl" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge score={2.0} />
              <DifficultyBadge score={5.0} />
              <DifficultyBadge score={7.5} />
              <DifficultyBadge score={9.0} />
              <DifficultyBadge score={9.8} />
            </div>
          </div>

          {/* Section 2: Points & Ranks */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/80 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              2. Points & Ranks
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <PointsDisplay points={Math.round(activeScore * 10)} size="sm" />
              <PointsDisplay points={Math.round(activeScore * 10)} size="md" highlight />
              <PointsDisplay points={Math.round(activeScore * 10)} size="lg" highlight />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RankDisplay rank={1} rankTitle="Grandmaster" />
              <RankDisplay rank={2} rankTitle="Master" />
              <RankDisplay rank={3} rankTitle="Candidate Master" />
              <RankDisplay rank={42} rankTitle="Specialist" />
            </div>
          </div>

          {/* Section 3: Tags & Indicators */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/80 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              3. Tags, Indicators & Links
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <LanguageTag language="TypeScript" />
              <LanguageTag language="Rust" />
              <LanguageTag language="Python" />
              <LanguageTag language="Go" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TechnologyTag technology="Node.js" />
              <TechnologyTag technology="PyTorch" />
              <TechnologyTag technology="Rust/Cargo" />
              <TechnologyTag technology="Kubernetes" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ActivityIndicator score={9.2} />
              <ActivityIndicator score={5.0} />
              <ActivityIndicator score={2.1} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ContributionStatus status="MERGED_AND_AUDITED" />
              <ContributionStatus status="IN_REVIEW" />
              <ContributionStatus status="CLAIMED" />
            </div>

            <div className="pt-2">
              <GitHubLink href="https://github.com/facebook/react" label="facebook/react" />
            </div>
          </div>

          {/* Section 4: StatCard Component */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/80 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              4. Stat Cards
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Issues Rescued"
                value={1420}
                icon={Shield}
                trend="18.2% this week"
                accentColor="blue"
              />
              <StatCard
                title="RR Points Awarded"
                value={142000}
                icon={Sparkles}
                trend="4,200 today"
                accentColor="amber"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Complex Cards & Filter Showcase */}
        <div className="mt-8 space-y-8">
          <div>
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
              5. Interactive Filter Controls
            </h3>
            <FilterControls filters={filters} onChange={setFilters} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
                6. Issue Card
              </h3>
              <IssueCard issue={sampleIssue} />
            </div>

            <div>
              <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
                7. Repository Card
              </h3>
              <RepositoryCard repository={sampleRepo} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
              8. Leaderboard Row
            </h3>
            <LeaderboardRow contributor={sampleContributor} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
                9. Empty State
              </h3>
              <EmptyState onAction={() => alert('Filter reset clicked')} />
            </div>

            <div>
              <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
                10. Loading Skeleton State
              </h3>
              <LoadingState type="table" count={2} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
