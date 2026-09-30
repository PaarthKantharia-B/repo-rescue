'use client';

import React, { useState } from 'react';
import { ContributionAnalyticsData, VerifiedCapability, ContributionHistoryItem, TimeSeriesPoint } from '@/lib/analytics/contribution-analytics-service';
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
  Search,
  Filter,
  UserCheck,
  Code2,
  FileCode,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  Award,
  Zap,
  Activity,
  Cpu,
  Database,
  Terminal,
  Compass,
  Briefcase,
  Sliders,
  BarChart2,
  TrendingUp,
  Flame,
  Check,
  Info,
} from 'lucide-react';
import Link from 'next/link';

interface ActivityChartProps {
  timeSeriesPoints: TimeSeriesPoint[];
  metric: 'contributions' | 'points' | 'issuesSolved' | 'prsMerged' | 'avgRating';
  timeRange: '7D' | '30D' | '3M' | '6M' | '1Y' | 'ALL';
}

/**
 * Dedicated 3-State Contribution Activity Chart Component
 * State 1: 0 Points -> Honest Empty State
 * State 2: 1 Point  -> Single Point Centered State (No solid rectangle!)
 * State 3: 2+ Points -> Polished SVG Time-Series Line Chart
 */
const ContributionActivityChart: React.FC<ActivityChartProps> = ({ timeSeriesPoints, metric, timeRange }) => {
  const formatDateFull = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getMetricLabel = (m: string, val: number) => {
    if (m === 'contributions') return val === 1 ? 'verified contribution' : 'verified contributions';
    if (m === 'points') return 'RR Points';
    if (m === 'issuesSolved') return val === 1 ? 'issue solved' : 'issues solved';
    if (m === 'prsMerged') return val === 1 ? 'PR merged' : 'PRs merged';
    if (m === 'avgRating') return 'RR Rating';
    return 'contributions';
  };

  // STATE 1: ZERO DATA POINTS
  if (timeSeriesPoints.length === 0) {
    return (
      <div className="py-12 px-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center space-y-4 font-mono">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500 shadow-xl">
          <Activity className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-200">No contribution activity yet</h3>
          <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
            Your verified contribution activity for the selected timeframe ({timeRange}) will appear here once contributions are recorded.
          </p>
        </div>
        <div className="pt-1">
          <Link
            href="/issues"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Explore Issues</span>
          </Link>
        </div>
      </div>
    );
  }

  // STATE 2: EXACTLY ONE DATA POINT
  if (timeSeriesPoints.length === 1) {
    const singlePt = timeSeriesPoints[0];
    const val = singlePt[metric];
    const formattedDate = formatDateFull(singlePt.date);
    const metricLabelStr = getMetricLabel(metric, val);

    return (
      <div className="py-10 px-6 rounded-2xl border border-slate-800 bg-slate-900/40 text-center font-mono space-y-4 shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-2">
          {/* Centered Single Point Node */}
          <div className="relative flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-blue-400 border-4 border-slate-950 shadow-[0_0_15px_rgba(59,130,246,0.9)] animate-pulse z-10" />
            <div className="absolute w-8 h-8 rounded-full bg-blue-500/20 animate-ping" />
          </div>
          <div className="w-0.5 h-10 bg-gradient-to-b from-blue-500/60 via-blue-500/20 to-transparent" />
        </div>

        <div className="space-y-1">
          <div className="text-base font-extrabold text-slate-100">{formattedDate}</div>
          <div className="text-xs font-bold text-emerald-400">
            {val} {metricLabelStr} recorded
          </div>
        </div>

        <p className="text-xs text-slate-400 font-sans max-w-xs mx-auto leading-relaxed">
          More activity will appear here as your contribution history grows.
        </p>
      </div>
    );
  }

  // STATE 3: TWO OR MORE DATA POINTS (SVG TIME-SERIES LINE CHART)
  const svgWidth = 800;
  const svgHeight = 220;
  const paddingTop = 25;
  const paddingBottom = 40;
  const paddingLeft = 45;
  const paddingRight = 25;

  const drawWidth = svgWidth - paddingLeft - paddingRight;
  const drawHeight = svgHeight - paddingTop - paddingBottom;

  const values = timeSeriesPoints.map((pt) => pt[metric]);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const valRange = maxVal - minVal || 1;

  const points = timeSeriesPoints.map((pt, i) => {
    const x = paddingLeft + (i / (timeSeriesPoints.length - 1)) * drawWidth;
    const y = paddingTop + (1 - (pt[metric] - minVal) / valRange) * drawHeight;
    return { x, y, pt, val: pt[metric] };
  });

  const lineD = points.reduce((acc, p, i) => {
    return `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');

  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${svgHeight - paddingBottom} L ${points[0].x.toFixed(1)} ${svgHeight - paddingBottom} Z`;

  const numTicks = Math.min(timeSeriesPoints.length, 5);
  const tickIndices = Array.from({ length: numTicks }, (_, i) => {
    return Math.round((i / (numTicks - 1)) * (timeSeriesPoints.length - 1));
  });

  return (
    <div className="space-y-2">
      <div className="w-full h-56 relative bg-slate-900/30 rounded-2xl border border-slate-800/80 p-2 overflow-hidden shadow-inner">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full font-mono select-none">
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Low-opacity Grid Lines & Y-axis Labels */}
          {[0, 0.5, 1].map((pct, idx) => {
            const yVal = paddingTop + (1 - pct) * drawHeight;
            const labelVal = Math.round((minVal + pct * valRange) * 10) / 10;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={yVal}
                  x2={svgWidth - paddingRight}
                  y2={yVal}
                  className="stroke-slate-800/60 stroke-1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={yVal + 3}
                  textAnchor="end"
                  className="fill-slate-600 text-[10px]"
                >
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Gradient Area Fill Under Line */}
          <path d={areaD} fill="url(#chartAreaGradient)" />

          {/* Thin Line */}
          <path d={lineD} fill="none" className="stroke-blue-400 stroke-2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points with Hover Tooltips */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                className="fill-blue-400 stroke-slate-950 stroke-2 group-hover:r-6 transition-all shadow-md"
              />
              <g className="opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-30">
                <rect
                  x={Math.max(10, Math.min(svgWidth - 150, p.x - 70))}
                  y={Math.max(5, p.y - 38)}
                  width={140}
                  height={28}
                  rx={6}
                  className="fill-slate-950 stroke-slate-700 stroke-1 shadow-2xl"
                />
                <text
                  x={Math.max(10, Math.min(svgWidth - 150, p.x - 70)) + 70}
                  y={Math.max(5, p.y - 38) + 18}
                  textAnchor="middle"
                  className="fill-slate-100 text-[10px] font-bold"
                >
                  {p.val} {getMetricLabel(metric, p.val)} ({formatDateShort(p.pt.date)})
                </text>
              </g>
            </g>
          ))}

          {/* X-axis Line */}
          <line
            x1={paddingLeft}
            y1={svgHeight - paddingBottom}
            x2={svgWidth - paddingRight}
            y2={svgHeight - paddingBottom}
            className="stroke-slate-800 stroke-1"
          />

          {/* X-axis Date Labels */}
          {tickIndices.map((tIdx, i) => {
            const pt = points[tIdx];
            if (!pt) return null;
            return (
              <text
                key={i}
                x={pt.x}
                y={svgHeight - paddingBottom + 18}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {formatDateShort(pt.pt.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface Props {
  data: ContributionAnalyticsData;
}

export const ContributionAnalyticsView: React.FC<Props> = ({ data }) => {
  const {
    user,
    timeSeries,
    contributionTypes,
    technicalAreas,
    difficultyDistribution,
    qualityAnalytics,
    capabilities,
    technologies,
    repoFootprint,
    impactCategories,
    history,
    dnaSummary,
    benchmark,
    hasData,
  } = data;

  // Time Series Chart State
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '3M' | '6M' | '1Y' | 'ALL'>('30D');
  const [chartMetric, setChartMetric] = useState<'contributions' | 'points' | 'issuesSolved' | 'prsMerged' | 'avgRating'>('contributions');

  // Capability Evidence Drawer State
  const [selectedCapability, setSelectedCapability] = useState<VerifiedCapability | null>(null);

  // Contribution History Filters & Search State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyRepoFilter, setHistoryRepoFilter] = useState<string>('ALL');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('ALL');

  // Approach Editing / Live AI PR Diff Analyzer State
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [approachText, setApproachText] = useState<string>('');
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);

  // Time Series Filtered Points based on real timestamp cutoff
  const filteredTimeSeries = timeSeries.filter((pt) => {
    if (timeRange === 'ALL') return true;
    const now = Date.now();
    const ptTime = pt.timestamp;
    const days = (now - ptTime) / (1000 * 60 * 60 * 24);
    if (timeRange === '7D') return days <= 7;
    if (timeRange === '30D') return days <= 30;
    if (timeRange === '3M') return days <= 90;
    if (timeRange === '6M') return days <= 180;
    if (timeRange === '1Y') return days <= 365;
    return true;
  });

  // Filtered History Pipeline
  const filteredHistory = history.filter((item) => {
    if (historyRepoFilter !== 'ALL' && item.repoFullName !== historyRepoFilter) return false;
    if (historyCategoryFilter !== 'ALL' && item.category !== historyCategoryFilter) return false;

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      const matchTitle = item.issueTitle.toLowerCase().includes(q);
      const matchRepo = item.repoFullName.toLowerCase().includes(q);
      const matchOrg = item.orgName.toLowerCase().includes(q);
      const matchLang = item.language.toLowerCase().includes(q);
      if (!matchTitle && !matchRepo && !matchOrg && !matchLang) return false;
    }

    return true;
  });

  const handleOpenEdit = async (c: ContributionHistoryItem) => {
    setEditingContribId(c.id);
    if (c.approach) {
      setApproachText(c.approach);
    } else {
      await handleRegenerateDiff(c);
    }
  };

  const handleRegenerateDiff = async (c: ContributionHistoryItem) => {
    setIsAnalyzingAi(true);
    setEditingContribId(c.id);
    try {
      const res = await fetch(`/api/contributions/${c.id}/approach?refresh=true`);
      const resData = await res.json();
      if (resData.approach) {
        setApproachText(resData.approach);
        c.approach = resData.approach;
      }
    } catch (err) {
      console.error('Error running live GitHub PR diff analysis:', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSaveApproach = async (id: string) => {
    try {
      await fetch(`/api/contributions/${id}/approach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approach: approachText }),
      });
      const target = history.find((h) => h.id === id);
      if (target) target.approach = approachText;
      setEditingContribId(null);
    } catch (err) {
      console.error('Failed to save approach narrative:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 font-sans text-slate-100">
      {/* Page Navigation Breadcrumb */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Global Leaderboard</span>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-blue-400 font-bold">Contribution Analytics</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Authentic Proof-of-Work Intelligence</span>
        </div>
      </div>

      {/* 1. PAGE IDENTITY & TOP HERO / CONTRIBUTION OVERVIEW */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Contributor Identity */}
          <div className="flex items-center gap-5">
            <img
              src={user.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
              alt={user.name}
              className="w-20 h-20 rounded-2xl border-2 border-slate-800 shadow-2xl bg-slate-900 object-cover"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-mono font-extrabold text-slate-100 tracking-tight">{user.name}</h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Verified Contributor
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs font-mono text-slate-400">
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
              <p className="mt-2 text-xs text-slate-400 font-sans max-w-xl">
                Understand what your open-source contributions prove about you.
              </p>
            </div>
          </div>

          {/* Action Header Links */}
          <div className="flex items-center gap-3">
            <GitHubLink href={`https://github.com/${user.githubUsername}`} label="GitHub Profile" size="md" />
          </div>
        </div>

        {/* 5 Primary Prominent Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 font-mono">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-xl space-y-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Verified Contributions</div>
            <div className="text-3xl font-black text-emerald-400">{user.verifiedContributionsCount}</div>
            <div className="text-[10px] text-slate-500">Audited Merged PRs</div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-xl space-y-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Repositories</div>
            <div className="text-3xl font-black text-blue-400">{user.repositoriesCount}</div>
            <div className="text-[10px] text-slate-500">Distinct Codebases</div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-xl space-y-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">RR Points</div>
            <div className="text-3xl font-black text-amber-400">+{user.totalPoints}</div>
            <div className="text-[10px] text-slate-500">Authoritative Points</div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-xl space-y-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Avg RR Rating</div>
            <div className="text-3xl font-black text-purple-400">{user.avgRrRating > 0 ? user.avgRrRating.toFixed(1) : 'N/A'}</div>
            <div className="text-[10px] text-slate-500">Score Out of 10.0</div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-xl space-y-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Avg Difficulty</div>
            <div className="text-3xl font-black text-rose-400">{user.avgDifficulty > 0 ? user.avgDifficulty.toFixed(1) : 'N/A'}</div>
            <div className="text-[10px] text-slate-500">Complexity Index</div>
          </div>
        </div>
      </div>

      {!hasData ? (
        /* AUTHENTIC EMPTY STATE FOR NEW CONTRIBUTORS */
        <div className="p-16 rounded-3xl border border-dashed border-slate-800 bg-slate-950/60 backdrop-blur-xl text-center space-y-5 max-w-2xl mx-auto my-12 font-mono">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-xl">
            <GitPullRequest className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-100">Your contribution story starts here.</h2>
            <p className="text-sm text-slate-400 font-sans max-w-md mx-auto leading-relaxed">
              Connect GitHub and merge your first verified contribution to start building your Repo Rescue intelligence profile.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/issues"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Open Issues</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 2. CONTRIBUTION ACTIVITY TIME-SERIES CHART */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-6">
              <div>
                <h2 className="text-xl font-mono font-extrabold text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Contribution Activity
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Historical progression of verified contributions over time
                </p>
              </div>

              {/* Chart Controls */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {/* Metric Selector */}
                <select
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value as any)}
                  aria-label="Select contribution metric to display"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="contributions">Contributions</option>
                  <option value="points">RR Points</option>
                  <option value="issuesSolved">Issues Solved</option>
                  <option value="prsMerged">PRs Merged</option>
                  <option value="avgRating">RR Rating</option>
                </select>

                {/* Time Range Pills */}
                <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                  {(['7D', '30D', '3M', '6M', '1Y', 'ALL'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded-lg transition-all text-xs font-bold ${
                        timeRange === range
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Render 3-State Chart Engine */}
            <ContributionActivityChart
              timeSeriesPoints={filteredTimeSeries}
              metric={chartMetric}
              timeRange={timeRange}
            />
          </div>

          {/* 3. CONTRIBUTION DNA SECTION */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
            <div>
              <h2 className="text-xl font-mono font-extrabold text-slate-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                Contribution DNA
              </h2>
              <p className="text-xs text-slate-400 font-sans mt-1">
                A breakdown of the engineering work you actually do derived from verified contribution analysis
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono text-xs">
              {/* Contribution Types */}
              <div className="space-y-4 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Contribution Types</span>
                  <span className="text-slate-500 text-[10px]">Work Categorization</span>
                </div>
                <div className="space-y-3">
                  {contributionTypes.map((ct) => (
                    <div key={ct.name} className="space-y-1.5">
                      <div className="flex justify-between text-slate-300">
                        <span className="font-semibold">{ct.name}</span>
                        <span className="font-bold text-blue-400">{ct.count} ({ct.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${ct.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Areas */}
              <div className="space-y-4 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Technical Domains</span>
                  <span className="text-slate-500 text-[10px]">Systems & Architecture</span>
                </div>
                <div className="space-y-3">
                  {technicalAreas.map((ta) => (
                    <div key={ta.name} className="space-y-1.5">
                      <div className="flex justify-between text-slate-300">
                        <span className="font-semibold">{ta.name}</span>
                        <span className="font-bold text-emerald-400">{ta.count} ({ta.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${ta.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4 & 5. DIFFICULTY DISTRIBUTION & QUALITY ANALYTICS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Difficulty Distribution (7 Cols) */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-400" />
                  Contribution Difficulty
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Distribution of verified contributions categorized by composite RR difficulty
                </p>
              </div>

              {/* Difficulty Buckets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/40">
                  <div className="text-[10px] text-slate-500 uppercase">Easy (0–3)</div>
                  <div className="text-xl font-black text-blue-400 mt-1">{difficultyDistribution.easyCount}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/40">
                  <div className="text-[10px] text-slate-500 uppercase">Moderate (3–6)</div>
                  <div className="text-xl font-black text-emerald-400 mt-1">{difficultyDistribution.moderateCount}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/40">
                  <div className="text-[10px] text-slate-500 uppercase">Hard (6–8.5)</div>
                  <div className="text-xl font-black text-purple-400 mt-1">{difficultyDistribution.hardCount}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/40">
                  <div className="text-[10px] text-slate-500 uppercase">Very Hard (8.5+)</div>
                  <div className="text-xl font-black text-rose-400 mt-1">{difficultyDistribution.veryHardCount}</div>
                </div>
              </div>

              {/* Metrics & Insight */}
              <div className="pt-4 border-t border-slate-900 grid grid-cols-3 gap-4 font-mono text-xs text-center">
                <div>
                  <div className="text-slate-500 text-[10px]">Average</div>
                  <div className="text-slate-200 font-bold text-base mt-0.5">{difficultyDistribution.avgDifficulty.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Median</div>
                  <div className="text-slate-200 font-bold text-base mt-0.5">{difficultyDistribution.medianDifficulty.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Peak Solved</div>
                  <div className="text-slate-200 font-bold text-base mt-0.5">{difficultyDistribution.peakDifficulty.toFixed(1)}</div>
                </div>
              </div>

              {difficultyDistribution.trendInsight && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-sans flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold font-mono">Data Insight: </span>
                    {difficultyDistribution.trendInsight}
                  </div>
                </div>
              )}
            </div>

            {/* Quality Analytics & RR Rating (5 Cols) */}
            <div className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Contribution Quality
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Derived from codebase complexity, testing rigor, and maintainer audit
                </p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-amber-400 uppercase font-bold">Average RR Rating</div>
                    <div className="text-3xl font-black text-amber-300 mt-1">{qualityAnalytics.avgRating.toFixed(1)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Highly-Rated (≥7.5)</div>
                    <div className="text-xl font-bold text-slate-200 mt-1">{qualityAnalytics.highlyRatedCount} contributions</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Median Rating</div>
                    <div className="text-slate-200 font-bold text-sm mt-0.5">{qualityAnalytics.medianRating.toFixed(1)}</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Highest Rating</div>
                    <div className="text-slate-200 font-bold text-sm mt-0.5">{qualityAnalytics.highestRating.toFixed(1)}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] font-sans text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300 font-mono">How RR Rating Works: </span>
                  Unlike arbitrary popularity metrics, RR Rating evaluates the technical depth, codebase scope, and audit verification of merged PRs.
                </div>
              </div>
            </div>
          </div>

          {/* 6. VERIFIED CAPABILITIES (KEY DIFFERENTIATOR) */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
              <div>
                <h2 className="text-xl font-mono font-extrabold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  Verified Capabilities
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Skills demonstrated through real open-source contributions. <span className="font-bold text-slate-300">Don&apos;t tell people what you know. Show them what you&apos;ve actually built.</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {capabilities.map((cap) => (
                <div
                  key={cap.id}
                  onClick={() => setSelectedCapability(cap)}
                  className="group p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-blue-500/50 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-sm group-hover:text-blue-400 transition-colors">
                      {cap.name}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                      {cap.count} {cap.count === 1 ? 'contribution' : 'contributions'}
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_#3b82f6]"
                      style={{ width: `${cap.percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Click to view supporting contribution evidence</span>
                    <ExternalLink className="w-3.5 h-3.5 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CAPABILITY EVIDENCE DRAWER / MODAL */}
          {selectedCapability && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      {selectedCapability.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      {selectedCapability.count} verified contribution evidence records supporting this capability
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCapability(null)}
                    aria-label="Close capability evidence modal"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedCapability.contributions.map((c) => (
                    <div key={c.id} className="p-5 rounded-2xl border border-slate-900 bg-slate-900/50 space-y-3">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-slate-200">{c.repoFullName}</span>
                        <span className="text-emerald-400 font-bold">PR #{c.prNumber}</span>
                      </div>

                      <div className="text-sm font-bold text-slate-100 font-sans">{c.issueTitle}</div>

                      {c.approach && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-300 font-sans text-xs whitespace-pre-line leading-relaxed">
                          {c.approach}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-900">
                        <DifficultyBadge score={c.rrDifficulty} />
                        <PointsDisplay points={c.rrPoints} highlight size="sm" />
                        <a
                          href={c.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1 font-bold"
                        >
                          <span>View GitHub PR</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7 & 8. TECHNOLOGIES USED & REPOSITORY FOOTPRINT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Technologies Used (5 Cols) */}
            <div className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-blue-400" />
                  Technologies Used
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Verified strictly through merged open-source contributions
                </p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold mb-3">Primary Languages</div>
                  <div className="space-y-2.5">
                    {technologies.languages.map((lang) => (
                      <div key={lang.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <LanguageTag language={lang.name} />
                        <span className="font-bold text-slate-200">{lang.count} ({lang.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-900">
                  <div className="text-slate-500 text-[10px] uppercase font-bold mb-3">Frameworks & Technical Ecosystems</div>
                  <div className="flex flex-wrap gap-2">
                    {technologies.frameworks.map((fw) => (
                      <span key={fw.name} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                        {fw.name} ({fw.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Repository Footprint (7 Cols) */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                <div>
                  <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    Repository Footprint
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Ranked list of repositories contributed to
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">{repoFootprint.length} Repos</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {repoFootprint.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => setHistoryRepoFilter(historyRepoFilter === repo.fullName ? 'ALL' : repo.fullName)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      historyRepoFilter === repo.fullName
                        ? 'bg-blue-500/10 border-blue-500/50 shadow-lg'
                        : 'bg-slate-900/40 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <span>{repo.fullName}</span>
                        {historyRepoFilter === repo.fullName && (
                          <span className="text-[10px] text-blue-400 font-normal">(Filtered)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{repo.orgName}</span>
                        <span>•</span>
                        <span>{repo.language}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-400 text-base">{repo.contributionCount} PRs</div>
                      <div className="text-slate-500 text-[10px]">Avg Diff: {repo.avgDifficulty.toFixed(1)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 9 & 10. CONTRIBUTION HISTORY (THE EVIDENCE LAYER) */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-6">
              <div>
                <h2 className="text-xl font-mono font-extrabold text-slate-100 flex items-center gap-2">
                  <GitPullRequest className="w-6 h-6 text-emerald-400" />
                  Contribution History
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  The evidence layer: Detailed problem statements, technical approaches, and merged PR proof
                </p>
              </div>

              {/* History Search & Filters */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Clear Repo Filter if active */}
                {historyRepoFilter !== 'ALL' && (
                  <button
                    onClick={() => setHistoryRepoFilter('ALL')}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1"
                  >
                    <span>Repo: {historyRepoFilter}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* History Evidence Cards Grid */}
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                No contribution history records match your search filter.
              </div>
            ) : (
              <div className="space-y-6">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 font-mono text-xs backdrop-blur-xl shadow-xl hover:border-slate-700 transition-all"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        {item.isPartner ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold text-[11px] flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Partner Org
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 text-[11px] flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-500" />
                            Open Source
                          </span>
                        )}
                        <span className="font-bold text-slate-200 text-sm">{item.repoFullName}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <DifficultyBadge score={item.rrDifficulty} />
                        <PointsDisplay points={item.rrPoints} highlight size="sm" />
                      </div>
                    </div>

                    {/* Problem & Issue Title */}
                    <div className="space-y-1.5 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-100">{item.issueTitle}</h3>
                        {item.prUrl && (
                          <a
                            href={item.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono shrink-0"
                          >
                            <span>PR #{item.prNumber}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {item.issueBody && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          <span className="font-mono font-bold text-slate-300">Problem Statement: </span>
                          {item.issueBody}
                        </p>
                      )}
                    </div>

                    {/* Approach & Diff Section */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3 font-sans">
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 font-mono text-xs">
                        <div className="font-bold text-blue-400 flex items-center gap-1.5">
                          <Code2 className="w-4 h-4 text-blue-400" />
                          <span>Technical Approach & Live Diff Analysis</span>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Inspect Live PR Diff</span>
                        </button>
                      </div>

                      {editingContribId === item.id ? (
                        <div className="space-y-3 pt-2 font-mono text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-300">Edit Technical Approach:</span>
                            {isAnalyzingAi && <span className="text-blue-400 animate-pulse">(Analyzing live PR files & diffs...)</span>}
                          </div>
                          <textarea
                            rows={6}
                            value={approachText}
                            onChange={(e) => setApproachText(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono leading-relaxed"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingContribId(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveApproach(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save Narrative
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                          {item.approach || 'No custom approach written yet. Click "Inspect Live PR Diff" to auto-analyze PR diffs.'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 11 & 12. YOUR CONTRIBUTION DNA SUMMARY & GLOBAL BENCHMARK */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* DNA Summary Card (6 Cols) */}
            <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  Your Contribution DNA
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Data-backed summary derived strictly from verified open-source contributions
                </p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[10px] uppercase">Primary Focus</div>
                  <div className="text-lg font-bold text-blue-400">{dnaSummary.primaryFocus}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[10px] uppercase">Secondary Focus</div>
                  <div className="text-lg font-bold text-purple-400">{dnaSummary.secondaryFocus}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="text-slate-500 text-[10px] uppercase">Typical Work</div>
                  <div className="flex flex-wrap gap-2">
                    {dnaSummary.typicalWork.map((tw) => (
                      <span key={tw} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                        {tw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Global Benchmark (6 Cols) */}
            <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-emerald-400" />
                  Contribution Benchmark
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Comparing your profile relative to the broader Repo Rescue dataset
                </p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Your Average RR Rating</span>
                    <span className="font-bold text-emerald-400">{benchmark.userAvgRating.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-900 pt-2 text-slate-500 text-[11px]">
                    <span>Repo Rescue Community Average</span>
                    <span>{benchmark.globalAvgRating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Your Average Difficulty</span>
                    <span className="font-bold text-purple-400">{benchmark.userAvgDifficulty.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-900 pt-2 text-slate-500 text-[11px]">
                    <span>Repo Rescue Community Average</span>
                    <span>{benchmark.globalAvgDifficulty.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
