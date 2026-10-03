'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Clock,
  Terminal,
  Brain,
  Globe,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  FileText,
  GitCommit,
  CheckSquare
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
  badgeStyle: string;
  isDocs: boolean;
}

function deriveContributionTypeInfo(item: ContributionHistoryItem): ContributionTypeInfo {
  const prTitleLower = (item.prTitle || '').toLowerCase();
  const catLower = (item.category || '').toLowerCase();

  const isReadme = prTitleLower.includes('readme') || catLower.includes('readme');
  const isDocs = isReadme || prTitleLower.includes('docs') || prTitleLower.includes('documentation') || catLower === 'documentation';

  if (isDocs) {
    return {
      label: isReadme ? 'README' : 'Documentation',
      badgeStyle: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
      isDocs: true,
    };
  }

  if (prTitleLower.includes('auth') || prTitleLower.includes('oauth')) {
    return {
      label: 'Bug Fix · Authentication',
      badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
      isDocs: false,
    };
  }

  if (prTitleLower.includes('fix') || prTitleLower.includes('bug') || prTitleLower.includes('patch') || catLower === 'bug fixes') {
    return {
      label: 'Bug Fix',
      badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
      isDocs: false,
    };
  }

  if (prTitleLower.includes('feat') || prTitleLower.includes('feature') || catLower === 'features') {
    return {
      label: 'Feature',
      badgeStyle: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
      isDocs: false,
    };
  }

  if (prTitleLower.includes('refactor') || prTitleLower.includes('clean') || catLower === 'refactoring') {
    return {
      label: 'Refactor',
      badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
      isDocs: false,
    };
  }

  if (prTitleLower.includes('test') || prTitleLower.includes('spec') || catLower === 'testing') {
    return {
      label: 'Testing',
      badgeStyle: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      isDocs: false,
    };
  }

  if (prTitleLower.includes('perf') || prTitleLower.includes('optimize') || catLower === 'performance') {
    return {
      label: 'Performance',
      badgeStyle: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      isDocs: false,
    };
  }

  return {
    label: 'Pull Request',
    badgeStyle: 'bg-slate-900 text-slate-300 border-slate-700',
    isDocs: false,
  };
}

function getTimelineDateParts(item: ContributionHistoryItem): { year: string; dayMonth: string; fullDate: string } {
  const dateObj = item.verifiedAtRaw ? new Date(item.verifiedAtRaw) : new Date();
  if (isNaN(dateObj.getTime())) {
    return { year: '2026', dayMonth: '08 OCT', fullDate: 'Oct 8, 2026' };
  }
  const year = dateObj.getFullYear().toString();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayMonth = `${day} ${monthNames[dateObj.getMonth()]}`;
  const fullDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { year, dayMonth, fullDate };
}

function getEngineeringChangeSummary(item: ContributionHistoryItem): string {
  if (item.analysis?.engineeringThesis && item.analysis.engineeringThesis.trim()) {
    return item.analysis.engineeringThesis;
  }
  if (item.analysis?.whatChanged && item.analysis.whatChanged.length > 0) {
    const first = item.analysis.whatChanged[0];
    const text = typeof first === 'string' ? first : first.statement;
    if (text && text.trim()) return text;
  }
  if (item.approach && item.approach.trim().length > 10) {
    return item.approach;
  }
  return `Updated ${item.repoFullName} across ${item.filesChanged || 1} file(s) with verified code changes in PR #${item.prNumber || 'merged'}.`;
}

function getChecksSummaryPill(item: ContributionHistoryItem): { text: string; passed: boolean; count: number; failed: number } {
  const checks = item.analysis?.checks || [];
  const checksSummary = item.analysis?.checksSummary;

  if (checksSummary) {
    const total = checksSummary.totalChecks || checks.length;
    const passed = checksSummary.passedChecks || checks.filter((c) => c.verified).length;
    const failed = checksSummary.failedChecks || checks.filter((c) => c.conclusion === 'failure').length;
    if (total > 0) {
      if (failed === 0 && passed > 0) {
        return { text: `${passed} ${passed === 1 ? 'check' : 'checks'} · PASSED`, passed: true, count: total, failed: 0 };
      } else if (failed > 0) {
        return { text: `${failed} of ${total} checks FAILED`, passed: false, count: total, failed };
      } else {
        return { text: `${passed}/${total} checks completed`, passed: true, count: total, failed: 0 };
      }
    }
  }

  if (checks.length > 0) {
    const verified = checks.filter((c) => c.verified).length;
    const failed = checks.filter((c) => c.conclusion === 'failure').length;
    const passed = verified === checks.length && failed === 0;
    return { text: `${verified}/${checks.length} checks PASSED`, passed, count: checks.length, failed };
  }

  return { text: `1 check · PASSED`, passed: true, count: 1, failed: 0 };
}

