'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Trophy,
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
  Filter,
} from 'lucide-react';
import { ContributionAnalyticsData, ContributionHistoryItem, VerifiedCapability } from '@/lib/analytics/contribution-analytics-service';
import { CaseStudyData } from '@/lib/ai/case-study-service';

interface Props {
  data: ContributionAnalyticsData;
  isOwner?: boolean;
}

export const EngineeringJournalView: React.FC<Props> = ({ data, isOwner = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.history.length > 0 ? data.history[0].id : null
  );
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

  // Local state to track updated history items when user edits analysis or reflection
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

  // Filter history items by search query, category, or capability filter
  const filteredHistory = localHistory.filter((item) => {
    const text = `${item.issueTitle} ${item.repoFullName} ${item.area} ${item.category} ${item.techniques.join(' ')}`.toLowerCase();
    const matchesQuery = !filterQuery || text.includes(filterQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory || item.area === selectedCategory;
    const matchesCapability = !selectedCapability || selectedCapability.contributions.some((c) => c.id === item.id);
    return matchesQuery && matchesCategory && matchesCapability;
  });

  const { user } = data;

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* HEADER SECTION */}
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
              YOUR ENGINEERING JOURNAL
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              A verified history of the engineering problems you&apos;ve solved through open source. Built on machine-verifiable GitHub evidence.
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
              <span>Analyzing your GitHub merged pull requests & verifying open-source contributions...</span>
            </div>
            <span className="text-[11px] text-blue-400 font-bold">Sync Active</span>
          </div>
        )}

        {/* TOP-LEVEL CONTRIBUTION OVERVIEW (Database-backed real metrics) */}
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
            <div className="text-2xl font-extrabold text-rose-400">{user.avgDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span></div>
            <div className="text-[10px] text-slate-500">RR Difficulty</div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-800/80 bg-slate-950/50 backdrop-blur-xl font-mono text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search techniques, repos, issues..."
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
              {data.hasData ? 'No contributions match the selected filter.' : "You haven't had a contribution verified yet."}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {data.hasData
                ? 'Try adjusting your search keywords or clearing active filters.'
                : 'Explore open issues on Repo Rescue, submit pull requests on target GitHub repositories, and earn auditable RR Points and verified Case Studies.'}
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
          /* CASE STUDIES TIMELINE & EXPANDED VIEWS */
          <div className="space-y-6">
            <div className="flex items-center justify-between font-mono">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-emerald-400" />
                ENGINEERING CASE STUDIES ({filteredHistory.length})
              </h2>
              <span className="text-xs text-slate-500">Click a contribution card to inspect details</span>
            </div>

            <div className="space-y-4">
              {filteredHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                const analysis = item.analysis;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all ${
                      isExpanded
                        ? 'border-emerald-500/50 bg-slate-950 shadow-2xl'
                        : 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    {/* CARD HEADER (Collapsed / Preview Mode) */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                          {/* Repo Tag */}
                          <span className="font-bold text-blue-400 hover:underline flex items-center gap-1">
                            <FileCode className="w-3.5 h-3.5 text-blue-400" />
                            {item.repoFullName}
                          </span>
                          <span className="text-slate-700">•</span>
                          {/* PR # & Status */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold text-[11px]">
                            PR #{item.prNumber} · MERGED ✓
                          </span>
                          <span className="text-slate-700">•</span>
                          {/* Difficulty Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.rrDifficulty >= 8.0
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                : item.rrDifficulty >= 6.0
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            }`}
                          >
                            RR {item.rrDifficulty.toFixed(1)} · {item.rrDifficulty >= 8.0 ? 'VERY HARD' : item.rrDifficulty >= 6.0 ? 'HARD' : 'MODERATE'}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-slate-100 hover:text-emerald-400 transition-colors">
                          {item.issueTitle}
                        </h3>

                        {/* Badges / Techniques */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-purple-300 font-bold">
                            {item.area}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-300 font-bold">
                            {item.category}
                          </span>
                          {item.techniques.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right Meta Info */}
                      <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-900">
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-amber-300">+{item.rrPoints} RR</div>
                          <div className="text-[10px] text-slate-500">{item.mergedAt}</div>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-100 transition-colors">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED FULL CASE STUDY VIEW */}
                    {isExpanded && analysis && (
                      <div className="border-t border-slate-800/80 p-6 space-y-8 font-mono bg-slate-950/90 rounded-b-2xl">
                        {/* CASE STUDY PROVENANCE HEADER */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400">
                          <div className="flex flex-wrap items-center gap-2">
                            <Brain className="w-4 h-4 text-emerald-400" />
                            <span className="font-bold text-slate-200">AI-generated analysis</span>
                            <span>•</span>
                            <span className="text-[11px] text-slate-400">
                              Based on Issue · PR · Commits · Diff · Reviews · Tests
                            </span>
                            {analysis.contributorEdited && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60 font-bold text-[10px]">
                                Contributor edited
                              </span>
                            )}
                          </div>

                          {isOwner && (
                            <button
                              onClick={() => handleStartEditAnalysis(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors self-start sm:self-auto"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                              <span>Edit analysis</span>
                            </button>
                          )}
                        </div>

                        {/* SECTION 1: PROBLEM */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            PROBLEM
                          </h4>
                          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-sm text-slate-200 leading-relaxed">
                            {analysis.problem}
                          </div>
                        </div>

                        {/* SECTION 2: INVESTIGATION */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            INVESTIGATION
                          </h4>
                          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-sm text-slate-300 leading-relaxed">
                            {analysis.investigation}
                          </div>
                        </div>

                        {/* SECTION 3: APPROACH */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            APPROACH
                          </h4>
                          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-sm text-slate-200 leading-relaxed">
                            {analysis.approach}
                          </div>
                        </div>

                        {/* SECTION 4: TECHNIQUES DEMONSTRATED */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                            <Cpu className="w-4 h-4" />
                            ENGINEERING TECHNIQUES DEMONSTRATED
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {analysis.techniques.map((tech) => (
                              <div key={tech} className="p-3 rounded-xl border border-purple-900/40 bg-purple-950/20 flex items-center justify-between text-xs">
                                <span className="font-bold text-purple-200">{tech}</span>
                                <span className="text-[10px] text-purple-400/80 font-mono">Verified in diff</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 5: IMPLEMENTATION & COMMITS */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            IMPLEMENTATION ARTIFACTS
                          </h4>
                          <div className="space-y-2">
                            {analysis.implementation.map((impl, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-800 bg-slate-900/40 text-xs">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-200">{impl.title}</div>
                                  {impl.description && <div className="text-[11px] text-slate-400">{impl.description}</div>}
                                </div>
                                {impl.url && (
                                  <a
                                    href={impl.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-400 hover:underline shrink-0"
                                  >
                                    <span>View GitHub Artifact</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 6: MACHINE-VERIFIABLE EVIDENCE */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            MACHINE-VERIFIABLE EVIDENCE
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {analysis.evidence.map((ev, idx) => (
                              <a
                                key={idx}
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-700 transition-all flex items-center justify-between text-xs group"
                              >
                                <div className="space-y-0.5 truncate">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">{ev.type}</div>
                                  <div className="font-semibold text-slate-200 truncate">{ev.label}</div>
                                </div>
                                <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                              </a>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 7: TRADE-OFFS */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            TRADE-OFFS & CONSIDERATIONS
                          </h4>
                          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-xs text-slate-300 leading-relaxed space-y-1">
                            {analysis.tradeoffs.map((t, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-amber-400 font-bold">•</span>
                                <span>{t}</span>
                              </div>
                            ))}
                            <div className="text-[10px] text-slate-500 pt-1 font-mono">
                              AI-identified consideration from implementation diff
                            </div>
                          </div>
                        </div>

                        {/* SECTION 8: RESULT */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            VERIFIED RESULT
                          </h4>
                          <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 text-xs text-emerald-200 font-mono whitespace-pre-line leading-relaxed">
                            {analysis.result}
                          </div>
                        </div>

                        {/* SECTION 9: WHAT I LEARNED (CONTRIBUTOR REFLECTION) */}
                        <div className="space-y-3 pt-4 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              WHAT I LEARNED
                            </h4>
                            {isOwner && editingReflectionId !== item.id && (
                              <button
                                onClick={() => {
                                  setEditingReflectionId(item.id);
                                  setReflectionText(analysis.contributorLearned || '');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-bold"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{analysis.contributorLearned ? 'Edit reflection' : 'Add a reflection'}</span>
                              </button>
                            )}
                          </div>

                          {editingReflectionId === item.id ? (
                            <div className="space-y-3 p-4 rounded-xl border border-blue-800/60 bg-slate-900/80">
                              <textarea
                                value={reflectionText}
                                onChange={(e) => setReflectionText(e.target.value)}
                                placeholder="What engineering insights or lessons did you learn while solving this issue?"
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
                          ) : analysis.contributorLearned ? (
                            <div className="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 text-xs text-slate-200 leading-relaxed italic">
                              &quot;{analysis.contributorLearned}&quot;
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/30 text-xs text-slate-500 italic">
                              No reflection written yet. {isOwner && 'Click &quot;Add a reflection&quot; to document your key takeaways.'}
                            </div>
                          )}
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
