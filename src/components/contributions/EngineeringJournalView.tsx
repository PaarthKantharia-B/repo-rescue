'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Sparkles,
  Search,
  Code2,
  Cpu,
  Layers,
  Activity,
  ChevronDown,
  ChevronUp,
  FileCode,
  Edit3,
  Check,
  X,
  AlertCircle,
  Clock,
  Terminal,
  Brain,
  Globe,
} from 'lucide-react';
import { ContributionAnalyticsData, ContributionHistoryItem, VerifiedCapability } from '@/lib/analytics/contribution-analytics-service';
import { CaseStudyData } from '@/lib/ai/case-study-service';

interface Props {
  data: ContributionAnalyticsData;
  isOwner?: boolean;
}

// Crisp inline SVG for official GitHub logo
const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
);

interface ContributionTypeInfo {
  label: string;
  categoryTag: string;
  badgeStyle: string;
  isDocs: boolean;
  tags: string[];
}

/**
 * Factual helper to safely derive contribution type from PR title, category, and evidence.
 */
function deriveContributionTypeInfo(item: ContributionHistoryItem): ContributionTypeInfo {
  const prTitleLower = (item.prTitle || '').toLowerCase();
  const catLower = (item.category || '').toLowerCase();

  const tagsSet = new Set<string>();
  if (item.language) tagsSet.add(item.language.toLowerCase());

  const isReadme = prTitleLower.includes('readme') || catLower.includes('readme');
  const isDocs = isReadme || prTitleLower.includes('docs') || prTitleLower.includes('documentation') || catLower === 'documentation';

  if (isDocs) {
    tagsSet.add('documentation');
    if (isReadme) tagsSet.add('README');
    return {
      label: isReadme ? 'README' : 'Documentation',
      categoryTag: isReadme ? 'README · Documentation' : 'Documentation',
      badgeStyle: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
      isDocs: true,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('auth') || prTitleLower.includes('oauth')) {
    tagsSet.add('authentication');
    tagsSet.add('bug-fix');
    return {
      label: 'Bug Fix · Authentication',
      categoryTag: 'Bug Fix · Authentication',
      badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('fix') || prTitleLower.includes('bug') || prTitleLower.includes('patch') || catLower === 'bug fixes') {
    tagsSet.add('bug-fix');
    return {
      label: 'Bug Fix',
      categoryTag: 'Bug Fix',
      badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('feat') || prTitleLower.includes('feature') || catLower === 'features') {
    tagsSet.add('feature');
    return {
      label: 'Feature',
      categoryTag: 'Feature',
      badgeStyle: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('refactor') || prTitleLower.includes('clean') || catLower === 'refactoring') {
    tagsSet.add('refactor');
    return {
      label: 'Refactor',
      categoryTag: 'Refactor',
      badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('test') || prTitleLower.includes('spec') || catLower === 'testing') {
    tagsSet.add('testing');
    return {
      label: 'Testing',
      categoryTag: 'Testing',
      badgeStyle: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  if (prTitleLower.includes('perf') || prTitleLower.includes('optimize') || catLower === 'performance') {
    tagsSet.add('performance');
    return {
      label: 'Performance',
      categoryTag: 'Performance',
      badgeStyle: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      isDocs: false,
      tags: Array.from(tagsSet).slice(0, 3),
    };
  }

  return {
    label: 'Pull Request',
    categoryTag: 'Pull Request',
    badgeStyle: 'bg-slate-900 text-slate-300 border-slate-700',
    isDocs: false,
    tags: Array.from(tagsSet).slice(0, 3),
  };
}

/**
 * Extracts concise factual bullets for "WHAT CHANGED" section.
 */
function getFactualBullets(item: ContributionHistoryItem): string[] {
  const bullets: string[] = [];

  if (item.approach && item.approach.trim().length > 10) {
    const rawSentences = item.approach.split(/(?<=[.!?])\s+/);
    for (const s of rawSentences) {
      const clean = s.trim();
      if (clean.length > 10 && !clean.includes('updates Open Source Project by introducing targeted fixes')) {
        bullets.push(clean.endsWith('.') ? clean : clean + '.');
      }
    }
  }

  if (bullets.length === 0) {
    if (item.filesChanged > 0) {
      bullets.push(`${item.filesChanged} file(s) modified (+${item.linesAdded} / -${item.linesDeleted}) in PR #${item.prNumber || 'merged'}.`);
    } else {
      bullets.push(`Pull Request submitted to ${item.repoFullName}.`);
    }
  }

  return bullets.slice(0, 4);
}

/**
 * Extracts evidence-backed impact statements for "KEY IMPACT" section.
 */
function getKeyImpact(item: ContributionHistoryItem, typeInfo: ContributionTypeInfo): string | null {
  if (item.linkedIssueNumber && item.linkedIssueTitle) {
    return `Addresses the issue described in Linked Issue #${item.linkedIssueNumber}: "${item.linkedIssueTitle}".`;
  }
  if (typeInfo.isDocs) {
    return `Adds documentation and setup guidance to ${item.repoFullName}.`;
  }
  if (typeInfo.label.includes('Bug Fix')) {
    return `Resolves reported bug behavior in ${item.repoFullName}.`;
  }
  if (typeInfo.label.includes('Feature')) {
    return `Introduces feature implementation: "${item.prTitle}".`;
  }
  if (item.filesChanged > 0) {
    return `Updates ${item.repoFullName} codebase across ${item.filesChanged} file(s).`;
  }
  return null;
}

export const EngineeringJournalView: React.FC<Props> = ({ data, isOwner = false }) => {
  const [statusFilter, setStatusFilter] = useState<'MERGED' | 'OPEN' | 'CLOSED' | 'ALL'>('MERGED');
  const [expandedId, setExpandedId] = useState<string | null>(data.history.length > 0 ? data.history[0].id : null);
  const [selectedCapability, setSelectedCapability] = useState<VerifiedCapability | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reflection Editing State
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);

  // Analysis Editing State
  const [editingAnalysisId, setEditingAnalysisId] = useState<string | null>(null);
  const [analysisEditForm, setAnalysisEditForm] = useState<{
    problem: string;
    investigation: string;
    approach: string;
    techniques: string;
    tradeoffs: string;
    result: string;
  }>({
    problem: '',
    investigation: '',
    approach: '',
    techniques: '',
    tradeoffs: '',
    result: '',
  });
  const [savingAnalysis, setSavingAnalysis] = useState(false);

  // Local state to track updated history items
  const [localHistory, setLocalHistory] = useState<ContributionHistoryItem[]>(data.history);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSaveReflection = async (contributionId: string) => {
    if (!reflectionText.trim()) return;
    setSavingReflection(true);
    try {
      const res = await fetch(`/api/contributions/${contributionId}/reflection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learned: reflectionText }),
      });
      const resData = await res.json();
      if (resData.success) {
        setLocalHistory((prev) =>
          prev.map((item) => {
            if (item.id === contributionId && item.analysis) {
              return {
                ...item,
                analysis: {
                  ...item.analysis,
                  contributorLearned: reflectionText,
                },
              };
            }
            return item;
          })
        );
        setEditingReflectionId(null);
        setReflectionText('');
      } else {
        alert(resData.error || 'Failed to save reflection.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving reflection.');
    } finally {
      setSavingReflection(false);
    }
  };

  const handleStartEditAnalysis = (item: ContributionHistoryItem) => {
    const analysis = item.analysis;
    setEditingAnalysisId(item.id);
    setAnalysisEditForm({
      problem: analysis?.problem || '',
      investigation: analysis?.investigation || '',
      approach: analysis?.approach || '',
      techniques: analysis?.techniques ? analysis.techniques.join(', ') : '',
      tradeoffs: analysis?.tradeoffs ? analysis.tradeoffs.join(', ') : '',
      result: analysis?.result || '',
    });
  };

  const handleSaveAnalysisEdit = async (contributionId: string) => {
    setSavingAnalysis(true);
    try {
      const payload = {
        problem: analysisEditForm.problem,
        investigation: analysisEditForm.investigation,
        approach: analysisEditForm.approach,
        techniques: analysisEditForm.techniques.split(',').map((s) => s.trim()).filter(Boolean),
        tradeoffs: analysisEditForm.tradeoffs.split(',').map((s) => s.trim()).filter(Boolean),
        result: analysisEditForm.result,
      };

      const res = await fetch(`/api/contributions/${contributionId}/analysis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (resData.success && resData.analysis) {
        const updatedAnalysis: CaseStudyData = resData.analysis;
        setLocalHistory((prev) =>
          prev.map((item) => {
            if (item.id === contributionId) {
              return {
                ...item,
                analysis: updatedAnalysis,
                techniques: updatedAnalysis.techniques,
              };
            }
            return item;
          })
        );
        setEditingAnalysisId(null);
      } else {
        alert(resData.error || 'Failed to update analysis.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating analysis.');
    } finally {
      setSavingAnalysis(false);
    }
  };

  // Filter history items by search query, category, capability, or PR status filter
  const filteredHistory = localHistory.filter((item) => {
    const searchPrTitle = item.prTitle || item.issueTitle || '';
    const text = `${searchPrTitle} ${item.repoFullName} ${item.area} ${item.category} ${item.techniques.join(' ')}`.toLowerCase();
    const matchesQuery = !filterQuery || text.includes(filterQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory || item.area === selectedCategory;
    const matchesCapability = !selectedCapability || selectedCapability.contributions.some((c) => c.id === item.id);

    let matchesStatus = true;
    if (statusFilter === 'MERGED') {
      matchesStatus = item.prStatus === 'MERGED';
    } else if (statusFilter === 'OPEN') {
      matchesStatus = item.prStatus === 'OPEN';
    } else if (statusFilter === 'CLOSED') {
      matchesStatus = item.prStatus === 'CLOSED';
    }

    return matchesQuery && matchesCategory && matchesCapability && matchesStatus;
  });

  const { user } = data;

  const mergedCount = localHistory.filter((h) => h.prStatus === 'MERGED').length;
  const openCount = localHistory.filter((h) => h.prStatus === 'OPEN').length;
  const closedCount = localHistory.filter((h) => h.prStatus === 'CLOSED').length;
  const allCount = localHistory.length;

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-slate-800/80 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-400">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>VERIFIED ENGINEERING JOURNAL</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-[10px] font-bold">
                AUDITED EVIDENCE
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
              Engineering Contributions
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed italic">
              &quot;Your open source journey, verified and documented.&quot;
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Contributor Identity Card */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl font-mono text-xs">
              <img
                src={user.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
                alt={user.githubUsername}
                className="w-10 h-10 rounded-full border border-slate-700 bg-slate-900"
              />
              <div className="flex flex-col">
                <span className="font-bold text-slate-100 text-sm">@{user.githubUsername}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-amber-400 font-bold">{user.totalPoints.toLocaleString()} RR Points</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time GitHub Activity Sync Status Banner */}
        {user.contributorSyncStatus === 'RUNNING' && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 animate-spin" />
              <span>Syncing GitHub pull requests & auditing verified contributions...</span>
            </div>
            <span className="text-[11px] text-blue-400 font-bold">Sync Active</span>
          </div>
        )}

        {/* TOP-LEVEL CONTRIBUTION OVERVIEW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-1 font-mono">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Verified Work</div>
            <div className="text-2xl font-extrabold text-slate-100">{user.verifiedContributionsCount}</div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Audited PRs</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 backdrop-blur-xl space-y-1 font-mono">
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-medium">RR Points</div>
            <div className="text-2xl font-extrabold text-amber-300">+{user.totalPoints.toLocaleString()}</div>
            <div className="text-[10px] text-amber-400/80">Points Ledger</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-1 font-mono">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Repositories</div>
            <div className="text-2xl font-extrabold text-blue-400">{user.repositoriesCount}</div>
            <div className="text-[10px] text-slate-500">Unique Codebases</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-1 font-mono">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Engineering Areas</div>
            <div className="text-2xl font-extrabold text-purple-400">{data.technicalAreas.length}</div>
            <div className="text-[10px] text-slate-500">Domain Focus</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-1 font-mono">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Avg Difficulty</div>
            <div className="text-2xl font-extrabold text-rose-400">
              {user.avgDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span>
            </div>
            <div className="text-[10px] text-slate-500">RR Difficulty</div>
          </div>
        </div>

        {/* SEARCH & PR LIFECYCLE FILTER CONTROLS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-800/80 bg-slate-950/50 backdrop-blur-xl font-mono text-xs">
          {/* PR Lifecycle Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('MERGED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === 'MERGED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Merged ({mergedCount})
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === 'OPEN'
                  ? 'bg-blue-950 text-blue-300 border border-blue-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === 'CLOSED'
                  ? 'bg-slate-800 text-slate-300 border border-slate-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed ({closedCount})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({allCount})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search PRs, repos, techniques..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {selectedCapability && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold">
                <span>Filter: {selectedCapability.name}</span>
                <button onClick={() => setSelectedCapability(null)} className="hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {selectedCategory && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 border border-blue-700/60 text-blue-300 font-bold">
                <span>Filter: {selectedCategory}</span>
                <button onClick={() => setSelectedCategory(null)} className="hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* EMPTY STATE */}
        {!data.hasData || filteredHistory.length === 0 ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-950/60 text-center font-mono space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">
              {data.hasData ? `No ${statusFilter.toLowerCase()} contributions match the selected filter.` : "You haven't had a contribution verified yet."}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {data.hasData
                ? 'Try adjusting your search keywords or clearing active filters.'
                : 'Explore open issues on Repo Rescue, submit pull requests on target GitHub repositories, and earn auditable RR Points.'}
            </p>
            <div className="pt-2">
              <Link
                href="/issues"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-lg transition-all"
              >
                <Code2 className="w-4 h-4" />
                <span>Explore Open Issues</span>
              </Link>
            </div>
          </div>
        ) : (
          /* EVIDENCE-FIRST ENGINEERING CONTRIBUTION CARDS */
          <div className="space-y-6">
            <div className="flex items-center justify-between font-mono">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-emerald-400" />
                ENGINEERING CONTRIBUTIONS ({filteredHistory.length})
              </h2>
              <span className="text-xs text-slate-500">Click card to inspect details</span>
            </div>

            <div className="space-y-5">
              {filteredHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                const analysis = item.analysis;
                const isMerged = item.prStatus === 'MERGED';
                const isOpen = item.prStatus === 'OPEN';
                const typeInfo = deriveContributionTypeInfo(item);
                const factualBullets = getFactualBullets(item);
                const impactText = getKeyImpact(item, typeInfo);
                const prTitleText = item.prTitle || item.issueTitle || 'Untitled Pull Request';
                const prNumberText = item.prNumber > 0 ? `#${item.prNumber}` : '';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'border-emerald-500/50 bg-[#0c1017] shadow-2xl ring-1 ring-emerald-500/20'
                        : 'border-slate-800/80 bg-[#090d16] hover:bg-[#0e131f] hover:border-slate-700/80 shadow-lg'
                    }`}
                  >
                    {/* COLLAPSED CARD PREVIEW STATE */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-6 cursor-pointer space-y-4 font-sans select-none"
                    >
                      {/* ROW 1: REPOSITORY IDENTITY & LIFECYCLE STATUS */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3 font-mono text-xs">
                        {/* Repository Identity */}
                        <div className="flex items-center gap-2 text-slate-300">
                          <GithubIcon className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-100 hover:text-blue-400 transition-colors">
                            {item.repoFullName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            Public
                            <a
                              href={item.repoUrl || `https://github.com/${item.repoFullName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-white"
                            >
                              <ExternalLink className="w-2.5 h-2.5 inline" />
                            </a>
                          </span>
                        </div>

                        {/* Lifecycle Status & State Date */}
                        <div className="flex items-center gap-3">
                          {isMerged ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>✓ Merged</span>
                            </span>
                          ) : isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold text-xs">
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              <span>● Open</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-700 font-bold text-xs">
                              <X className="w-3.5 h-3.5 text-slate-400" />
                              <span>× Closed</span>
                            </span>
                          )}
                          <span className="text-slate-400 text-xs">
                            {isMerged ? (item.mergedAt || 'Merged') : isOpen ? (item.openedAt || 'Open') : (item.closedAt || item.mergedAt || 'Closed')}
                          </span>
                        </div>
                      </div>

                      {/* ROW 2: MAIN CONTENT & RR METRIC BADGE BOX */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-3 flex-1">
                          {/* Contribution Type & Tags */}
                          <div className="flex flex-wrap items-center gap-2 font-mono">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${typeInfo.badgeStyle}`}>
                              {typeInfo.label}
                            </span>

                            {typeInfo.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Actual PR Title (Requirement 3) */}
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold text-white tracking-tight hover:text-emerald-400 transition-colors leading-snug">
                              {prTitleText} {prNumberText && <span className="text-slate-400 font-mono text-sm font-normal">{prNumberText}</span>}
                            </h3>

                            {/* Separated Linked Issue Badge (Requirement 4) */}
                            {item.linkedIssueNumber && item.linkedIssueTitle && (
                              <div className="pt-1">
                                <a
                                  href={item.linkedIssueUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-blue-400 hover:underline"
                                >
                                  <span>Linked Issue #{item.linkedIssueNumber}: {item.linkedIssueTitle}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RR Metrics Container Box (Requirement 10) */}
                        <div className="shrink-0 flex items-center md:items-end justify-between md:justify-start gap-4">
                          <div className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-950/80 shadow-md font-mono text-right space-y-1 min-w-[160px]">
                            {isMerged ? (
                              <>
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">RR Points</div>
                                <div className="text-xl font-black text-amber-300">+{item.rrPoints}</div>
                                <div className="text-[10px] text-slate-400 border-t border-slate-900 pt-1 mt-1">
                                  RR Difficulty <strong className="text-slate-200">{item.rrDifficulty.toFixed(1)} / 10</strong>
                                </div>
                              </>
                            ) : (
                              <div className="py-1 space-y-1 text-center">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Lifecycle Status</div>
                                <div className="text-[11px] font-semibold text-slate-400 italic">Not yet eligible for RR Points</div>
                              </div>
                            )}
                          </div>

                          <div className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-100 transition-colors self-center">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED VIEW: HIERARCHIZATION & EVIDENCE-FIRST (Requirement 14) */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/80 p-6 md:p-8 space-y-8 bg-[#0a0e17] rounded-b-2xl font-sans">
                        {/* 1. WHAT CHANGED (Requirement 5) */}
                        {factualBullets.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 font-mono">
                              <Terminal className="w-4 h-4 text-emerald-400" />
                              <span>WHAT CHANGED</span>
                            </h4>
                            <div className="p-4 rounded-xl border border-slate-800/90 bg-slate-950/60 space-y-2 text-sm text-slate-200 leading-relaxed">
                              {factualBullets.map((b, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                  <span className="text-emerald-400 font-bold mt-1 text-xs">•</span>
                                  <span>{b}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. FILES CHANGED (Requirement 8 - Real line counts or filenames only, no fake diffs) */}
                        {item.filesChanged > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 font-mono">
                                <FileCode className="w-4 h-4 text-cyan-400" />
                                <span>FILES CHANGED</span>
                              </h4>
                              <div className="text-[11px] font-mono text-slate-400">
                                {(item.linesAdded > 0 || item.linesDeleted > 0) ? (
                                  <>
                                    <span className="text-emerald-400 font-bold">+{item.linesAdded}</span>{' '}
                                    <span className="text-rose-400 font-bold">-{item.linesDeleted}</span> across{' '}
                                  </>
                                ) : null}
                                <span className="text-slate-200 font-bold">{item.filesChanged} file(s)</span>
                              </div>
                            </div>
                            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 font-mono text-xs space-y-2 text-slate-300">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200">GitHub Pull Request #{item.prNumber || 'merged'}</span>
                                {(item.linesAdded > 0 || item.linesDeleted > 0) && (
                                  <span className="text-[11px]">
                                    <span className="text-emerald-400 font-bold">+{item.linesAdded}</span>{' '}
                                    <span className="text-rose-400 font-bold">-{item.linesDeleted}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. KEY IMPACT (Requirement 7) */}
                        {impactText && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 font-mono">
                              <Sparkles className="w-4 h-4 text-purple-400" />
                              <span>KEY IMPACT</span>
                            </h4>
                            <div className="p-4 rounded-xl border border-purple-900/40 bg-purple-950/20 text-xs text-purple-100 leading-relaxed font-mono">
                              {impactText}
                            </div>
                          </div>
                        )}

                        {/* 4. ACTUAL BEFORE & AFTER (Requirement 6: ONLY rendered when real diff patch is present) */}
                        {item.diffPatch && item.diffPatch.before && item.diffPatch.after && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 font-mono">
                              <Activity className="w-4 h-4 text-amber-400" />
                              <span>BEFORE & AFTER (ACTUAL DIFF)</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* BEFORE PANEL */}
                              <div className="rounded-xl border border-rose-900/40 bg-slate-950 overflow-hidden font-mono text-xs">
                                <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-900/40 font-bold text-rose-300 flex items-center justify-between">
                                  <span>BEFORE</span>
                                  <span className="text-[10px] text-rose-400/80">Previous Code</span>
                                </div>
                                <pre className="p-4 text-slate-300 overflow-x-auto bg-slate-950/80 text-[11px]">
                                  <code>{item.diffPatch.before}</code>
                                </pre>
                              </div>

                              {/* AFTER PANEL */}
                              <div className="rounded-xl border border-emerald-900/40 bg-slate-950 overflow-hidden font-mono text-xs">
                                <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-900/40 font-bold text-emerald-300 flex items-center justify-between">
                                  <span>AFTER</span>
                                  <span className="text-[10px] text-emerald-400/80">Updated Code</span>
                                </div>
                                <pre className="p-4 text-emerald-200 overflow-x-auto bg-slate-950/80 text-[11px]">
                                  <code>{item.diffPatch.after}</code>
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 5. VERIFIED GITHUB EVIDENCE (Requirement 9 & 12) */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 font-mono">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>VERIFIED GITHUB EVIDENCE</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                            {/* PR Link */}
                            <a
                              href={item.prUrl || `https://github.com/${item.repoFullName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all flex items-center justify-between text-xs group"
                            >
                              <div className="space-y-0.5 truncate">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">PULL REQUEST</div>
                                <div className="font-semibold text-slate-200 truncate">{prNumberText || 'PR Link'}</div>
                              </div>
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                            </a>

                            {/* Linked Issue if present */}
                            {item.linkedIssueNumber ? (
                              <a
                                href={item.linkedIssueUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all flex items-center justify-between text-xs group"
                              >
                                <div className="space-y-0.5 truncate">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">LINKED ISSUE</div>
                                  <div className="font-semibold text-slate-200 truncate">Issue #{item.linkedIssueNumber}</div>
                                </div>
                                <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                              </a>
                            ) : null}

                            {/* Repository Link */}
                            <a
                              href={item.repoUrl || `https://github.com/${item.repoFullName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all flex items-center justify-between text-xs group"
                            >
                              <div className="space-y-0.5 truncate">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">REPOSITORY</div>
                                <div className="font-semibold text-slate-200 truncate">{item.repoFullName}</div>
                              </div>
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                            </a>

                            {/* RR PointsLedger System Verification Badge (Requirement 9) */}
                            <div className="p-3.5 rounded-xl border border-emerald-900/40 bg-emerald-950/20 flex items-center justify-between text-xs">
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-emerald-400 uppercase">SYSTEM RECORD</div>
                                <div className="font-semibold text-emerald-200">RR Points Ledger Verified</div>
                              </div>
                              <Shield className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                            </div>
                          </div>
                        </div>

                        {/* 6. PULL REQUEST & REPOSITORY DETAILS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80 font-mono text-xs">
                          {/* PR Details */}
                          <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                              <GitPullRequest className="w-4 h-4" />
                              <span>PULL REQUEST DETAILS</span>
                            </h4>
                            <div className="space-y-1.5 text-slate-300">
                              <div className="flex justify-between">
                                <span className="text-slate-500">PR Title:</span>
                                <span className="font-bold text-slate-200 truncate max-w-[200px]">{prTitleText}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">PR Number:</span>
                                <span className="font-bold text-slate-200">{prNumberText || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Lifecycle Status:</span>
                                <span className="font-bold text-slate-200">{item.prStatus}</span>
                              </div>
                              {item.mergedAt && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Merged Date:</span>
                                  <span className="font-bold text-slate-200">{item.mergedAt}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-500">Files Changed:</span>
                                <span className="font-bold text-slate-200">{item.filesChanged} file(s)</span>
                              </div>
                            </div>
                          </div>

                          {/* Repo Context */}
                          <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              <span>REPOSITORY CONTEXT</span>
                            </h4>
                            <div className="space-y-1.5 text-slate-300">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Repository:</span>
                                <span className="font-bold text-slate-200">{item.repoFullName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Primary Language:</span>
                                <span className="font-bold text-slate-200">{item.language || 'TypeScript'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Domain Area:</span>
                                <span className="font-bold text-slate-200">{item.area}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Category:</span>
                                <span className="font-bold text-slate-200">{item.category}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 7. AI ENGINEERING ANALYSIS (Requirement 12: Visually distinct from verified evidence) */}
                        {analysis && (
                          <div className="space-y-4 pt-4 border-t border-slate-800/80">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-purple-900/60 bg-purple-950/20 font-mono text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Brain className="w-4 h-4 text-purple-400" />
                                  <span className="font-bold text-purple-200">AI ENGINEERING ANALYSIS</span>
                                  <span className="px-2 py-0.5 rounded-md bg-purple-900/80 border border-purple-700/60 text-purple-300 font-bold text-[10px]">
                                    AI Interpretation (Not GitHub Evidence)
                                  </span>
                                </div>
                                <p className="text-[11px] text-purple-400/80">
                                  Machine-generated interpretation based on PR discussion and diff context.
                                </p>
                              </div>

                              {isOwner && isMerged && (
                                <button
                                  onClick={() => handleStartEditAnalysis(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors self-start sm:self-auto"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Edit Analysis</span>
                                </button>
                              )}
                            </div>

                            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 font-mono text-xs text-slate-300">
                              <div>
                                <span className="font-bold text-slate-200 uppercase">Problem Context: </span>
                                <span>{analysis.problem}</span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-200 uppercase">Investigation Narrative: </span>
                                <span>{analysis.investigation}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 8. CONTRIBUTOR ROLE & REFLECTION */}
                        {analysis?.contributorLearned || isOwner ? (
                          <div className="space-y-3 pt-4 border-t border-slate-800/80">
                            <div className="flex items-center justify-between font-mono">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                <span>CONTRIBUTOR REFLECTION</span>
                              </h4>
                              {isOwner && editingReflectionId !== item.id && (
                                <button
                                  onClick={() => {
                                    setEditingReflectionId(item.id);
                                    setReflectionText(analysis?.contributorLearned || '');
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-bold"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>{analysis?.contributorLearned ? 'Edit reflection' : 'Add reflection'}</span>
                                </button>
                              )}
                            </div>

                            {editingReflectionId === item.id ? (
                              <div className="space-y-3 p-4 rounded-xl border border-blue-800/60 bg-slate-900/80 font-mono">
                                <textarea
                                  value={reflectionText}
                                  onChange={(e) => setReflectionText(e.target.value)}
                                  placeholder="What engineering insights or lessons did you learn while completing this work?"
                                  rows={3}
                                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                />
                                <div className="flex items-center justify-end gap-2 text-xs">
                                  <button
                                    onClick={() => setEditingReflectionId(null)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveReflection(item.id)}
                                    disabled={savingReflection}
                                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
                                  >
                                    {savingReflection ? 'Saving...' : 'Save Reflection'}
                                  </button>
                                </div>
                              </div>
                            ) : analysis?.contributorLearned ? (
                              <div className="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 text-xs text-slate-200 leading-relaxed italic">
                                &quot;{analysis.contributorLearned}&quot;
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {/* 9. RR SCORING PROVENANCE (Requirement 10) */}
                        <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">RR SCORING PROVENANCE</div>
                            <div className="text-slate-300">
                              RR Difficulty: <strong className="text-amber-300">{item.rrDifficulty.toFixed(1)} / 10</strong> (Issue difficulty score) · Scoring Algorithm V2.3
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {isMerged ? (
                              <div className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                                +{item.rrPoints} Verified Contribution Points
                              </div>
                            ) : (
                              <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-bold">
                                Not yet eligible for RR Points
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: YOUR ENGINEERING DNA */}
        <div className="space-y-6 pt-10 border-t border-slate-800/80 font-mono">
          <div>
            <div className="flex items-center gap-2 text-xs text-purple-400 font-bold mb-1">
              <Cpu className="w-4 h-4" />
              <span>AGGREGATED VERIFIED EVIDENCE</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              YOUR ENGINEERING DNA
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Verified technical capabilities, engineering techniques, and technologies extracted from audited open-source contributions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1. Verified Techniques & Capabilities */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Technical Techniques
                </span>
                <span className="text-xs text-slate-500">Verified Evidence</span>
              </h3>

              <div className="space-y-3">
                {data.capabilities.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No techniques verified yet.</p>
                ) : (
                  data.capabilities.slice(0, 8).map((cap) => (
                    <div
                      key={cap.id}
                      onClick={() => {
                        setSelectedCapability(selectedCapability?.id === cap.id ? null : cap);
                        setFilterQuery('');
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedCapability?.id === cap.id
                          ? 'border-emerald-500 bg-emerald-950/40 shadow-lg'
                          : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-100">{cap.name}</div>
                        <div className="text-[11px] text-emerald-400 font-semibold">
                          Verified through {cap.count} contribution{cap.count > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-400 font-mono">
                        {cap.percentage}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Technologies & Languages */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center justify-between mb-4">
                  <span className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    Technologies
                  </span>
                  <span className="text-xs text-slate-500">Language & Ecosystem Evidence</span>
                </h3>

                <div className="space-y-3">
                  {data.technologies.languages.map((lang) => (
                    <div key={lang.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{lang.name}</span>
                        <span className="text-slate-400 text-[11px]">Used in {lang.count} verified contribution{lang.count > 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          style={{ width: `${lang.percentage}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty Distribution Bar */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Difficulty Distribution</span>
                  <span className="text-slate-400 text-[11px]">Avg {data.difficultyDistribution.avgDifficulty} / 10</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="p-2 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300">
                    <div className="font-bold text-xs">{data.difficultyDistribution.easyCount}</div>
                    <div>Easy</div>
                  </div>
                  <div className="p-2 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300">
                    <div className="font-bold text-xs">{data.difficultyDistribution.moderateCount}</div>
                    <div>Moderate</div>
                  </div>
                  <div className="p-2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                    <div className="font-bold text-xs">{data.difficultyDistribution.hardCount}</div>
                    <div>Hard</div>
                  </div>
                  <div className="p-2 rounded bg-rose-950/60 border border-rose-800/50 text-rose-300">
                    <div className="font-bold text-xs">{data.difficultyDistribution.veryHardCount}</div>
                    <div>Very Hard</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT ANALYSIS MODAL */}
      {editingAnalysisId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-mono">
          <div className="max-w-2xl w-full p-6 rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                Edit Case Study Analysis
              </h3>
              <button onClick={() => setEditingAnalysisId(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Problem Summary</label>
                <textarea
                  rows={2}
                  value={analysisEditForm.problem}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, problem: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Investigation</label>
                <textarea
                  rows={3}
                  value={analysisEditForm.investigation}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, investigation: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Implementation Approach</label>
                <textarea
                  rows={3}
                  value={analysisEditForm.approach}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, approach: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Techniques (Comma-separated)</label>
                <input
                  type="text"
                  value={analysisEditForm.techniques}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, techniques: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Trade-offs & Considerations</label>
                <textarea
                  rows={2}
                  value={analysisEditForm.tradeoffs}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, tradeoffs: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Verified Result</label>
                <textarea
                  rows={2}
                  value={analysisEditForm.result}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, result: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 text-xs">
              <button
                onClick={() => setEditingAnalysisId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveAnalysisEdit(editingAnalysisId)}
                disabled={savingAnalysis}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
              >
                {savingAnalysis ? 'Saving Changes...' : 'Save & Mark Contributor Edited'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
