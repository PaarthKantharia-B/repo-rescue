import { prisma } from '@/lib/prisma';
import { PointsLedgerEntry } from '@/types';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  githubUsername: string;
  image: string;
  totalPoints: number;
  rrRating: number;
  rescuedCount: number;
  avgDifficulty: number;
  peakDifficulty: number;
  primaryLanguage: string;
  lastAchievementTimestamp: number;
}

export interface GetLeaderboardParams {
  search?: string;
  language?: string;
  ecosystem?: string;
  page?: number;
  pageSize?: number;
}

export interface GetLeaderboardResult {
  entries: LeaderboardEntry[];
  totalContributors: number;
  page: number;
  totalPages: number;
  pageSize: number;
  availableLanguages: string[];
  availableEcosystems: string[];
}

export interface ContributorProfileResult {
  user: {
    id: string;
    name: string;
    githubUsername: string;
    image: string;
    bio?: string;
    company?: string;
    location?: string;
    totalPoints: number;
    rrRating: number;
    rank: number;
    totalRescued: number;
    avgDifficulty: number;
    peakDifficulty: number;
  };
  difficultyDistribution: { bucket: string; count: number; percentage: number }[];
  languageBreakdown: { language: string; count: number; percentage: number }[];
  ecosystemBreakdown: { ecosystem: string; count: number }[];
  contributions: {
    id: string;
    issueTitle: string;
    issueUrl: string;
    issueId: string;
    repoFullName: string;
    repoUrl: string;
    prNumber: number;
    prUrl: string;
    rrDifficulty: number;
    rrPoints: number;
    mergedAt: string;
    status: string;
  }[];
  ledgerEntries: PointsLedgerEntry[];
}

/**
 * Server-side query service for Global Leaderboard.
 * Derives rankings strictly from verified contributions / authoritative points with deterministic tie-breaking.
 */
export async function getLeaderboard(params: GetLeaderboardParams): Promise<GetLeaderboardResult> {
  const { search = '', language = '', ecosystem = '', page = 1, pageSize = 10 } = params;
  const eligible = { status: 'MERGED_AND_AUDITED' as const };
  const [users, repositories] = await Promise.all([
    prisma.user.findMany({
      where: {
        githubUsername: { not: null },
        OR: [
          { contributions: { some: eligible } },
          { ledgerEntries: { some: {} } },
          { totalPoints: { gt: 0 } },
        ],
      },
      include: {
        contributions: {
          where: eligible,
          include: { issue: { include: { repository: true } } },
        },
        ledgerEntries: true,
      },
    }),
    prisma.repository.findMany({ select: { language: true, ecosystem: true } }),
  ]);

  const availableLanguages = Array.from(new Set(repositories.map((r) => r.language).filter(Boolean) as string[])).sort();
  const availableEcosystems = Array.from(new Set(repositories.map((r) => r.ecosystem).filter(Boolean) as string[])).sort();

  const rawEntries: (LeaderboardEntry & { primaryEcosystem: string })[] = users.map((u) => {
    const contributions = u.contributions;
    const issues = contributions.map((c) => c.issue);
    const languageCounts = new Map<string, number>();
    const ecosystemCounts = new Map<string, number>();
    issues.forEach((i) => {
      const lang = i.language || i.repository.language || 'Unknown';
      const eco = i.ecosystem || i.repository.ecosystem || 'Unknown';
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
      ecosystemCounts.set(eco, (ecosystemCounts.get(eco) || 0) + 1);
    });
    const primaryLanguage = [...languageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const primaryEcosystem = [...ecosystemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const diffs = issues.map((i) => i.rrDifficulty);
    const ledgerPoints = u.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const timestamps = contributions.map((c) => c.verifiedAt.getTime());
    return {
      rank: 0,
      id: u.id,
      name: u.name || u.githubUsername || 'Contributor',
      githubUsername: u.githubUsername!,
      image: u.image || '',
      totalPoints: ledgerPoints,
      rrRating: u.rrRating,
      rescuedCount: contributions.length,
      avgDifficulty: diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10 : 0,
      peakDifficulty: diffs.length ? Math.max(...diffs) : 0,
      primaryLanguage,
      lastAchievementTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
      primaryEcosystem,
    };
  });

  // Ranking & Deterministic Tie-Breaker Pipeline:
  // 1. SUM(verified RR Points) DESC
  // 2. Number of verified contributions DESC
  // 3. Peak verified RR Difficulty DESC
  // 4. Earlier achievement timestamp ASC
  rawEntries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.rescuedCount !== a.rescuedCount) return b.rescuedCount - a.rescuedCount;
    if (b.peakDifficulty !== a.peakDifficulty) return b.peakDifficulty - a.peakDifficulty;
    if (a.lastAchievementTimestamp !== b.lastAchievementTimestamp) {
      return a.lastAchievementTimestamp - b.lastAchievementTimestamp;
    }
    return a.githubUsername.localeCompare(b.githubUsername);
  });

  // Assign global rank numbers
  rawEntries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  // Filter pipeline
  let filtered = rawEntries.filter((entry) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = entry.name.toLowerCase().includes(q);
      const matchUsername = entry.githubUsername.toLowerCase().includes(q);
      const matchLang = entry.primaryLanguage.toLowerCase().includes(q);
      if (!matchName && !matchUsername && !matchLang) return false;
    }

    if (language && entry.primaryLanguage !== language) return false;
    if (ecosystem && entry.primaryEcosystem !== ecosystem) return false;
    return true;
  });

  const totalContributors = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalContributors / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEntries = filtered.slice(startIndex, startIndex + pageSize).map(({ primaryEcosystem: _ecosystem, ...entry }) => entry);

  return {
    entries: paginatedEntries,
    totalContributors,
    page: currentPage,
    totalPages,
    pageSize,
    availableLanguages,
    availableEcosystems,
  };
}

