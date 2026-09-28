import React from 'react';
import { Issue, Contributor } from '@/types';
import { IssueDetailResult } from '@/lib/issues/service';
import { RRScore } from '@/components/ui/RRScore';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { PointsDisplay } from '@/components/ui/PointsDisplay';
import { ActivityIndicator } from '@/components/ui/ActivityIndicator';
import { LanguageTag } from '@/components/ui/LanguageTag';
import { TechnologyTag } from '@/components/ui/TechnologyTag';
import { GitHubLink } from '@/components/ui/GitHubLink';
import { IssueCard } from '@/components/ui/IssueCard';
import { RelatedIssueCard } from '@/components/ui/RelatedIssueCard';
import { ContributionStatus } from '@/components/ui/ContributionStatus';
import { calculateRRPoints, getGitHubIssueWebUrl } from '@/lib/utils';
import {
  ExternalLink,
  Shield,
  Sparkles,
  Github,
  GitPullRequest,
  Star,
  GitFork,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowUpRight,
  Cpu,
  CheckCircle2,
  FileCode,
  Tag,
  HelpCircle,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';

interface IssueDetailViewProps {
  data: IssueDetailResult;
  relatedIssues: Issue[];
}

export const IssueDetailView: React.FC<IssueDetailViewProps> = ({ data, relatedIssues }) => {
  const { issue, scoreDetails } = data;
  const { repository } = issue;
  const rrPoints = calculateRRPoints(issue.rrDifficulty);
  const githubWebUrl = getGitHubIssueWebUrl(issue);

  // 5 V2.3.0 Core Contributor Effort Factors
  const v2FactorLabels = [
    { key: 'technicalDifficulty', code: 'TC', label: 'Technical Complexity', desc: 'Algorithmic depth, system execution complexity, memory structures, and logic depth' },
    { key: 'codebaseComplexity', code: 'CS', label: 'Scope of Change', desc: 'Expected breadth of change inferred from issue evidence across files, modules, or packages' },
    { key: 'domainKnowledge', code: 'DS', label: 'Domain Specialization', desc: 'Specialized background inferred from issue evidence (compilers, streams, consensus, RLS)' },
    { key: 'testingComplexity', code: 'TE', label: 'Testing & Verification', desc: 'Inferred testing and validation requirement suggested by description, labels, and system area' },
    { key: 'issueClarity', code: 'PA', label: 'Problem Ambiguity', desc: 'How much additional triage and investigation the issue appears to require based on evidence' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <Link
          href="/issues"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Problem Set</span>
        </Link>
        <span className="text-slate-600">ID: {issue.id}</span>
      </div>

      {/* Main Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        {/* Repo & Issue Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-slate-200">{repository.fullName}</span>
            <span className="text-slate-600">#</span>
            <span className="text-slate-400">{issue.githubNumber}</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-700">•</span>
            {issue.prActivityClassification === 'OPEN_PR_IN_PROGRESS' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-950/60 border border-amber-800/50 text-amber-300">
                <GitPullRequest className="w-3.5 h-3.5 text-amber-400" />
                <span>OPEN • PR IN PROGRESS ({issue.openPrCount || 1})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-950/60 border border-blue-800/50 text-blue-300">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>OPEN • NO PR</span>
              </span>
            )}
          </div>

          <GitHubLink href={githubWebUrl} label="View Issue on GitHub" size="sm" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 font-mono tracking-tight leading-snug">
          {issue.title}
        </h1>

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {issue.language && <LanguageTag language={issue.language} />}
          {issue.ecosystem && <TechnologyTag technology={issue.ecosystem} />}
          <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300">
            {repository.repoType}
          </span>
          {issue.labels.map((lbl, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400"
            >
              <Tag className="w-3 h-3 opacity-60" />
              {lbl}
            </span>
          ))}
        </div>

        {/* Hero Metrics Bar: RR Difficulty vs Reward */}
        <div className="mt-8 pt-6 border-t border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Hero Metric 1: RR Difficulty */}
          <div className="md:col-span-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-blue-900/50 bg-blue-950/20 backdrop-blur-md">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>RR Difficulty Rating</span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-mono font-black text-slate-100 tracking-tight">
                  {issue.rrDifficulty.toFixed(1)}
                </span>
                <span className="text-base font-mono text-slate-400">/ 10.0</span>
                <DifficultyBadge score={issue.rrDifficulty} />
              </div>
            </div>
            <RRScore score={issue.rrDifficulty} size="lg" showBar className="w-full sm:w-48" />
          </div>

          {/* Hero Metric 2: Reward RR Points */}
          <div className="md:col-span-5 flex flex-col justify-between p-5 rounded-xl border border-amber-900/50 bg-amber-950/20 backdrop-blur-md">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Auditable Reward</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-amber-300">+{rrPoints}</span>
                <span className="text-xs font-mono text-amber-400/80 font-bold uppercase">RR Points</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] font-mono text-slate-400">
              Formula: {issue.rrDifficulty.toFixed(1)} Difficulty × 10 = +{rrPoints} Points upon merged PR
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href={githubWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-extrabold text-sm shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all group"
          >
            <Github className="w-5 h-5" />
            <span>SOLVE THIS ISSUE ON GITHUB</span>
            <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>

          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Direct link to original repository issue</span>
          </span>
        </div>
      </div>

      {/* Grid: Score Factors + Repository Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 8-Factor Score Breakdown & Reasoning */}
        <div className="lg:col-span-8 space-y-8">
          {/* Section: Score Factor Breakdown */}
          <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div>
                <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  V2.3.0 Evidence Factor Breakdown
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  5-Factor evidence accumulation engine yielding composite RR Difficulty {issue.rrDifficulty.toFixed(1)} / 10.0
                </p>
              </div>
              {scoreDetails && (
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-300 font-bold">
                  {scoreDetails.scoringVersion || 'v2.3.0'}
                </span>
              )}
            </div>

            {/* 5 V2.3 Factors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {scoreDetails &&
                v2FactorLabels.map((item) => {
                  const val = (scoreDetails as any)[item.key] ?? 5.0;
                  return (
                    <div key={item.key} className="p-4 rounded-xl border border-slate-900 bg-slate-950/90 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-[10px] font-mono font-bold text-purple-300">
                            {item.code}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-200">{item.label}</span>
                        </div>
                        <span className="text-xs font-mono font-extrabold text-blue-400">{val.toFixed(1)} / 10</span>
                      </div>

                      {/* Visual Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"
                          style={{ width: `${(val / 10) * 100}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
            </div>

            {/* Reasoning Explanation */}
            {scoreDetails?.reasoning && (
              <div className="mt-6 pt-6 border-t border-slate-900 space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>Evidence Justification ({scoreDetails.scoringVersion || 'v2.3.0'})</span>
                </h3>
                <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line bg-slate-900/60 p-5 rounded-xl border border-slate-800 shadow-inner">
                  {scoreDetails.reasoning}
                </div>
              </div>
            )}
          </div>

          {/* Section: Original Issue Description Body */}
          <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                Original Issue Description
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Author: <strong className="text-slate-300">@{issue.authorUsername}</strong>
              </span>
            </div>

            <div className="prose prose-invert prose-slate max-w-none text-sm leading-relaxed font-sans">
              <p className="bg-slate-900/50 p-5 rounded-xl border border-slate-900 text-slate-300 whitespace-pre-wrap font-mono text-xs">
                {issue.body || 'No detailed issue body was provided in the repository listing.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Repository Context Panel */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-6 backdrop-blur-xl space-y-6 sticky top-20">
            <div className="border-b border-slate-900 pb-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Repository Context
              </span>
              <h3 className="text-lg font-mono font-bold text-slate-100 mt-1">{repository.fullName}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-3">{repository.description}</p>
            </div>

            {/* Maintainer Activity Signal */}
            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950 space-y-2">
              <span className="text-xs font-mono text-slate-400 uppercase">Maintainer Signal</span>
              <div className="pt-1">
                <ActivityIndicator score={repository.maintainerActivityScore} />
              </div>
            </div>

            {/* Repo Metrics List */}
            <div className="space-y-3 font-mono text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  GitHub Stars
                </span>
                <span className="font-bold">{repository.starsCount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-slate-400" />
                  Forks
                </span>
                <span className="font-bold">{repository.forksCount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-500 flex items-center gap-1.5 text-blue-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Open Issues
                </span>
                <span className="font-bold">{repository.openIssuesCount}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-500">Repository Type</span>
                <span className="font-bold text-purple-400">{repository.repoType}</span>
              </div>
            </div>

            {/* External Repo Link */}
            <div className="pt-2">
              <GitHubLink href={repository.url} label={`View ${repository.fullName}`} className="w-full justify-center py-2.5" />
            </div>
          </div>
        </aside>
      </div>

      {/* Section: Related Issues */}
      {relatedIssues.length > 0 && (
        <div className="pt-10 border-t border-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
                Similar Problem Set
              </span>
              <h2 className="text-xl font-mono font-bold text-slate-100">Related Open-Source Issues</h2>
            </div>
            <Link href="/issues" className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold">
              <span>View Explorer</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {relatedIssues.map((relIssue) => (
              <RelatedIssueCard key={relIssue.id} issue={relIssue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
