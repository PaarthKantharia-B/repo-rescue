import { RRTier } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
  * Calculate RR Points from RR Difficulty Score
  * V1 Formula: RR Points = RR Difficulty * 10
  */
export function calculateRRPoints(rrDifficulty: number): number {
  return Math.round(rrDifficulty * 10);
}

/**
  * Map RR Difficulty (0.0 - 10.0) to Difficulty Tier
  */
export function getRRTier(rrDifficulty: number): RRTier {
  if (rrDifficulty >= 9.5) return 'grandmaster';
  if (rrDifficulty >= 8.5) return 'expert';
  if (rrDifficulty >= 6.5) return 'hard';
  if (rrDifficulty >= 3.5) return 'medium';
  return 'easy';
}

/**
  * Get Tailwind color classes for an RR Tier
  */
export function getTierColorClasses(tier: RRTier) {
  switch (tier) {
    case 'grandmaster':
      return {
        bg: 'bg-red-950/40',
        text: 'text-red-400',
        border: 'border-red-500/40',
        glow: 'shadow-glow-grandmaster',
        badge: 'badge-error',
        accent: '#ef4444',
        label: 'Grandmaster'
      };
    case 'expert':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        glow: 'shadow-glow-expert',
        badge: 'badge-warning',
        accent: '#f59e0b',
        label: 'Expert'
      };
    case 'hard':
      return {
        bg: 'bg-purple-950/40',
        text: 'text-purple-400',
        border: 'border-purple-500/40',
        glow: 'shadow-glow-hard',
        badge: 'badge-secondary',
        accent: '#8b5cf6',
        label: 'Hard'
      };
    case 'medium':
      return {
        bg: 'bg-blue-950/40',
        text: 'text-blue-400',
        border: 'border-blue-500/40',
        glow: 'shadow-glow-medium',
        badge: 'badge-primary',
        accent: '#3b82f6',
        label: 'Medium'
      };
    case 'easy':
    default:
      return {
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        glow: 'shadow-glow-easy',
        badge: 'badge-success',
        accent: '#10b981',
        label: 'Easy'
      };
  }
}

/**
  * Format numbers with commas (e.g. 1,250)
  */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Convert any GitHub API issue URL or raw issue object to standard GitHub web issue URL:
 * https://github.com/{owner}/{repo}/issues/{issueNumber}
 */
export function getGitHubIssueWebUrl(issue: {
  url?: string;
  githubNumber?: number;
  repository?: { fullName?: string; owner?: string; name?: string };
}): string {
  if (issue.repository?.fullName && issue.githubNumber) {
    return `https://github.com/${issue.repository.fullName}/issues/${issue.githubNumber}`;
  }
  if (issue.url) {
    if (issue.url.includes('api.github.com/repos/')) {
      return issue.url
        .replace('https://api.github.com/repos/', 'https://github.com/')
        .replace('http://api.github.com/repos/', 'https://github.com/');
    }
    return issue.url;
  }
  return 'https://github.com';
}
