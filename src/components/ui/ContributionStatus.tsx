import React from 'react';
import { GitPullRequest, CheckCircle2, Clock, XCircle, ShieldCheck } from 'lucide-react';

export type ContributionStatusType = 'CLAIMED' | 'IN_REVIEW' | 'MERGED_AND_AUDITED' | 'REJECTED' | 'OPEN';

interface ContributionStatusProps {
  status: ContributionStatusType;
  className?: string;
}

export const ContributionStatus: React.FC<ContributionStatusProps> = ({
  status,
  className = '',
}) => {
  switch (status) {
    case 'MERGED_AND_AUDITED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] ${className}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Merged & Audited</span>
        </span>
      );
    case 'IN_REVIEW':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-950/60 border border-purple-500/50 text-purple-300 ${className}`}>
          <Clock className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          <span>PR In Review</span>
        </span>
      );
    case 'CLAIMED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-950/60 border border-blue-500/50 text-blue-300 ${className}`}>
          <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />
          <span>Claimed / Active</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/60 border border-rose-500/50 text-rose-300 ${className}`}>
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Rejected / Unverified</span>
        </span>
      );
    case 'OPEN':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Open Issue</span>
        </span>
      );
  }
};
