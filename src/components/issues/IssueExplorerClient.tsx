'use client';

import React, { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Issue } from '@/types';
import { GetIssuesResult } from '@/lib/issues/service';
import { IssueCard } from '@/components/ui/IssueCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  Search,
  X,
  ArrowUpDown,
  RotateCcw,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  GitBranch,
  Code2,
  Tag,
  Shield,
  Sparkles,
  MessageSquare,
  Clock,
  Filter,
} from 'lucide-react';

interface RRDifficultySliderProps {
  minDifficulty: number;
  maxDifficulty: number;
  onChange: (min: number, max: number) => void;
}

const RRDifficultySlider: React.FC<RRDifficultySliderProps> = ({
  minDifficulty,
  maxDifficulty,
  onChange,
}) => {
  const [minInputVal, setMinInputVal] = useState(minDifficulty.toFixed(1));
  const [maxInputVal, setMaxInputVal] = useState(maxDifficulty.toFixed(1));

  useEffect(() => {
    setMinInputVal(minDifficulty.toFixed(1));
  }, [minDifficulty]);

  useEffect(() => {
    setMaxInputVal(maxDifficulty.toFixed(1));
  }, [maxDifficulty]);

  const handleMinInputChange = (valStr: string) => {
    setMinInputVal(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= maxDifficulty && !valStr.endsWith('.')) {
      const rounded = Math.round(parsed * 10) / 10;
      if (rounded !== minDifficulty) {
        onChange(rounded, maxDifficulty);
      }
    }
  };

  const handleMinInputBlur = () => {
    let parsed = parseFloat(minInputVal);
    if (isNaN(parsed)) parsed = 0;
    const clamped = Math.max(0, Math.min(parsed, maxDifficulty));
    const rounded = Math.round(clamped * 10) / 10;
    setMinInputVal(rounded.toFixed(1));
    if (rounded !== minDifficulty) {
      onChange(rounded, maxDifficulty);
    }
  };

  const handleMaxInputChange = (valStr: string) => {
    setMaxInputVal(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= minDifficulty && parsed <= 10 && !valStr.endsWith('.')) {
      const rounded = Math.round(parsed * 10) / 10;
      if (rounded !== maxDifficulty) {
        onChange(minDifficulty, rounded);
      }
    }
  };

  const handleMaxInputBlur = () => {
    let parsed = parseFloat(maxInputVal);
    if (isNaN(parsed)) parsed = 10;
    const clamped = Math.max(minDifficulty, Math.min(parsed, 10));
    const rounded = Math.round(clamped * 10) / 10;
    setMaxInputVal(rounded.toFixed(1));
    if (rounded !== maxDifficulty) {
      onChange(minDifficulty, rounded);
    }
  };

  const minPercent = (minDifficulty / 10) * 100;
  const maxPercent = (maxDifficulty / 10) * 100;

  return (
    <div className="space-y-3 font-mono">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <label className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">
          RR DIFFICULTY
        </label>
      </div>

      {/* Editable Numeric Inputs connected by line */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative">
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={minInputVal}
            onChange={(e) => handleMinInputChange(e.target.value)}
            onBlur={handleMinInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMinInputBlur();
            }}
            className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
          />
        </div>

        <div className="flex-1 h-[1px] bg-slate-800 mx-1 border-t border-dashed border-slate-800" />

        <div className="relative">
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={maxInputVal}
            onChange={(e) => handleMaxInputChange(e.target.value)}
            onBlur={handleMaxInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMaxInputBlur();
            }}
            className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
          />
        </div>
      </div>

      {/* Dual Slider Control Track */}
      <div className="relative w-full h-6 flex items-center">
        {/* Subdued Background Track */}
        <div className="absolute w-full h-2 bg-slate-900 border border-slate-800/80 rounded-full" />

        {/* Active Highlight Range Track */}
        <div
          className="absolute h-2 bg-blue-500 rounded-full shadow-sm"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`,
          }}
        />

        {/* Min Thumb Input */}
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={minDifficulty}
          onChange={(e) => {
            const val = Math.round(parseFloat(e.target.value) * 10) / 10;
            const newMin = Math.min(val, maxDifficulty);
            onChange(newMin, maxDifficulty);
          }}
          className="absolute w-full h-full appearance-none bg-transparent pointer-events-none focus:outline-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-950 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform
            [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-950 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:transition-transform"
          style={{ zIndex: minDifficulty > 9 ? 40 : 30 }}
        />

        {/* Max Thumb Input */}
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={maxDifficulty}
          onChange={(e) => {
            const val = Math.round(parseFloat(e.target.value) * 10) / 10;
            const newMax = Math.max(val, minDifficulty);
            onChange(minDifficulty, newMax);
          }}
          className="absolute w-full h-full appearance-none bg-transparent pointer-events-none focus:outline-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-950 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform
            [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-950 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:transition-transform"
          style={{ zIndex: 35 }}
        />
      </div>
    </div>
  );
};

interface IssueExplorerClientProps {
  initialData: GetIssuesResult;
  searchParams: Record<string, string | undefined>;
}

export const IssueExplorerClient: React.FC<IssueExplorerClientProps> = ({
  initialData,
  searchParams,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Filter Panel Toggle
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // 15 Filter States initialized from URL search params
  const [search, setSearch] = useState(searchParams.search || '');
  const [status, setStatus] = useState(searchParams.status || '');
  const [difficultyTier, setDifficultyTier] = useState(searchParams.difficultyTier || '');
  const [minDifficulty, setMinDifficulty] = useState(
    searchParams.minDifficulty ? parseFloat(searchParams.minDifficulty) : 0
  );
  const [maxDifficulty, setMaxDifficulty] = useState(
    searchParams.maxDifficulty ? parseFloat(searchParams.maxDifficulty) : 10
  );
  const [minPoints, setMinPoints] = useState(
    searchParams.minPoints ? parseInt(searchParams.minPoints, 10) : 0
  );
  const [maxPoints, setMaxPoints] = useState(
    searchParams.maxPoints ? parseInt(searchParams.maxPoints, 10) : 100
  );
  const [repo, setRepo] = useState(searchParams.repo || '');
  const [organization, setOrganization] = useState(searchParams.organization || '');
  const [language, setLanguage] = useState(searchParams.language || '');
  const [ecosystem, setEcosystem] = useState(searchParams.ecosystem || '');
  const [label, setLabel] = useState(searchParams.label || '');
  const [issueType, setIssueType] = useState(searchParams.issueType || '');
  const [prActivity, setPrActivity] = useState(searchParams.prActivity || '');
  const [minMaintainerActivity, setMinMaintainerActivity] = useState(
    searchParams.minActivity ? parseFloat(searchParams.minActivity) : 0
  );
  const [issueAgeDays, setIssueAgeDays] = useState(
    searchParams.issueAgeDays ? parseInt(searchParams.issueAgeDays, 10) : 0
  );
  const [lastActivityDays, setLastActivityDays] = useState(
    searchParams.lastActivityDays ? parseInt(searchParams.lastActivityDays, 10) : 0
  );
  const [minComments, setMinComments] = useState(
    searchParams.minComments ? parseInt(searchParams.minComments, 10) : 0
  );
  const [maxComments, setMaxComments] = useState(
    searchParams.maxComments ? parseInt(searchParams.maxComments, 10) : 100
  );
  const [sortBy, setSortBy] = useState(searchParams.sortBy || 'recent');

  // Searchable Input Local States
  const [orgSearch, setOrgSearch] = useState('');
  const [repoSearch, setRepoSearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');

  // Infinite Scroll & Feed State
  const [displayedIssues, setDisplayedIssues] = useState<Issue[]>(initialData.issues);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialData.issues.length < initialData.totalCount);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Sync displayed issues when server initialData updates due to URL navigation
  useEffect(() => {
    setDisplayedIssues(initialData.issues);
    setCurrentPage(1);
    setHasMore(initialData.issues.length < initialData.totalCount);
  }, [initialData]);

  const isMountedRef = useRef(false);

  // Debounce free-text search input changes (300ms)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      updateUrlParams({ search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Push all filter changes to URL parameters
  const updateUrlParams = (newParams: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(window.location.search);

    const merged = {
      search,
      status,
      difficultyTier,
      minDifficulty: minDifficulty > 0 ? minDifficulty : undefined,
      maxDifficulty: maxDifficulty < 10 ? maxDifficulty : undefined,
      minPoints: minPoints > 0 ? minPoints : undefined,
      maxPoints: maxPoints < 100 ? maxPoints : undefined,
      repo,
      organization,
      language,
      ecosystem,
      label,
      issueType,
      prActivity,
      minActivity: minMaintainerActivity > 0 ? minMaintainerActivity : undefined,
      issueAgeDays: issueAgeDays > 0 ? issueAgeDays : undefined,
      lastActivityDays: lastActivityDays > 0 ? lastActivityDays : undefined,
      minComments: minComments > 0 ? minComments : undefined,
      maxComments: maxComments < 100 ? maxComments : undefined,
      sortBy,
      ...newParams,
    };

    current.delete('page');

    Object.entries(merged).forEach(([key, val]) => {
      if (val === undefined || val === '' || val === 0 || (key === 'maxPoints' && val === 100) || (key === 'maxComments' && val === 100) || (key === 'maxDifficulty' && val === 10)) {
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

  const handleClearAllFilters = () => {
    setSearch('');
    setStatus('');
    setDifficultyTier('');
    setMinDifficulty(0);
    setMaxDifficulty(10);
    setMinPoints(0);
    setMaxPoints(100);
    setRepo('');
    setOrganization('');
    setLanguage('');
    setEcosystem('');
    setLabel('');
    setIssueType('');
    setPrActivity('');
    setMinMaintainerActivity(0);
    setIssueAgeDays(0);
    setLastActivityDays(0);
    setMinComments(0);
    setMaxComments(100);
    setSortBy('recent');
    setOrgSearch('');
    setRepoSearch('');
    setLabelSearch('');

    startTransition(() => {
      router.push(pathname);
    });
  };

  // Load next batch of issues incrementally
  const loadMoreIssues = useCallback(async () => {
    if (isLoadingMore || !hasMore || isPending) return;
    setIsLoadingMore(true);

    const nextPage = currentPage + 1;
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (difficultyTier) query.set('difficultyTier', difficultyTier);
    if (minDifficulty > 0) query.set('minDifficulty', String(minDifficulty));
    if (maxDifficulty < 10) query.set('maxDifficulty', String(maxDifficulty));
    if (minPoints > 0) query.set('minPoints', String(minPoints));
    if (maxPoints < 100) query.set('maxPoints', String(maxPoints));
    if (repo) query.set('repo', repo);
    if (organization) query.set('organization', organization);
    if (language) query.set('language', language);
    if (ecosystem) query.set('ecosystem', ecosystem);
    if (label) query.set('label', label);
    if (issueType) query.set('issueType', issueType);
    if (prActivity) query.set('prActivity', prActivity);
    if (minMaintainerActivity > 0) query.set('minMaintainerActivity', String(minMaintainerActivity));
    if (issueAgeDays > 0) query.set('issueAgeDays', String(issueAgeDays));
    if (lastActivityDays > 0) query.set('lastActivityDays', String(lastActivityDays));
    if (minComments > 0) query.set('minComments', String(minComments));
    if (maxComments < 100) query.set('maxComments', String(maxComments));
    if (sortBy) query.set('sortBy', sortBy);
    query.set('page', String(nextPage));
    query.set('pageSize', '10');

    try {
      const res = await fetch(`/api/issues?${query.toString()}`);
      if (res.ok) {
        const data: GetIssuesResult = await res.json();
        if (data.issues && data.issues.length > 0) {
          setDisplayedIssues((prev) => {
            const map = new Map(prev.map((item) => [item.id, item]));
            data.issues.forEach((item) => map.set(item.id, item));
            const updated = Array.from(map.values());
            if (updated.length >= data.totalCount || data.issues.length === 0) {
              setHasMore(false);
            }
            return updated;
          });
          setCurrentPage(nextPage);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error fetching next batch of issues:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    isPending,
    currentPage,
    search,
    status,
    difficultyTier,
    minDifficulty,
    maxDifficulty,
    minPoints,
    maxPoints,
    repo,
    organization,
    language,
    ecosystem,
    label,
    issueType,
    prActivity,
    minMaintainerActivity,
    issueAgeDays,
    lastActivityDays,
    minComments,
    maxComments,
    sortBy,
  ]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isPending) {
          loadMoreIssues();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTarget = sentinelRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, isPending, loadMoreIssues]);

  const {
    totalCount,
    availableLanguages = [],
    availableEcosystems = [],
    availableRepositories = [],
    availableOrganizations = [],
    availableLabels = [],
    availableRepoTypes = [],
  } = initialData;

  // Filtered dropdown arrays for searchable selectors
  const filteredOrgs = availableOrganizations.filter((o) =>
    o.toLowerCase().includes(orgSearch.toLowerCase())
  );
  const filteredRepos = availableRepositories.filter((r) =>
    r.toLowerCase().includes(repoSearch.toLowerCase())
  );
  const filteredLabels = availableLabels.filter((l) =>
    l.toLowerCase().includes(labelSearch.toLowerCase())
  );

  const sortOptions = [
    { value: 'recent', label: 'Newest & Freshest' },
    { value: 'difficulty_desc', label: 'RR Difficulty ↓' },
    { value: 'difficulty_asc', label: 'RR Difficulty ↑' },
    { value: 'points_desc', label: 'RR Points ↓' },
    { value: 'impact_desc', label: 'Expected Impact ↓' },
  ];

  // Calculate count of active filters
  const activeFiltersList: { key: string; label: string; onRemove: () => void }[] = [];

  if (organization) {
    activeFiltersList.push({
      key: 'organization',
      label: `Org: ${organization}`,
      onRemove: () => {
        setOrganization('');
        updateUrlParams({ organization: undefined });
      },
    });
  }
  if (repo) {
    activeFiltersList.push({
      key: 'repo',
      label: `Repo: ${repo}`,
      onRemove: () => {
        setRepo('');
        updateUrlParams({ repo: undefined });
      },
    });
  }
  if (status) {
    activeFiltersList.push({
      key: 'status',
      label: `Status: ${status === 'OPEN_NO_PR' ? 'No PR' : status === 'OPEN_PR_IN_PROGRESS' ? 'PR in progress' : status}`,
      onRemove: () => {
        setStatus('');
        updateUrlParams({ status: undefined });
      },
    });
  }
  if (language) {
    activeFiltersList.push({
      key: 'language',
      label: `Language: ${language}`,
      onRemove: () => {
        setLanguage('');
        updateUrlParams({ language: undefined });
      },
    });
  }
  if (ecosystem) {
    activeFiltersList.push({
      key: 'ecosystem',
      label: `Ecosystem: ${ecosystem}`,
      onRemove: () => {
        setEcosystem('');
        updateUrlParams({ ecosystem: undefined });
      },
    });
  }
  if (label) {
    activeFiltersList.push({
      key: 'label',
      label: `Label: ${label}`,
      onRemove: () => {
        setLabel('');
        updateUrlParams({ label: undefined });
      },
    });
  }
  if (issueType) {
    activeFiltersList.push({
      key: 'issueType',
      label: `Type: ${issueType}`,
      onRemove: () => {
        setIssueType('');
        updateUrlParams({ issueType: undefined });
      },
    });
  }
  if (minDifficulty > 0 || maxDifficulty < 10) {
    activeFiltersList.push({
      key: 'difficulty',
      label: `Diff: ${minDifficulty.toFixed(1)} – ${maxDifficulty.toFixed(1)}`,
      onRemove: () => {
        setMinDifficulty(0);
        setMaxDifficulty(10);
        setDifficultyTier('');
        updateUrlParams({ minDifficulty: undefined, maxDifficulty: undefined, difficultyTier: undefined });
      },
    });
  }
  if (minPoints > 0 || maxPoints < 100) {
    activeFiltersList.push({
      key: 'points',
      label: `Points: +${minPoints} – +${maxPoints}`,
      onRemove: () => {
        setMinPoints(0);
        setMaxPoints(100);
        updateUrlParams({ minPoints: undefined, maxPoints: undefined });
      },
    });
  }
  if (minMaintainerActivity > 0) {
    activeFiltersList.push({
      key: 'maintainer',
      label: `Maintainer: >= ${minMaintainerActivity}`,
      onRemove: () => {
        setMinMaintainerActivity(0);
        updateUrlParams({ minActivity: undefined });
      },
    });
  }
  if (issueAgeDays > 0) {
    activeFiltersList.push({
      key: 'issueAgeDays',
      label: `Age: < ${issueAgeDays} days`,
      onRemove: () => {
        setIssueAgeDays(0);
        updateUrlParams({ issueAgeDays: undefined });
      },
    });
  }
  if (lastActivityDays > 0) {
    activeFiltersList.push({
      key: 'lastActivityDays',
      label: `Last Activity: < ${lastActivityDays} days`,
      onRemove: () => {
        setLastActivityDays(0);
        updateUrlParams({ lastActivityDays: undefined });
      },
    });
  }
  if (minComments > 0 || maxComments < 100) {
    activeFiltersList.push({
      key: 'comments',
      label: `Comments: ${minComments} – ${maxComments}`,
      onRemove: () => {
        setMinComments(0);
        setMaxComments(100);
        updateUrlParams({ minComments: undefined, maxComments: undefined });
      },
    });
  }

  const activeFiltersCount = activeFiltersList.length + (search ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100 tracking-tight">
            ISSUE EXPLORER
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 font-sans">
            Find open-source problems worth solving.
          </p>
        </div>

        {/* Dynamic Match Count Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
              <span className="font-bold text-blue-300">UPDATING RESULTS...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-slate-200">
                {activeFiltersCount > 0 ? `${totalCount} issues match` : `${totalCount} ACTIVE ISSUES`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Filter Bar */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-4 space-y-4 backdrop-blur-md">
        {/* Row 1: Search + Filter Panel Toggle Button + Sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search issues, titles, repositories, labels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Filters Control Button */}
          <button
            onClick={() => setShowFilterPanel((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-all shrink-0 ${
              showFilterPanel || activeFiltersCount > 0
                ? 'bg-blue-950 border-blue-700 text-blue-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                updateUrlParams({ sortBy: e.target.value });
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-blue-300 font-semibold focus:outline-none focus:border-blue-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFiltersList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Active:</span>
            {activeFiltersList.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-blue-950/70 border border-blue-800/60 text-blue-300"
              >
                <span>{chip.label}</span>
                <button
                  onClick={chip.onRemove}
                  className="text-blue-400 hover:text-rose-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <button
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear all</span>
            </button>
          </div>
        )}

        {/* Expandable Composable Filter Panel */}
        {showFilterPanel && (
          <div className="pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs text-slate-300">
            {/* COLUMN 1: Organization & Identity */}
            <div className="space-y-3.5">
              <div className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px] border-b border-slate-900 pb-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Organization & Repository</span>
              </div>

              {/* Searchable Organization Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Organization</label>
                <select
                  value={organization}
                  onChange={(e) => {
                    const newOrg = e.target.value;
                    setOrganization(newOrg);
                    setRepo('');
                    updateUrlParams({ organization: newOrg, repo: undefined });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">All Organizations</option>
                  {availableOrganizations.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              {/* Searchable Repository Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 uppercase text-[10px]">Repository</label>
                  {isPending && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1 font-mono">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading...
                    </span>
                  )}
                </div>
                <select
                  value={repo}
                  disabled={isPending}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    updateUrlParams({ repo: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <option value="">Loading repository options...</option>
                  ) : (
                    <>
                      <option value="">All Repositories</option>
                      {availableRepositories.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Issue Type / Repo Type Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Issue / Repo Type</label>
                <select
                  value={issueType}
                  onChange={(e) => {
                    setIssueType(e.target.value);
                    updateUrlParams({ issueType: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">All Repo Types</option>
                  {availableRepoTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* COLUMN 2: Language, Ecosystem & Labels */}
            <div className="space-y-3.5">
              <div className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px] border-b border-slate-900 pb-1.5">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Stack & GitHub Metadata</span>
              </div>

              {/* Language Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Language</label>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    updateUrlParams({ language: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">All Languages</option>
                  {availableLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ecosystem Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Ecosystem / Stack</label>
                <select
                  value={ecosystem}
                  onChange={(e) => {
                    setEcosystem(e.target.value);
                    updateUrlParams({ ecosystem: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">All Ecosystems</option>
                  {availableEcosystems.map((eco) => (
                    <option key={eco} value={eco}>
                      {eco}
                    </option>
                  ))}
                </select>
              </div>

              {/* Searchable Labels Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">GitHub Label</label>
                <select
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    updateUrlParams({ label: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">All Labels</option>
                  {availableLabels.map((lbl) => (
                    <option key={lbl} value={lbl}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* COLUMN 3: Competitive Metrics & Ranges */}
            <div className="space-y-3.5">
              <div className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px] border-b border-slate-900 pb-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>RR Metrics & Ranges</span>
              </div>

              {/* RR Difficulty Range Control */}
              <RRDifficultySlider
                minDifficulty={minDifficulty}
                maxDifficulty={maxDifficulty}
                onChange={(newMin, newMax) => {
                  setMinDifficulty(newMin);
                  setMaxDifficulty(newMax);
                  updateUrlParams({
                    minDifficulty: newMin > 0 ? newMin : undefined,
                    maxDifficulty: newMax < 10 ? newMax : undefined,
                  });
                }}
              />

              {/* RR Points Range Inputs */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] uppercase text-slate-400">
                  <span>RR Points Range</span>
                  <span className="text-amber-400 font-bold">
                    +{minPoints} – +{maxPoints}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min 0"
                    value={minPoints === 0 ? '' : minPoints}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setMinPoints(val);
                      updateUrlParams({ minPoints: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max 100"
                    value={maxPoints === 100 ? '' : maxPoints}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 100;
                      setMaxPoints(val);
                      updateUrlParams({ maxPoints: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Maintainer Activity Filter */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Maintainer Signal</label>
                <select
                  value={minMaintainerActivity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMinMaintainerActivity(val);
                    updateUrlParams({ minActivity: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value={0}>Any Maintainer Signal</option>
                  <option value={6.0}>Responsive Only (&gt;= 6.0)</option>
                  <option value={8.5}>High Activity (&gt;= 8.5)</option>
                </select>
              </div>
            </div>

            {/* COLUMN 4: Activity, Age & Comment Count */}
            <div className="space-y-3.5">
              <div className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px] border-b border-slate-900 pb-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Age & Activity Metrics</span>
              </div>

              {/* Issue Age Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Issue Age</label>
                <select
                  value={issueAgeDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setIssueAgeDays(val);
                    updateUrlParams({ issueAgeDays: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value={0}>Any Issue Age</option>
                  <option value={7}>Fresh (&lt; 7 days)</option>
                  <option value={30}>Recent (&lt; 30 days)</option>
                  <option value={90}>Active (&lt; 90 days)</option>
                  <option value={180}>Historical (&lt; 180 days)</option>
                </select>
              </div>

              {/* Last Activity Selector */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase text-[10px]">Last PR/Sync Activity</label>
                <select
                  value={lastActivityDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setLastActivityDays(val);
                    updateUrlParams({ lastActivityDays: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value={0}>Any Activity Time</option>
                  <option value={7}>Recent (&lt; 7 days)</option>
                  <option value={30}>Active (&lt; 30 days)</option>
                  <option value={90}>Past Quarter (&lt; 90 days)</option>
                </select>
              </div>

              {/* Comment Count Range */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] uppercase text-slate-400">
                  <span>Comment Count</span>
                  <span className="text-emerald-400 font-bold">
                    {minComments} – {maxComments}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min 0"
                    value={minComments === 0 ? '' : minComments}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setMinComments(val);
                      updateUrlParams({ minComments: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max 100"
                    value={maxComments === 100 ? '' : maxComments}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 100;
                      setMaxComments(val);
                      updateUrlParams({ maxComments: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Continuous Feed Stack */}
      <main className="space-y-3">
        {isPending && displayedIssues.length === 0 ? (
          <LoadingState type="list" count={8} />
        ) : displayedIssues.length === 0 ? (
          <EmptyState
            title="No issues match criteria"
            description="No open-source issues found for the current combination of filters. Try clearing some filter options or widening your range parameters."
            actionLabel="Clear all filters"
            onAction={handleClearAllFilters}
          />
        ) : (
          <div className="space-y-3">
            {displayedIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} variant="row" />
            ))}
          </div>
        )}

        {/* Subtle Bottom Loading Indicator & Intersection Observer Sentinel */}
        <div ref={sentinelRef} className="py-4 w-full flex flex-col items-center justify-center min-h-[40px]">
          {isLoadingMore && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 shadow-md">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span>Loading more issues...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