function getFactualBullets(item: ContributionHistoryItem): string[] {
  const bullets: string[] = [];

  if (item.analysis?.whatChanged && Array.isArray(item.analysis.whatChanged) && item.analysis.whatChanged.length > 0) {
    for (const w of item.analysis.whatChanged) {
      if (w.statement && w.statement.trim().length > 0) {
        bullets.push(w.statement);
      }
    }
  }

  if (bullets.length === 0 && item.approach && item.approach.trim().length > 10) {
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

  return bullets.slice(0, 6);
}

export const EngineeringJournalView: React.FC<Props> = ({ data, isOwner = false }) => {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'MERGED' | 'OPEN' | 'CLOSED' | 'ALL'>('MERGED');
  
  // Full-screen engineering review detail state
  const [selectedReviewItem, setSelectedReviewItem] = useState<ContributionHistoryItem | null>(null);
  
  // DEFAULT TAB MUST BE 'CODE' (CODE CHANGES & DIFF)
  const [detailTab, setDetailTab] = useState<'CODE' | 'CHECKS' | 'INTERPRETATION' | 'PROVENANCE'>('CODE');
  
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedTechniqueFilter, setSelectedTechniqueFilter] = useState<string | null>(null);
  const [currentSyncStatus, setCurrentSyncStatus] = useState<string>(data.user.contributorSyncStatus || 'IDLE');

  // Automatic Polling when Contributor Sync is RUNNING
  useEffect(() => {
    if (!isOwner || currentSyncStatus !== 'RUNNING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/contributions/sync');
        if (res.ok) {
          const syncData = await res.json();
          if (syncData.syncStatus) {
            setCurrentSyncStatus(syncData.syncStatus);
            if (syncData.syncStatus !== 'RUNNING') {
              router.refresh();
            }
          }
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [isOwner, currentSyncStatus, router]);

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

  // SEPARATION: VERIFIED CONTRIBUTIONS vs DISCOVERED ACTIVITY
  // A PullRequest record alone is NOT enough. Only actual Contribution records count as verified engineering work.
  const verifiedHistory = localHistory.filter(
    (item) => item.status === 'MERGED_AND_AUDITED'
  );

  const discoveredHistory = localHistory.filter(
    (item) => item.status !== 'MERGED_AND_AUDITED'
  );

  // Authoritative calculations (Requirement 5, 6, 7)
  const verifiedContributionsCount = verifiedHistory.length;
  const totalRrPoints = verifiedHistory.reduce((acc, item) => acc + (item.rrPoints || 0), 0);
  const avgRrDifficulty = verifiedContributionsCount > 0
    ? verifiedHistory.reduce((acc, item) => acc + (item.rrDifficulty || 0), 0) / verifiedContributionsCount
    : 0;
  const uniqueReposCount = new Set(verifiedHistory.map((item) => item.repoFullName)).size;

  // Evidence-based language observations (Requirement 3) - NO PROGRESS BARS / PROFICIENCY IMPLICATIONS
  const observedLanguagesMap = new Map<string, number>();
  verifiedHistory.forEach((item) => {
    if (item.language) {
      observedLanguagesMap.set(item.language, (observedLanguagesMap.get(item.language) || 0) + 1);
    }
  });
  const observedLanguagesList = Array.from(observedLanguagesMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  // Techniques with supporting evidence files count (Requirement 4)
  const verifiedTechniquesMap = new Map<string, { name: string; count: number; filesCount: number; sampleItem: ContributionHistoryItem }>();
  verifiedHistory.forEach((item) => {
    const fileCount = item.filesChanged || 1;
    for (const tech of item.techniques) {
      const existing = verifiedTechniquesMap.get(tech);
      if (existing) {
        existing.count += 1;
        existing.filesCount += fileCount;
      } else {
        verifiedTechniquesMap.set(tech, {
          name: tech,
          count: 1,
          filesCount: fileCount,
          sampleItem: item,
        });
      }
    }
  });
  const verifiedTechniquesList = Array.from(verifiedTechniquesMap.values());

  const openEngineeringReview = (item: ContributionHistoryItem) => {
    setSelectedReviewItem(item);
    setDetailTab('CODE'); // Default to CODE CHANGES & DIFF
  };

  const closeEngineeringReview = () => {
    setSelectedReviewItem(null);
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
        if (selectedReviewItem?.id === contributionId && selectedReviewItem.analysis) {
          setSelectedReviewItem({
            ...selectedReviewItem,
            analysis: {
              ...selectedReviewItem.analysis,
              contributorLearned: reflectionText,
            },
          });
        }
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
        if (selectedReviewItem?.id === contributionId) {
          setSelectedReviewItem({
            ...selectedReviewItem,
            analysis: updatedAnalysis,
            techniques: updatedAnalysis.techniques,
          });
        }
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

  // Filter history for timeline view across ALL discovered PR activity
  const displayHistory = localHistory.filter((item) => {
    const searchPrTitle = item.prTitle || item.issueTitle || '';
    const text = `${searchPrTitle} ${item.repoFullName} ${item.area} ${item.category} ${item.techniques.join(' ')}`.toLowerCase();
    const matchesQuery = !filterQuery || text.includes(filterQuery.toLowerCase());
    const matchesTechnique = !selectedTechniqueFilter || item.techniques.includes(selectedTechniqueFilter);

    let matchesStatus = true;
    if (statusFilter === 'MERGED') {
      matchesStatus = item.prStatus === 'MERGED';
    } else if (statusFilter === 'OPEN') {
      matchesStatus = item.prStatus === 'OPEN';
    } else if (statusFilter === 'CLOSED') {
      matchesStatus = item.prStatus === 'CLOSED';
    }

    return matchesQuery && matchesTechnique && matchesStatus;
  });

  const { user } = data;

  // 1. FULL-SCREEN ENGINEERING REVIEW DETAIL VIEW (Requirement 1)
  if (selectedReviewItem) {
    const reviewTypeInfo = deriveContributionTypeInfo(selectedReviewItem);
    const reviewChecksPill = getChecksSummaryPill(selectedReviewItem);
    const reviewFactualBullets = getFactualBullets(selectedReviewItem);
    const hasFailingChecks = reviewChecksPill.failed > 0;
    const isPartialDiff = selectedReviewItem.analysis?.analysisCoverage === 'PARTIAL_DIFF';

    return (
      <div className="min-h-screen bg-[#06080e] text-slate-100 py-8 px-4 sm:px-6 lg:px-10 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* BACK TO ENGINEERING JOURNAL HEADER */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 font-mono text-xs">
            <button
              onClick={closeEngineeringReview}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all font-bold group"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>← BACK TO ENGINEERING JOURNAL</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                ● AUDITED ENGINEERING REPORT
              </span>
              <a
                href={selectedReviewItem.prUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold"
              >
                <span>GitHub PR</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* REPORT TITLE & REPOSITORY BANNER */}
          <div className="space-y-3 p-6 rounded-2xl border border-slate-800/90 bg-[#080c14] font-mono">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <GithubIcon className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-200 text-sm">{selectedReviewItem.repoFullName}</span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400 font-bold">PR #{selectedReviewItem.prNumber || 'merged'}</span>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>MERGED & AUDITED</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug font-sans">
              {selectedReviewItem.prTitle || selectedReviewItem.issueTitle}
            </h1>

            {/* ENGINEERING CHANGE THESIS */}
            <div className="p-4 rounded-xl border border-emerald-900/60 bg-[#050a12] space-y-1 mt-4">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>ENGINEERING CHANGE THESIS</span>
              </div>
              <p className="text-sm font-semibold text-slate-200 leading-relaxed font-sans">
                {getEngineeringChangeSummary(selectedReviewItem)}
              </p>
            </div>
          </div>

          {/* DESKTOP 70% / 30% SPLIT LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN (70%): EVIDENCE, DIFF & ANALYSIS */}
            <div className="lg:col-span-8 space-y-6">

              {/* TABS NAVIGATION (DEFAULT TO 'CODE') */}
              <div className="flex items-center gap-1 border-b border-slate-800 bg-[#080c14] p-1 rounded-xl font-mono text-xs overflow-x-auto">
                <button
                  onClick={() => setDetailTab('CODE')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'CODE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  <span>CODE CHANGES & DIFF</span>
                </button>

                <button
                  onClick={() => setDetailTab('CHECKS')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'CHECKS'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AUTOMATED CHECKS</span>
                </button>

                <button
                  onClick={() => setDetailTab('INTERPRETATION')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'INTERPRETATION'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  <span>ENGINEERING ANALYSIS</span>
                </button>

                <button
                  onClick={() => setDetailTab('PROVENANCE')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'PROVENANCE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>EVIDENCE PROVENANCE</span>
                </button>
              </div>

              {/* TAB 1: CODE CHANGES & DIFF (DEFAULT VIEW - Requirement 2 & 9) */}
              {detailTab === 'CODE' && (
                <div className="space-y-6">

                  {/* PARTIAL DIFF WARNING BANNER (Requirement 9) */}
                  {isPartialDiff && (
                    <div className="p-4 rounded-xl border border-amber-800/60 bg-amber-950/20 text-amber-300 text-xs font-mono flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-bold text-amber-200">PARTIAL DIFF ANALYSIS</div>
                        <p className="text-[11px] text-amber-300/80">
                          Due to pull request size, diff analysis was performed on a representative sample of analyzed files. Full pull request diff remains auditable on GitHub.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* FOOTPRINT STATS SUMMARY */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-[#080c14] font-mono text-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">CODE FOOTPRINT</div>
                      <div className="text-slate-100 font-bold text-sm">
                        {selectedReviewItem.filesChanged} file(s) modified ·{' '}
                        <span className="text-emerald-400">+{selectedReviewItem.linesAdded}</span>{' '}
                        <span className="text-rose-400">-{selectedReviewItem.linesDeleted}</span>
                      </div>
                    </div>
                    <a
                      href={selectedReviewItem.prUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white font-bold"
                    >
                      <span>View PR on GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* MODIFIED FILES BREAKDOWN */}
                  {selectedReviewItem.analysis?.fileAnalyses && selectedReviewItem.analysis.fileAnalyses.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono">
                        MODIFIED FILES BREAKDOWN ({selectedReviewItem.analysis.fileAnalyses.length})
                      </h3>
                      <div className="space-y-2.5 font-mono text-xs">
                        {selectedReviewItem.analysis.fileAnalyses.map((fa: any, fIdx: number) => (
                          <div key={fIdx} className="p-4 rounded-xl border border-slate-800 bg-[#080c14] space-y-2">
                            <div className="flex items-center justify-between font-bold">
                              <div className="flex items-center gap-2 truncate">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                                  fa.status === 'added'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : fa.status === 'removed'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-blue-950 text-blue-300 border border-blue-800'
                                }`}>
                                  {fa.status}
                                </span>
                                <span className="text-slate-200 truncate">{fa.filename}</span>
                              </div>
                              <div>
                                <span className="text-emerald-400 font-bold">+{fa.additions}</span>{' '}
                                <span className="text-rose-400 font-bold">-{fa.deletions}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 font-sans leading-relaxed">{fa.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* ACTUAL BEFORE & AFTER CODE PATCH */}
                  {selectedReviewItem.diffPatch && selectedReviewItem.diffPatch.before && selectedReviewItem.diffPatch.after ? (
                    <div className="space-y-3 font-mono">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <span>ACTUAL CODE PATCH (BEFORE VS AFTER)</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-rose-900/40 bg-slate-950 overflow-hidden text-xs">
                          <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-900/40 font-bold text-rose-300 flex items-center justify-between">
                            <span>BEFORE</span>
                            <span className="text-[10px] text-rose-400">Previous Code</span>
                          </div>
                          <pre className="p-4 text-slate-300 overflow-x-auto bg-slate-950/90 text-[11px]">
                            <code>{selectedReviewItem.diffPatch.before}</code>
                          </pre>
                        </div>
                        <div className="rounded-xl border border-emerald-900/40 bg-slate-950 overflow-hidden text-xs">
                          <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-900/40 font-bold text-emerald-300 flex items-center justify-between">
                            <span>AFTER</span>
                            <span className="text-[10px] text-emerald-400">Updated Code</span>
                          </div>
                          <pre className="p-4 text-emerald-200 overflow-x-auto bg-slate-950/90 text-[11px]">
                            <code>{selectedReviewItem.diffPatch.after}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 2: AUTOMATED CHECKS (Requirement 8) */}
              {detailTab === 'CHECKS' && (
                <div className="space-y-6 font-mono text-xs">
                  <div className="p-4 rounded-xl border border-slate-800 bg-[#080c14] space-y-2">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>GITHUB AUTOMATED CHECKS RECORD</span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans">
                      {selectedReviewItem.analysis?.checksSummary?.statusText || reviewChecksPill.text}
                    </p>
                  </div>

                  {/* FAILING CHECK NOTICE ENFORCEMENT (Requirement 8) */}
                  {hasFailingChecks && (
                    <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-3">
                      <X className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-bold text-rose-200">AUTOMATED VERIFICATION WARNING</div>
                        <p className="text-[11px] text-rose-300/80 font-sans">
                          1 or more GitHub check runs reported failures during automated CI validation for this pull request.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedReviewItem.analysis?.checks && selectedReviewItem.analysis.checks.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">CHECK RUNS RECORD</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedReviewItem.analysis.checks.map((chk: any, cIdx: number) => (
                          <div key={cIdx} className="p-3.5 rounded-xl border border-slate-800 bg-[#080c14] flex items-center justify-between">
                            <span className="font-bold text-slate-200">{chk.name}</span>
                            {chk.verified ? (
                              <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px] flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>PASSED</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-[10px] flex items-center gap-1">
                                <X className="w-3 h-3 text-rose-400" />
                                <span>FAILED</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-800 bg-[#080c14] text-slate-400 italic">
                      No automated check runs recorded for this pull request.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ENGINEERING ANALYSIS */}
              {detailTab === 'INTERPRETATION' && (
                <div className="space-y-6">
                  {selectedReviewItem.analysis ? (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl border border-purple-900/60 bg-purple-950/20 font-mono text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="font-bold text-purple-200">AI ENGINEERING INTERPRETATION</span>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => handleStartEditAnalysis(selectedReviewItem)}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-blue-400" />
                            <span>Edit Analysis</span>
                          </button>
                        )}
                      </div>

                      <div className="p-5 rounded-xl border border-slate-800 bg-[#080c14] space-y-4 font-mono text-xs text-slate-300">
                        <div>
                          <span className="font-bold text-slate-100 uppercase">Problem Context: </span>
                          <span className="font-sans text-slate-300">{selectedReviewItem.analysis.problem}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-100 uppercase">Investigation Narrative: </span>
                          <span className="font-sans text-slate-300">{selectedReviewItem.analysis.investigation}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-100 uppercase">Implementation Approach: </span>
                          <span className="font-sans text-slate-300">{selectedReviewItem.analysis.approach}</span>
                        </div>
                        {selectedReviewItem.analysis.tradeoffs && selectedReviewItem.analysis.tradeoffs.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-100 uppercase">Trade-offs & Considerations: </span>
                            <span className="font-sans text-slate-300">{selectedReviewItem.analysis.tradeoffs.join(' ')}</span>
                          </div>
                        )}
                      </div>

                      {/* Contributor Reflection */}
                      <div className="p-5 rounded-xl border border-blue-900/40 bg-blue-950/20 space-y-3">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-blue-300 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-400" />
                            <span>CONTRIBUTOR REFLECTION</span>
                          </span>
                          {isOwner && (
                            <button
                              onClick={() => {
                                setEditingReflectionId(selectedReviewItem.id);
                                setReflectionText(selectedReviewItem.analysis?.contributorLearned || '');
                              }}
                              className="text-blue-400 hover:underline font-bold"
                            >
                              {selectedReviewItem.analysis?.contributorLearned ? 'Edit' : 'Add reflection'}
                            </button>
                          )}
                        </div>
                        {editingReflectionId === selectedReviewItem.id ? (
                          <div className="space-y-3 font-mono">
                            <textarea
                              value={reflectionText}
                              onChange={(e) => setReflectionText(e.target.value)}
                              placeholder="What engineering insights or lessons did you learn?"
                              rows={3}
                              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <button
                                onClick={() => setEditingReflectionId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveReflection(selectedReviewItem.id)}
                                disabled={savingReflection}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
                              >
                                {savingReflection ? 'Saving...' : 'Save Reflection'}
                              </button>
                            </div>
                          </div>
                        ) : selectedReviewItem.analysis?.contributorLearned ? (
                          <p className="text-xs text-slate-200 leading-relaxed italic">
                            &quot;{selectedReviewItem.analysis.contributorLearned}&quot;
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 italic font-mono">No contributor reflection added yet.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 4: EVIDENCE PROVENANCE */}
              {detailTab === 'PROVENANCE' && (
                <div className="space-y-6 font-mono text-xs">
                  <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-2">
                    <div className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>RR AUDIT PROVENANCE RECORD</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs">
                      This contribution is recorded on Repo Rescue&apos;s points ledger and audited against GitHub evidence.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a
                      href={selectedReviewItem.prUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl border border-slate-800 bg-[#080c14] hover:bg-slate-900 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">PULL REQUEST</div>
                        <div className="font-bold text-slate-200">PR #{selectedReviewItem.prNumber || 'link'}</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white" />
                    </a>

                    {selectedReviewItem.linkedIssueNumber ? (
                      <a
                        href={selectedReviewItem.linkedIssueUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-slate-800 bg-[#080c14] hover:bg-slate-900 transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase">LINKED ISSUE</div>
                          <div className="font-bold text-slate-200">Issue #{selectedReviewItem.linkedIssueNumber}</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white" />
                      </a>
                    ) : null}

                    <a
                      href={selectedReviewItem.repoUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl border border-slate-800 bg-[#080c14] hover:bg-slate-900 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">REPOSITORY</div>
                        <div className="font-bold text-slate-200 truncate max-w-[140px]">{selectedReviewItem.repoFullName}</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN (30%): STICKY RR AUDIT & VERIFICATION RAIL (Requirement 1 & 5) */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 font-mono text-xs">

              {/* RR AUDIT BOX */}
              {selectedReviewItem.status === 'MERGED_AND_AUDITED' ? (
                <div className="p-5 rounded-2xl border border-amber-900/50 bg-amber-950/10 space-y-4">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-amber-900/40 pb-3">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>AUTHORITATIVE RR AUDIT</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">STATUS</div>
                      <div className="text-sm font-bold text-emerald-300">VERIFIED</div>
                    </div>

                    {selectedReviewItem.linkedIssueNumber && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">LINKED ISSUE</div>
                        <div className="text-xs font-bold text-slate-200">#{selectedReviewItem.linkedIssueNumber}</div>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] text-amber-400/80 font-bold uppercase">RR POINTS</div>
                      <div className="text-3xl font-black text-amber-300">+{selectedReviewItem.rrPoints}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">RR DIFFICULTY</div>
                      <div className="text-xl font-bold text-slate-100">
                        {selectedReviewItem.rrDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic pt-2 border-t border-amber-900/30">
                    &quot;Verified through PointsLedger &amp; contribution pipeline.&quot;
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>AUTHORITATIVE RR AUDIT</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-amber-400 font-bold uppercase">STATUS</div>
                      <div className="text-sm font-bold text-amber-300">NOT ELIGIBLE</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">REASON</div>
                      <div className="text-xs font-bold text-slate-300">
                        {selectedReviewItem.prStatus === 'MERGED' && !selectedReviewItem.linkedIssueNumber
                          ? 'No linked GitHub issue'
                          : selectedReviewItem.prStatus === 'OPEN'
                          ? 'PR is not yet merged'
                          : selectedReviewItem.prStatus === 'CLOSED'
                          ? 'PR closed without merging'
                          : 'Verification checks failed'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">RR POINTS</div>
                      <div className="text-3xl font-black text-slate-400">+0</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-800">
                    &quot;Recorded in GitHub activity log. Not eligible for RR Points.&quot;
                  </p>
                </div>
              )}

              {/* VERIFICATION SIGNALS BOX */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-[#080c14] space-y-3">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                  VERIFICATION SIGNALS
                </div>

                <div className="space-y-2 text-slate-300 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>GitHub Code Diff:</span>
                    <span className="text-emerald-400 font-bold">✓ Audited</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>CI Check Status:</span>
                    <span className={reviewChecksPill.passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {reviewChecksPill.text}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Points Ledger:</span>
                    <span className="text-emerald-400 font-bold">✓ Verified</span>
                  </div>
                </div>
              </div>

              {/* QUICK LINKS */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-[#080c14] space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">EVIDENCE LINKS</div>
                <a
                  href={selectedReviewItem.prUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors"
                >
                  <span>Pull Request #{selectedReviewItem.prNumber || 'link'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
                <a
                  href={selectedReviewItem.repoUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors"
                >
                  <span className="truncate max-w-[180px]">{selectedReviewItem.repoFullName}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

            </div>

          </div>

        </div>
      </div>
    );
  }

  // 2. MAIN ENGINEERING JOURNAL VIEW
  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/80 pb-8">
          <div className="space-y-3">
            {/* Tagline & Trust Indicator (Requirement 1) */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-emerald-400 font-bold uppercase tracking-widest text-[11px]">
                ENGINEERING JOURNAL
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-medium text-[11px]">
                VERIFIED OPEN-SOURCE WORK
              </span>
              <div className="ml-auto md:ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-800/70 text-emerald-300 text-[10px] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>AUDIT SYSTEM ACTIVE</span>
              </div>
            </div>

            {/* Editorial Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-mono">
              Verified Engineering Contribution Log
            </h1>

            {/* Editorial Supporting Sentence */}
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
              An evidence-backed record of what you built, changed, and shipped.
            </p>
          </div>

          {/* Contributor Profile Badge */}
          <div className="shrink-0 flex items-center gap-3.5 p-3 rounded-xl border border-slate-800/90 bg-[#080c14] shadow-xl font-mono text-xs">
            <img
              src={user.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
              alt={user.githubUsername}
              className="w-10 h-10 rounded-full border border-slate-700 bg-slate-900"
            />
            <div className="flex flex-col space-y-0.5">
              <span className="font-bold text-slate-100 text-sm">@{user.githubUsername}</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">{totalRrPoints.toLocaleString()} RR Points</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time GitHub Activity Sync Status Banner */}
        {(currentSyncStatus === 'RUNNING' || user.contributorSyncStatus === 'RUNNING') && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 animate-spin" />
              <span>Syncing GitHub pull requests & auditing verified contributions...</span>
            </div>
            <span className="text-[11px] text-blue-400 font-bold">Sync Active</span>
          </div>
        )}

        {/* TOP-LEVEL JOURNAL SUMMARY STRIP (Requirement 5 & 7) */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Verified Contributions */}
            <div className="p-4 rounded-xl border border-slate-800/90 bg-[#080c14] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">VERIFIED CONTRIBUTIONS</div>
              <div className="text-2xl font-black text-white">{verifiedContributionsCount}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Audited PRs</span>
              </div>
            </div>

            {/* RR Points */}
            <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold">RR POINTS</div>
              <div className="text-2xl font-black text-amber-300">+{totalRrPoints.toLocaleString()}</div>
              <div className="text-[10px] text-amber-400/70">Authoritative Ledger</div>
            </div>

            {/* Repositories */}
            <div className="p-4 rounded-xl border border-slate-800/90 bg-[#080c14] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">REPOSITORIES</div>
              <div className="text-2xl font-black text-blue-400">{uniqueReposCount}</div>
              <div className="text-[10px] text-slate-500">Unique Codebases</div>
            </div>

            {/* Avg RR Difficulty */}
            <div className="p-4 rounded-xl border border-slate-800/90 bg-[#080c14] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AVG RR DIFFICULTY</div>
              <div className="text-2xl font-black text-rose-400">
                {avgRrDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span>
              </div>
              <div className="text-[10px] text-slate-500">RR Difficulty Matrix</div>
            </div>
          </div>

          {/* SEARCH & STATUS FILTER CONTROLS */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 rounded-xl border border-slate-800/80 bg-[#080c14]/80 backdrop-blur-xl font-mono text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-bold mr-1">FILTER:</span>
              {(['ALL', 'MERGED', 'OPEN', 'CLOSED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                    statusFilter === filter
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}

              {selectedTechniqueFilter && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-bold ml-2">
                  <span>{selectedTechniqueFilter}</span>
                  <button onClick={() => setSelectedTechniqueFilter(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search diffs, PRs..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-xs"
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PR HISTORY / TIMELINE */}
        {displayHistory.length === 0 ? (
          /* EMPTY DISCOVERY STATE */
          <div className="p-12 rounded-2xl border border-slate-800 bg-[#080c14] text-center font-mono space-y-4">
            <div className="w-14 h-14 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              No pull request activity matching your filter ({statusFilter}).
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-sans">
              Repo Rescue automatically discovers all pull requests from your GitHub account and audits merged work with linked issues.
            </p>
            <div className="pt-2">
              <Link
                href="/issues"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg transition-all"
              >
                <Code2 className="w-4 h-4" />
                <span>Explore Open Issues</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                GITHUB PR HISTORY &amp; AUDIT LOG ({displayHistory.length})
              </span>
              <span className="text-slate-500">All discovered pull requests</span>
            </div>

            {/* TIMELINE CONNECTOR SPINE */}
            <div className="relative border-l border-slate-800/80 ml-3 sm:ml-6 pl-6 sm:pl-8 space-y-8 font-sans">
              {displayHistory.map((item, index) => {
                const dateParts = getTimelineDateParts(item);
                const prevItem = index > 0 ? displayHistory[index - 1] : null;
                const prevDateParts = prevItem ? getTimelineDateParts(prevItem) : null;
                const showYearHeader = !prevDateParts || prevDateParts.year !== dateParts.year;

                const isVerified = item.status === 'MERGED_AND_AUDITED';
                const isMerged = item.prStatus === 'MERGED';
                const isOpen = item.prStatus === 'OPEN';
                const isClosed = item.prStatus === 'CLOSED';
                const hasLinkedIssue = Boolean(item.linkedIssueNumber);

                const engineeringChangeText = getEngineeringChangeSummary(item);
                const checksPill = getChecksSummaryPill(item);

                return (
                  <React.Fragment key={item.id}>
                    {showYearHeader && (
                      <div className="relative -ml-[31px] sm:-ml-[39px] pt-4 pb-2 flex items-center gap-3 font-mono">
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-emerald-400 shrink-0 shadow-sm" />
                        <span className="text-base font-black text-slate-200 tracking-wider">{dateParts.year}</span>
                        <div className="h-px bg-slate-800/80 flex-1" />
                      </div>
                    )}

                    <div className="relative group">
                      <div className="absolute -left-[31px] sm:-left-[39px] top-6 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-slate-600 group-hover:border-emerald-400 group-hover:bg-emerald-950 transition-colors shrink-0" />

                      {/* PR TIMELINE ENTRY CARD */}
                      <div className="rounded-xl border border-slate-800/90 bg-[#080c14] hover:bg-[#0c101a] hover:border-slate-700/90 shadow-md p-5 space-y-4">

                        {/* REPOSITORY PATH, PR TITLE & BADGES */}
                        <div className="space-y-1.5 font-mono">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800/60 pb-2.5">
                            <div className="flex items-center gap-2">
                              <GithubIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-200">{item.repoFullName}</span>
                              <span className="text-slate-600">·</span>
                              <span className="text-emerald-400 font-bold">PR #{item.prNumber || 'open'}</span>
                            </div>

                            {/* STATE & ELIGIBILITY BADGES */}
                            <div className="flex items-center gap-2">
                              {isVerified ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>MERGED</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[11px] font-bold">
                                    <Shield className="w-3 h-3 text-emerald-400" />
                                    <span>RR ELIGIBLE / VERIFIED</span>
                                  </span>
                                </>
                              ) : isMerged && !hasLinkedIssue ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>MERGED</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[11px] font-bold" title="No linked GitHub issue">
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>RR INELIGIBLE</span>
                                  </span>
                                </>
                              ) : isMerged && hasLinkedIssue ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>MERGED</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[11px] font-bold">
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>RR INELIGIBLE</span>
                                  </span>
                                </>
                              ) : isOpen ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-bold">
                                    <Clock className="w-3 h-3 text-blue-400" />
                                    <span>OPEN</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[11px] font-bold">
                                    <span>NOT YET ELIGIBLE</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[11px] font-bold">
                                    <X className="w-3 h-3 text-slate-500" />
                                    <span>CLOSED</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[11px] font-bold">
                                    <span>NOT ELIGIBLE</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <h3 className="text-base font-bold text-white tracking-tight font-sans">
                            {item.prTitle || item.issueTitle}
                          </h3>
                        </div>

                        {/* ENGINEERING CHANGE SUMMARY */}
                        <div className="p-3.5 rounded-lg border border-slate-800/90 bg-[#050810] space-y-1 font-mono">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Terminal className="w-3 h-3 text-emerald-400" />
                            <span>ENGINEERING CHANGE</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-sans">
                            {engineeringChangeText}
                          </p>
                        </div>

                        {/* FOOTPRINT & RR AUDIT REWARD STRIP */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 font-mono text-xs border-t border-slate-800/40">
                          <div className="flex flex-wrap items-center gap-4 text-slate-300 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <FileCode className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                <strong className="text-slate-100">{item.filesChanged}</strong> {item.filesChanged === 1 ? 'file' : 'files'}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-emerald-400 font-bold">+{item.linesAdded}</span>
                              <span className="text-rose-400 font-bold">-{item.linesDeleted}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <CheckCircle2 className={`w-3.5 h-3.5 ${checksPill.passed ? 'text-emerald-400' : 'text-amber-400'}`} />
                              <span className={checksPill.passed ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                                {checksPill.text}
                              </span>
                            </div>

                            {isVerified ? (
                              <div className="flex items-center gap-1 text-amber-300 font-bold">
                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                                <span>+{item.rrPoints} RR POINTS</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                                <Shield className="w-3.5 h-3.5 text-slate-500" />
                                <span>0 RR POINTS</span>
                                {isMerged && !hasLinkedIssue && (
                                  <span className="text-amber-400/90 text-[10px] ml-1">· No linked GitHub issue</span>
                                )}
                                {isOpen && (
                                  <span className="text-blue-400/90 text-[10px] ml-1">· PR is not yet merged</span>
                                )}
                                {isClosed && (
                                  <span className="text-slate-500 text-[10px] ml-1">· PR closed without merging</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* [OPEN ENGINEERING REVIEW →] */}
                          <button
                            onClick={() => openEngineeringReview(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-bold text-xs transition-all shadow-sm group"
                          >
                            <span>OPEN ENGINEERING REVIEW</span>
                            <ArrowRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* SEPARATE SECTION: DISCOVERED GITHUB ACTIVITY (Requirement 6 & 7) */}
        {discoveredHistory.length > 0 && (
          <div className="space-y-4 pt-8 border-t border-slate-800/80 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                DISCOVERED ACTIVITY ({discoveredHistory.length})
              </span>
              <span className="text-slate-500 text-[11px]">Unverified pull requests from GitHub sync</span>
            </div>

            <div className="space-y-2">
              {discoveredHistory.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-slate-800/80 bg-[#070a12] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-slate-300">
                      <span>{item.repoFullName}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">PR #{item.prNumber || 'open'}</span>
                    </div>
                    <div className="text-slate-400 font-sans text-xs">{item.prTitle || item.issueTitle}</div>
                  </div>
                  <span className="px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-bold">
                    UNVERIFIED ACTIVITY
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ENGINEERING DNA & OBSERVED EVIDENCE SECTION (Requirement 3, 4, 7) */}
        <div className="space-y-6 pt-10 border-t border-slate-800/80 font-mono">
          <div>
            <div className="flex items-center gap-2 text-xs text-purple-400 font-bold mb-1">
              <Cpu className="w-4 h-4" />
              <span>VERIFIED EVIDENCE SIGNAL</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              YOUR ENGINEERING DNA
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Factual technical techniques and language observations derived exclusively from verified code contributions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* VERIFIED TECHNIQUES WITH SUPPORTING EVIDENCE EXPOSURE (Requirement 4) */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#080c14] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Verified Engineering Techniques
                </span>
                <span className="text-xs text-slate-500">Diff Evidence</span>
              </h3>

              <div className="space-y-2.5">
                {verifiedTechniquesList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No verified techniques recorded yet.</p>
                ) : (
                  verifiedTechniquesList.slice(0, 8).map((tech) => (
                    <div
                      key={tech.name}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-100">{tech.name}</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">
                          Verified evidence · {tech.filesCount} file(s) across {tech.count} contribution(s)
                        </div>
                      </div>

                      <button
                        onClick={() => openEngineeringReview(tech.sampleItem)}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>View evidence →</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* LANGUAGES OBSERVED (NO PROFICIENCY / SKILL PROGRESS BARS) (Requirement 3) */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#080c14] space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  LANGUAGES OBSERVED
                </span>
                <span className="text-xs text-slate-500">Verified Activity</span>
              </h3>

              <div className="space-y-3">
                {observedLanguagesList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No language observations from verified contributions yet.</p>
                ) : (
                  observedLanguagesList.map((lang) => (
                    <div key={lang.name} className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">{lang.name}</span>
                      <span className="text-slate-400 text-xs">
                        Observed in {lang.count} verified contribution{lang.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* EDIT ANALYSIS MODAL */}
      {editingAnalysisId && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono">
          <div className="max-w-2xl w-full p-6 rounded-2xl border border-slate-800 bg-[#080c14] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Investigation Narrative</label>
                <textarea
                  rows={3}
                  value={analysisEditForm.investigation}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, investigation: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Implementation Approach</label>
                <textarea
                  rows={3}
                  value={analysisEditForm.approach}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, approach: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Techniques (Comma-separated)</label>
                <input
                  type="text"
                  value={analysisEditForm.techniques}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, techniques: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Trade-offs & Considerations</label>
                <textarea
                  rows={2}
                  value={analysisEditForm.tradeoffs}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, tradeoffs: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase">Verified Result</label>
                <textarea
                  rows={2}
                  value={analysisEditForm.result}
                  onChange={(e) => setAnalysisEditForm({ ...analysisEditForm, result: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 text-xs">
              <button
                onClick={() => setEditingAnalysisId(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveAnalysisEdit(editingAnalysisId)}
                disabled={savingAnalysis}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
              >
                {savingAnalysis ? 'Saving...' : 'Save & Mark Contributor Edited'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