/**
 * Server-side query service for Contributor Profile.
 * Computes histogram difficulty distribution, language percentages, contribution timeline, and ledger audit history.
 */
export async function getContributorProfile(username: string): Promise<ContributorProfileResult | null> {
  const user = await prisma.user.findFirst({
    where: { githubUsername: { mode: 'insensitive', equals: username } },
    include: {
      contributions: {
        where: { status: 'MERGED_AND_AUDITED' },
        include: { issue: { include: { repository: true } }, pullRequest: true },
        orderBy: { verifiedAt: 'desc' },
      },
      ledgerEntries: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!user || (user.contributions.length === 0 && user.ledgerEntries.length === 0)) return null;
  const userContribs = user.contributions;
  const userIssues = userContribs.map((c) => c.issue);
  const leaderboardResult = await getLeaderboard({ page: 1, pageSize: 10000 });
  const rankEntry = leaderboardResult.entries.find((e) => e.id === user.id);

  const diffs = userIssues.map((i) => i.rrDifficulty);
  const avgDifficulty = diffs.length > 0 ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10 : 0;
  const peakDifficulty = diffs.length > 0 ? Math.max(...diffs) : 0;

  // 1. Histogram Difficulty Distribution (0-2, 2-4, 4-6, 6-8, 8-10)
  const buckets = [
    { label: '0–2', min: 0, max: 2, count: 0 },
    { label: '2–4', min: 2, max: 4, count: 0 },
    { label: '4–6', min: 4, max: 6, count: 0 },
    { label: '6–8', min: 6, max: 8, count: 0 },
    { label: '8–10', min: 8, max: 10, count: 0 },
  ];

  userIssues.forEach((iss) => {
    const diff = iss.rrDifficulty;
    for (const b of buckets) {
      if (diff >= b.min && (diff < b.max || (b.max === 10 && diff <= 10))) {
        b.count++;
        break;
      }
    }
  });

  const totalCount = Math.max(1, userIssues.length);
  const difficultyDistribution = buckets.map((b) => ({
    bucket: b.label,
    count: b.count,
    percentage: Math.round((b.count / totalCount) * 100),
  }));

  // 2. Language Breakdown
  const langCounts: Record<string, number> = {};
  userIssues.forEach((iss) => {
    const lang = iss.language || iss.repository.language || 'Unknown';
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  });

  const languageBreakdown = Object.entries(langCounts)
    .map(([lang, cnt]) => ({
      language: lang,
      count: cnt,
      percentage: Math.round((cnt / totalCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 3. Ecosystem Breakdown
  const ecoCounts: Record<string, number> = {};
  userIssues.forEach((iss) => {
    const eco = iss.ecosystem || iss.repository.ecosystem || 'Unknown';
    ecoCounts[eco] = (ecoCounts[eco] || 0) + 1;
  });

  const ecosystemBreakdown = Object.entries(ecoCounts)
    .map(([eco, cnt]) => ({ ecosystem: eco, count: cnt }))
    .sort((a, b) => b.count - a.count);

  // 4. Contribution Timeline
  const formattedContributions = userContribs.map((c) => {
    const issue = c.issue;
    const repo = issue.repository;
    const pr = c.pullRequest;

    return {
      id: c.id,
      issueTitle: issue.title,
      issueUrl: `/issues/${issue.id}`,
      issueId: issue.id,
      repoFullName: repo.fullName,
      repoUrl: repo.url,
      prNumber: pr?.githubNumber ?? 0,
      prUrl: pr?.url ?? '',
      rrDifficulty: issue.rrDifficulty,
      rrPoints: c.rrPoints,
      mergedAt: new Date(c.verifiedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: c.status,
    };
  });

  // 5. Auditable PointsLedger entries
  const userLedger = user.ledgerEntries.map((l) => ({
      id: l.id,
      userId: l.userId,
      type: l.type,
      amount: l.amount,
      balanceAfter: l.balanceAfter,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    }));

  return {
    user: {
      id: user.id,
      name: user.name || user.githubUsername || 'Contributor',
      githubUsername: user.githubUsername || username,
      image: user.image || '',
      bio: user.bio ?? undefined,
      company: user.company ?? undefined,
      location: user.location ?? undefined,
      totalPoints: userLedger.reduce((sum, entry) => sum + entry.amount, 0),
      rrRating: user.rrRating,
      rank: rankEntry ? rankEntry.rank : 1,
      totalRescued: userContribs.length,
      avgDifficulty,
      peakDifficulty,
    },
    difficultyDistribution,
    languageBreakdown,
    ecosystemBreakdown,
    contributions: formattedContributions,
    ledgerEntries: userLedger,
  };
}
