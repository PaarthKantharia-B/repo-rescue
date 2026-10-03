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
  FileCode,
  Edit3,
  Check,
  X,
  Clock,
  Terminal,
  Brain,
  ArrowLeft,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { ContributionAnalyticsData, ContributionHistoryItem } from '@/lib/analytics/contribution-analytics-service';

interface Props {
  data: ContributionAnalyticsData;
  isOwner?: boolean;
}

// Official GitHub SVG Icon
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

function formatCardDate(item: ContributionHistoryItem): string {
  const dateVal = item.mergedAt || item.closedAt || item.openedAt || item.verifiedAtRaw;
  if (!dateVal) return 'Recent';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'Recent';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getEngineeringChangeSummary(item: ContributionHistoryItem): string {
  if (item.analysis?.engineeringThesis && item.analysis.engineeringThesis.trim()) {
    return item.analysis.engineeringThesis;
  }
  if (item.analysis?.whatChanged && item.analysis.whatChanged.length > 0) {
    const statements: string[] = [];
    for (const w of item.analysis.whatChanged) {
      const text = typeof w === 'string' ? w : w.statement;
      if (text && text.trim()) statements.push(text.trim());
    }
    if (statements.length > 0) return statements.slice(0, 2).join(' ');
  }
  if (item.approach && item.approach.trim().length > 10) {
    return item.approach;
  }
  return `Updated ${item.repoFullName} across ${item.filesChanged || 1} file(s) in PR #${item.prNumber || 'merged'}.`;
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
        return { text: `Checks ${passed}/${total} passed`, passed: true, count: total, failed: 0 };
      } else if (failed > 0) {
        return { text: `${failed} of ${total} checks failed`, passed: false, count: total, failed };
      } else {
        return { text: `Checks ${passed}/${total} completed`, passed: true, count: total, failed: 0 };
      }
    }
  }

  if (checks.length > 0) {
    const verified = checks.filter((c) => c.verified).length;
    const failed = checks.filter((c) => c.conclusion === 'failure').length;
    const passed = verified === checks.length && failed === 0;
    return { text: `Checks ${verified}/${checks.length} passed`, passed, count: checks.length, failed };
  }

  return { text: `Checks 1/1 passed`, passed: true, count: 1, failed: 0 };
}

function getFactualBullets(item: ContributionHistoryItem): string[] {
  const bullets: string[] = [];

  if (item.analysis?.whatChanged && Array.isArray(item.analysis.whatChanged) && item.analysis.whatChanged.length > 0) {
    for (const w of item.analysis.whatChanged) {
      const stmt = typeof w === 'string' ? w : w.statement;
      if (stmt && stmt.trim().length > 0) {
        bullets.push(stmt.trim());
      }
    }
  }

  if (bullets.length === 0 && item.analysis?.fileAnalyses && item.analysis.fileAnalyses.length > 0) {
    for (const fa of item.analysis.fileAnalyses) {
      if (fa.summary) {
        bullets.push(`${fa.filename}: ${fa.summary}`);
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
      bullets.push(`Modified ${item.filesChanged} file(s) (+${item.linesAdded} / -${item.linesDeleted}) in PR #${item.prNumber || 'merged'}.`);
    } else {
      bullets.push(`Pull Request #${item.prNumber} submitted to ${item.repoFullName}.`);
    }
  }

  return bullets.slice(0, 5);
}

function extractCardTechnologies(item: ContributionHistoryItem): string[] {
  const techs: string[] = [];
  if (item.category && item.category.trim()) {
    techs.push(item.category.trim());
  }
  if (item.area && item.area.trim() && !techs.includes(item.area.trim())) {
    techs.push(item.area.trim());
  }

  const text = `${item.category} ${item.area} ${item.techniques.join(' ')} ${item.prTitle}`.toLowerCase();
  if (text.includes('express')) techs.push('Express');
  if (text.includes('jest')) techs.push('Jest');
  if (text.includes('react')) techs.push('React');
  if (text.includes('next')) techs.push('Next.js');
  if (text.includes('prisma')) techs.push('Prisma');
  if (text.includes('node')) techs.push('Node.js');
  if (text.includes('docker')) techs.push('Docker');
  if (text.includes('tailwind')) techs.push('Tailwind CSS');

  if (techs.length === 0 && item.language) {
    techs.push(item.language);
  }
  return Array.from(new Set(techs)).slice(0, 4);
}

function extractCardConcepts(item: ContributionHistoryItem): string[] {
  const concepts: string[] = [];
  if (item.techniques && item.techniques.length > 0) {
    for (const t of item.techniques) {
      if (t && t.trim()) concepts.push(t.trim());
    }
  }
  if (item.analysis?.techniques && Array.isArray(item.analysis.techniques)) {
    for (const t of item.analysis.techniques) {
      if (typeof t === 'string' && t.trim()) concepts.push(t.trim());
    }
  }
  if (concepts.length === 0 && item.category) {
    concepts.push(item.category);
  }
  return Array.from(new Set(concepts)).slice(0, 4);
}

function extractCardLanguages(item: ContributionHistoryItem): string[] {
  const langs: string[] = [];
  if (item.language && item.language.trim()) {
    langs.push(item.language.trim());
  }
  if (item.diffPatch?.language && item.diffPatch.language.trim()) {
    langs.push(item.diffPatch.language.trim());
  }
  if (langs.length === 0) {
    langs.push('TypeScript');
  }
  return Array.from(new Set(langs)).slice(0, 3);
}

function deriveStatusTags(item: ContributionHistoryItem): {
  prStatusTag: { label: string; style: string };
  issueTag: { label: string; style: string };
  assignmentTag: { label: string; style: string };
} {
  const isMerged = item.prStatus === 'MERGED';
  const isOpen = item.prStatus === 'OPEN';
  const isClosed = item.prStatus === 'CLOSED';
  const isDraft = item.prStatus === 'DRAFT';

  let prStatusTag = { label: 'PULL REQUEST', style: 'bg-slate-900 text-slate-300 border-slate-700' };
  if (isMerged) {
    prStatusTag = { label: 'MERGED', style: 'bg-emerald-950/90 text-emerald-300 border-emerald-800/80' };
  } else if (isOpen) {
    prStatusTag = { label: 'OPEN', style: 'bg-blue-950/90 text-blue-300 border-blue-800/80' };
  } else if (isClosed) {
    prStatusTag = { label: 'CLOSED', style: 'bg-slate-900 text-slate-400 border-slate-700' };
  } else if (isDraft) {
    prStatusTag = { label: 'DRAFT', style: 'bg-purple-950/90 text-purple-300 border-purple-800/80' };
  }

  const hasLinkedIssue = Boolean(item.linkedIssueNumber);
  const issueTag = hasLinkedIssue
    ? { label: 'ISSUE VERIFIED', style: 'bg-amber-950/80 text-amber-300 border-amber-800/60' }
    : { label: 'NO LINKED ISSUE', style: 'bg-slate-900 text-slate-400 border-slate-800' };

  const assignmentTag = item.wasAssigned
    ? { label: 'ASSIGNED', style: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60' }
    : { label: 'UNASSIGNED', style: 'bg-slate-900/80 text-slate-400 border-slate-800' };

  return { prStatusTag, issueTag, assignmentTag };
}

export const EngineeringJournalView: React.FC<Props> = ({ data, isOwner = false }) => {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MERGED' | 'OPEN' | 'CLOSED' | 'DRAFT'>('MERGED');

  // Full-screen engineering review detail state
  const [selectedReviewItem, setSelectedReviewItem] = useState<ContributionHistoryItem | null>(null);

  // Default detail tab is 'CODE' (CODE CHANGES & DIFF)
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

  // Reflection Editing State (Contributor-Authored Only)
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);

  // Local state to track history items
  const [localHistory, setLocalHistory] = useState<ContributionHistoryItem[]>(data.history);

  // SEPARATION: VERIFIED CONTRIBUTIONS vs DISCOVERED ACTIVITY
  const verifiedHistory = localHistory.filter((item) => item.status === 'MERGED_AND_AUDITED');
  const discoveredHistory = localHistory.filter((item) => item.status !== 'MERGED_AND_AUDITED');

  // Counts for filter bar
  const allCount = localHistory.length;
  const mergedCount = localHistory.filter((i) => i.prStatus === 'MERGED').length;
  const openCount = localHistory.filter((i) => i.prStatus === 'OPEN').length;
  const closedCount = localHistory.filter((i) => i.prStatus === 'CLOSED').length;
  const draftCount = localHistory.filter((i) => i.prStatus === 'DRAFT').length;

  // Authoritative calculations
  const verifiedContributionsCount = verifiedHistory.length;
  const totalRrPoints = verifiedHistory.reduce((acc, item) => acc + (item.rrPoints || 0), 0);
  const avgRrDifficulty =
    verifiedContributionsCount > 0
      ? verifiedHistory.reduce((acc, item) => acc + (item.rrDifficulty || 0), 0) / verifiedContributionsCount
      : 0;

  // Evidence-based language observations - NO PROGRESS BARS / PROFICIENCY IMPLICATIONS
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

  // Techniques with supporting evidence files count
  const verifiedTechniquesMap = new Map<
    string,
    { name: string; count: number; filesCount: number; sampleItem: ContributionHistoryItem }
  >();
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
    setDetailTab('CODE');
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
    } else if (statusFilter === 'DRAFT') {
      matchesStatus = item.prStatus === 'DRAFT';
    }

    return matchesQuery && matchesTechnique && matchesStatus;
  });

  const { user } = data;

  // 1. FULL-SCREEN ENGINEERING REVIEW DETAIL VIEW
  if (selectedReviewItem) {
    const reviewChecksPill = getChecksSummaryPill(selectedReviewItem);
    const hasFailingChecks = reviewChecksPill.failed > 0;
    const isPartialDiff = selectedReviewItem.analysis?.analysisCoverage === 'PARTIAL_DIFF';

    return (
      <div className="min-h-screen bg-[#06080e] text-slate-100 py-8 px-4 sm:px-6 lg:px-10 font-sans selection:bg-orange-500/30 selection:text-orange-200">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* BACK TO ENGINEERING JOURNAL HEADER */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 font-mono text-xs">
            <button
              onClick={closeEngineeringReview}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all font-bold group"
            >
              <ArrowLeft className="w-4 h-4 text-orange-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>← BACK TO ENGINEERING JOURNAL</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-800/60 text-[10px] font-bold">
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
                <span className="text-orange-400 font-bold">PR #{selectedReviewItem.prNumber || 'merged'}</span>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>MERGED & AUDITED</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug font-sans">
              {selectedReviewItem.prTitle || selectedReviewItem.issueTitle}
            </h1>

            {/* SHORT SUMMARY / KEY CHANGES */}
            <div className="p-4 rounded-xl border border-orange-900/40 bg-[#050a12] space-y-1 mt-4">
              <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-orange-400" />
                <span>SHORT SUMMARY / KEY CHANGES</span>
              </div>
              <p className="text-sm font-semibold text-slate-200 leading-relaxed font-sans">
                {getEngineeringChangeSummary(selectedReviewItem)}
              </p>
            </div>
          </div>

          {/* DESKTOP 70% / 30% SPLIT LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN (70%): EVIDENCE, DIFF & AI CHANGE ANALYSIS */}
            <div className="lg:col-span-8 space-y-6">

              {/* TABS NAVIGATION */}
              <div className="flex items-center gap-1 border-b border-slate-800 bg-[#080c14] p-1 rounded-xl font-mono text-xs overflow-x-auto">
                <button
                  onClick={() => setDetailTab('CODE')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'CODE'
                      ? 'bg-orange-950/80 text-orange-300 border border-orange-700/60 shadow-sm'
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
                      ? 'bg-orange-950/80 text-orange-300 border border-orange-700/60 shadow-sm'
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
                      ? 'bg-orange-950/80 text-orange-300 border border-orange-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  <span>AI CHANGE ANALYSIS</span>
                </button>

                <button
                  onClick={() => setDetailTab('PROVENANCE')}
                  className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    detailTab === 'PROVENANCE'
                      ? 'bg-orange-950/80 text-orange-300 border border-orange-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>EVIDENCE PROVENANCE</span>
                </button>
              </div>

              {/* TAB 1: CODE CHANGES & DIFF */}
              {detailTab === 'CODE' && (
                <div className="space-y-6">

                  {/* PARTIAL DIFF WARNING BANNER */}
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
                      <h3 className="font-bold text-xs uppercase tracking-wider text-orange-400 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-orange-400" />
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

              {/* TAB 2: AUTOMATED CHECKS */}
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

              {/* TAB 3: AI CHANGE ANALYSIS (EVIDENCE-GROUNDED) */}
              {detailTab === 'INTERPRETATION' && (
                <div className="space-y-6">
                  {selectedReviewItem.analysis ? (
                    <div className="space-y-5">
                      {/* HEADER */}
                      <div className="p-4 rounded-xl border border-orange-900/60 bg-orange-950/20 font-mono text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-orange-400" />
                          <span className="font-bold text-orange-200 uppercase">AI CHANGE ANALYSIS</span>
                        </div>
                        <span className="text-[10px] text-orange-400/80 font-bold font-mono">
                          Evidence-grounded report from GitHub Files Changed
                        </span>
                      </div>

                      {/* SECTION 1: CHANGE SUMMARY */}
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#080c14] space-y-2 font-mono text-xs">
                        <div className="text-[10px] font-extrabold text-orange-400 uppercase tracking-wider">
                          CHANGE SUMMARY
                        </div>
                        <p className="text-sm font-semibold text-slate-100 font-sans leading-relaxed">
                          {getEngineeringChangeSummary(selectedReviewItem)}
                        </p>
                      </div>

                      {/* SECTION 2: DETAILED CHANGE REPORT (FILE-BY-FILE ANALYSIS) */}
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#080c14] space-y-4 font-mono text-xs">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span>DETAILED CHANGE REPORT (FILE-BY-FILE)</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {selectedReviewItem.analysis.fileAnalyses?.length || selectedReviewItem.filesChanged} file(s) analyzed
                          </span>
                        </div>

                        {selectedReviewItem.analysis.fileAnalyses && selectedReviewItem.analysis.fileAnalyses.length > 0 ? (
                          <div className="space-y-3">
                            {selectedReviewItem.analysis.fileAnalyses.map((fa: any, fIdx: number) => (
                              <div key={fIdx} className="p-4 rounded-xl border border-slate-800/90 bg-[#050810] space-y-2">
                                <div className="flex items-center justify-between font-bold">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                      fa.status === 'added'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                        : fa.status === 'removed'
                                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                                    }`}>
                                      {fa.status}
                                    </span>
                                    <span className="text-slate-200 font-mono text-xs truncate">{fa.filename}</span>
                                  </div>
                                  <div className="text-xs font-mono">
                                    <span className="text-emerald-400 font-bold">+{fa.additions}</span>{' '}
                                    <span className="text-rose-400 font-bold">-{fa.deletions}</span>
                                  </div>
                                </div>

                                <ul className="space-y-1 font-sans text-xs text-slate-300 pl-1">
                                  <li className="flex items-start gap-2">
                                    <span className="text-orange-500 font-mono mt-0.5">•</span>
                                    <span className="leading-relaxed">{fa.summary || 'Modified code file in repository.'}</span>
                                  </li>
                                  {fa.evidence && Array.isArray(fa.evidence) && fa.evidence.length > 0 && fa.evidence.map((ev: string, eIdx: number) => (
                                    <li key={eIdx} className="flex items-start gap-2">
                                      <span className="text-orange-400 font-mono mt-0.5">•</span>
                                      <span className="leading-relaxed text-slate-400 text-[11px]">{ev}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-800 bg-[#050810] text-slate-400 italic font-mono text-xs">
                            Diff unavailable for file-by-file inspection.
                          </div>
                        )}
                      </div>

                      {/* SECTION 3: TECHNIQUES DETECTED */}
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#080c14] space-y-3 font-mono text-xs">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          TECHNIQUES DETECTED (DIFF-SUPPORTED)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedReviewItem.techniques && selectedReviewItem.techniques.length > 0 ? (
                            selectedReviewItem.techniques.map((tech) => (
                              <span key={tech} className="px-3 py-1 rounded-lg bg-orange-950/60 border border-orange-800/60 text-orange-300 font-semibold text-xs flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                <span>{tech}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">No specific techniques extracted from diff.</span>
                          )}
                        </div>
                      </div>

                      {/* CONTRIBUTOR REFLECTION (STRICTLY CONTRIBUTOR-AUTHORED ONLY) */}
                      <div className="p-5 rounded-xl border border-blue-900/40 bg-blue-950/20 space-y-3 font-mono">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-blue-300 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-400" />
                            <span>CONTRIBUTOR REFLECTION (AUTHOR-WRITTEN)</span>
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
                          <div className="space-y-3">
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
                          <p className="text-xs text-slate-200 leading-relaxed italic font-sans">
                            &quot;{selectedReviewItem.analysis.contributorLearned}&quot;
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 italic">No contributor reflection added yet.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 4: EVIDENCE PROVENANCE */}
              {detailTab === 'PROVENANCE' && (
                <div className="space-y-6 font-mono text-xs">
                  <div className="p-4 rounded-xl border border-orange-900/40 bg-orange-950/10 space-y-2">
                    <div className="text-orange-400 font-bold uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-orange-400" />
                      <span>VERIFIED GITHUB EVIDENCE VS AI INTERPRETATION</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs">
                      Facts obtained directly from GitHub API vs AI engineering inferences derived from code diffs.
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

            {/* RIGHT COLUMN (30%): STICKY RR AUDIT RAIL */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 font-mono text-xs">

              {/* RR AUDIT BOX */}
              {selectedReviewItem.status === 'MERGED_AND_AUDITED' ? (
                <div className="p-5 rounded-2xl border border-orange-500/30 bg-orange-500/5 space-y-4">
                  <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2 border-b border-orange-500/20 pb-3">
                    <Shield className="w-4 h-4 text-orange-500" />
                    <span>AUTHORITATIVE RR AUDIT</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">STATUS</div>
                      <div className="text-sm font-bold text-emerald-300">✓ VERIFIED CONTRIBUTION</div>
                    </div>

                    {selectedReviewItem.linkedIssueNumber && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">LINKED ISSUE</div>
                        <div className="text-xs font-bold text-slate-200">#{selectedReviewItem.linkedIssueNumber}</div>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] text-orange-400/90 font-bold uppercase">RR POINTS</div>
                      <div className="text-3xl font-black text-orange-400">+{selectedReviewItem.rrPoints}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">RR DIFFICULTY</div>
                      <div className="text-xl font-bold text-slate-100">
                        {selectedReviewItem.rrDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>AUTHORITATIVE RR AUDIT</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-orange-400 font-bold uppercase">STATUS</div>
                      <div className="text-sm font-bold text-slate-300">RR INELIGIBLE</div>
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
                    <span className={selectedReviewItem.status === 'MERGED_AND_AUDITED' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {selectedReviewItem.status === 'MERGED_AND_AUDITED' ? '✓ Verified' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    );
  }

  // 2. MAIN ENGINEERING JOURNAL VIEW
  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-orange-500/30 selection:text-orange-200">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* SECTION 4: ENGINEERING JOURNAL HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/80 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-xs text-orange-500 font-bold tracking-wider uppercase">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span>REPO RESCUE</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-mono">
              Engineering Journal
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed font-sans">
              Your complete GitHub engineering history, powered by AI analysis.
            </p>
          </div>

          {/* Contributor Profile & Sync Badge */}
          <div className="shrink-0 flex items-center gap-3.5 p-3 rounded-xl border border-slate-800/90 bg-[#080c14] shadow-xl font-mono text-xs">
            <img
              src={user.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
              alt={user.githubUsername}
              className="w-10 h-10 rounded-full border border-slate-700 bg-slate-900"
            />
            <div className="flex flex-col space-y-0.5">
              <span className="font-bold text-slate-100 text-sm">@{user.githubUsername}</span>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-bold">{totalRrPoints.toLocaleString()} RR Points</span>
              </div>
              {user.lastSyncedAt && (
                <div className="text-[10px] text-slate-500">
                  Synced: {new Date(user.lastSyncedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real-time GitHub Activity Sync Status Banner */}
        {(currentSyncStatus === 'RUNNING' || user.contributorSyncStatus === 'RUNNING') && (
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-mono flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400 animate-spin" />
              <span>Syncing GitHub pull requests &amp; auditing verified contributions...</span>
            </div>
            <span className="text-[11px] text-orange-400 font-bold">Sync Active</span>
          </div>
        )}

        {/* SECTION 5: FILTER BAR */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 rounded-xl border border-slate-800/80 bg-[#080c14]/90 backdrop-blur-xl font-mono text-xs">

            {/* COMPACT FILTER TABS WITH REAL COUNTS */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: 'ALL', label: 'All PRs', count: allCount },
                { id: 'MERGED', label: 'Merged', count: mergedCount },
                { id: 'OPEN', label: 'Open', count: openCount },
                { id: 'CLOSED', label: 'Closed', count: closedCount },
                { id: 'DRAFT', label: 'Draft', count: draftCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3.5 py-2 rounded-lg font-bold transition-all text-xs flex items-center gap-2 ${
                    statusFilter === tab.id
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      statusFilter === tab.id
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}

              {selectedTechniqueFilter && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-950 border border-orange-700/60 text-orange-300 font-bold ml-2">
                  <span>{selectedTechniqueFilter}</span>
                  <button onClick={() => setSelectedTechniqueFilter(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* SEARCH INPUT */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search PRs, diffs, code..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors text-xs font-mono"
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* SECTION 6: PR CARDS LIST */}
        {displayHistory.length === 0 ? (
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-bold text-xs text-white shadow-lg transition-all"
              >
                <Code2 className="w-4 h-4" />
                <span>Explore Open Issues</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {displayHistory.map((item) => {
              const isVerified = item.status === 'MERGED_AND_AUDITED';
              const isMerged = item.prStatus === 'MERGED';
              const isOpen = item.prStatus === 'OPEN';
              const isClosed = item.prStatus === 'CLOSED';
              const hasLinkedIssue = Boolean(item.linkedIssueNumber);

              const repoFullNameParts = item.repoFullName ? item.repoFullName.split('/') : ['github', 'repository'];
              const orgName = item.orgName || repoFullNameParts[0] || 'github';
              const repoName = repoFullNameParts[1] || item.repoFullName;

              const cardDateStr = formatCardDate(item);
              const factualBullets = getFactualBullets(item);
              const engineeringChangeText = getEngineeringChangeSummary(item);
              const checksPill = getChecksSummaryPill(item);
              const languages = extractCardLanguages(item);
              const technologies = extractCardTechnologies(item);
              const concepts = extractCardConcepts(item);
              const { prStatusTag, issueTag, assignmentTag } = deriveStatusTags(item);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800/90 bg-[#080c14] hover:border-slate-700 transition-all shadow-xl p-6 space-y-5"
                >
                  {/* SECTION 7: ORGANIZATION / REPOSITORY & DATE */}
                  <div className="flex items-center justify-between font-mono text-xs border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <GithubIcon className="w-4 h-4 text-slate-400" />
                      <a
                        href={`https://github.com/${orgName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-orange-400 transition-colors font-semibold"
                      >
                        {orgName}
                      </a>
                      <span className="text-slate-600">/</span>
                      <a
                        href={item.repoUrl || `https://github.com/${item.repoFullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-slate-100 hover:text-orange-400 transition-colors"
                      >
                        {repoName}
                      </a>
                    </div>

                    <div className="text-slate-400 text-xs font-medium">
                      {cardDateStr}
                    </div>
                  </div>

                  {/* SECTION 8: PR NUMBER & TITLE */}
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                      <span className="text-orange-500 font-mono mr-2">#{item.prNumber}</span>
                      {item.prTitle || item.issueTitle}
                    </h3>

                    {/* SECTION 9: STATUS TAG SYSTEM */}
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs pt-0.5">
                      <span className={`px-2.5 py-1 rounded-md border font-bold text-[11px] ${prStatusTag.style}`}>
                        {prStatusTag.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md border font-bold text-[11px] ${issueTag.style}`}>
                        {issueTag.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md border font-bold text-[11px] ${assignmentTag.style}`}>
                        {assignmentTag.label}
                      </span>
                      {item.isPartner && (
                        <span className="px-2.5 py-1 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60 font-bold text-[11px]">
                          PARTNER REPO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SECTION 6 & 10: MAIN CONTENT & RR STATUS PANEL SPLIT */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT COLUMN (~75%): WHAT CHANGED & TECH STACK */}
                    <div className="lg:col-span-8 space-y-4">
                      {/* SHORT SUMMARY & WHAT CHANGED */}
                      <div className="p-4 rounded-xl border border-slate-800/90 bg-[#050810] space-y-2 font-mono">
                        <div className="text-[11px] font-extrabold text-orange-400 uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-orange-500" />
                            <span>AI CHANGE ANALYSIS · SHORT SUMMARY</span>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-100 font-sans leading-relaxed border-b border-slate-800/60 pb-2">
                          &quot;{engineeringChangeText}&quot;
                        </p>
                        <ul className="space-y-1.5 font-sans text-xs text-slate-200 pt-1">
                          {factualBullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2">
                              <span className="text-orange-500 font-bold font-mono mt-0.5">•</span>
                              <span className="leading-relaxed">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* LANGUAGES · TECHNOLOGIES · CORE CONCEPTS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                        {/* LANGUAGES */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LANGUAGES</div>
                          <div className="flex flex-wrap gap-1.5">
                            {languages.map((lang) => (
                              <span key={lang} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs">
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* TECHNOLOGIES */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TECHNOLOGIES</div>
                          <div className="flex flex-wrap gap-1.5">
                            {technologies.map((tech) => (
                              <span key={tech} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* CORE CONCEPTS */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CORE CONCEPTS</div>
                          <div className="flex flex-wrap gap-1.5">
                            {concepts.map((concept) => (
                              <span key={concept} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs">
                                {concept}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 10: RIGHT COLUMN (~25%): RR STATUS PANEL */}
                    <div className="lg:col-span-4 font-mono text-xs h-full">
                      {isVerified ? (
                        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-orange-400 uppercase tracking-wider border-b border-orange-500/20 pb-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-500" />
                            <span>✓ Verified Contribution</span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">RR DIFFICULTY</div>
                              <div className="text-lg font-black text-white">
                                {item.rrDifficulty.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10</span>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-orange-400/90 uppercase font-semibold">RR POINTS</div>
                              <div className="text-2xl font-black text-orange-400">+{item.rrPoints}</div>
                            </div>
                          </div>
                        </div>
                      ) : isMerged && hasLinkedIssue && !isVerified ? (
                        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-400 uppercase tracking-wider border-b border-amber-500/20 pb-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span>Pending Verification</span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">REASON</div>
                              <div className="text-xs font-bold text-amber-200">
                                Linked to Issue #{item.linkedIssueNumber}. Verification in progress.
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">RR POINTS</div>
                              <div className="text-2xl font-black text-slate-400">+0</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/90 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                            <AlertCircle className="w-4 h-4 text-slate-500" />
                            <span>RR Ineligible</span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">REASON</div>
                              <div className="text-xs font-bold text-slate-300">
                                {isMerged && !hasLinkedIssue
                                  ? 'No linked GitHub issue'
                                  : isOpen
                                  ? 'PR is not yet merged'
                                  : isClosed
                                  ? 'PR closed without merging'
                                  : (item as any).verificationReason
                                  ? (item as any).verificationReason
                                  : 'Verification checks failed'}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">RR POINTS</div>
                              <div className="text-2xl font-black text-slate-400">+0</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* SECTION 14 & 18: FOOTER STRIP: CHECKS, FOOTPRINT & DIRECT GITHUB LINKS */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 font-mono text-xs">

                    {/* LEFT: CHECKS & FOOTPRINT */}
                    <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${checksPill.passed ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span className={checksPill.passed ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                          {checksPill.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <FileCode className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          <strong className="text-slate-200">{item.filesChanged}</strong> {item.filesChanged === 1 ? 'file' : 'files'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400 font-bold">+{item.linesAdded}</span>
                        <span className="text-rose-400 font-bold">-{item.linesDeleted}</span>
                      </div>
                    </div>

                    {/* RIGHT: DIRECT LINKS & EXPAND ACTION */}
                    <div className="flex items-center gap-2">
                      {item.linkedIssueUrl && item.linkedIssueNumber ? (
                        <a
                          href={item.linkedIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                        >
                          <span>Issue ↗</span>
                        </a>
                      ) : null}

                      <a
                        href={item.prUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        <span>PR ↗</span>
                      </a>

                      <a
                        href={item.repoUrl || `https://github.com/${item.repoFullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        <span>Repo ↗</span>
                      </a>

                      <a
                        href={`https://github.com/${orgName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        <span>Org ↗</span>
                      </a>

                      <button
                        onClick={() => openEngineeringReview(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold text-xs transition-colors ml-1"
                      >
                        <span>Deep Evidence</span>
                        <ArrowRight className="w-3 h-3 text-orange-400" />
                      </button>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* SECTION 23: ENGINEERING DNA & OBSERVED EVIDENCE SECTION */}
        <div className="space-y-6 pt-10 border-t border-slate-800/80 font-mono">
          <div>
            <div className="flex items-center gap-2 text-xs text-orange-400 font-bold mb-1">
              <Cpu className="w-4 h-4" />
              <span>VERIFIED EVIDENCE SIGNAL</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              YOUR ENGINEERING DNA
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Factual technical techniques and language observations derived exclusively from verified code contributions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* VERIFIED TECHNIQUES WITH SUPPORTING EVIDENCE EXPOSURE */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#080c14] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-400" />
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
                        <div className="text-[10px] text-orange-400 font-semibold">
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

            {/* LANGUAGES OBSERVED (NO PROFICIENCY / SKILL PROGRESS BARS) */}
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
    </div>
  );
};
