import { Prisma } from '@prisma/client';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { Issue, Repository } from '@/types';
import { calculateRRPoints, getGitHubIssueWebUrl } from '@/lib/utils';
import { classifyIssuePRActivity } from './sync';
import { getTargetOrganizationLogins } from '@/lib/organizations/config';
import { orchestrator } from '@/lib/injector/orchestrator';

export interface GetIssuesParams {
  search?: string;
  status?: string; // OPEN, CLOSED, IN_PROGRESS, RESOLVED, OPEN_NO_PR, OPEN_PR_IN_PROGRESS
  difficultyTier?: string; // easy, medium, hard, all
  minDifficulty?: number; // 0.0 - 10.0
  maxDifficulty?: number; // 0.0 - 10.0
  minPoints?: number; // 0 - 100
  maxPoints?: number; // 0 - 100
  repo?: string; // fullName e.g. supabase/supabase
  organization?: string; // owner e.g. supabase, medusajs, triggerdotdev, novuhq, twentyhq, makeplane
  language?: string;
  ecosystem?: string;
  label?: string; // e.g. bug, enhancement
  issueType?: string; // INFRA, FRAMEWORK, APP, TOOL, COMPILER
  prActivity?: string; // OPEN_NO_PR, OPEN_PR_IN_PROGRESS
  minMaintainerActivity?: number; // 0.0 - 10.0
  issueAgeDays?: number; // max days since creation
  lastActivityDays?: number; // max days since last sync/pr activity
  minComments?: number;
  maxComments?: number;
  hasScore?: boolean;
  sortBy?: 'difficulty_desc' | 'difficulty_asc' | 'impact_desc' | 'points_desc' | 'recent' | 'activity_desc';
  page?: number;
  pageSize?: number;
}

export interface GetIssuesResult {
  issues: Issue[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  availableLanguages: string[];
  availableEcosystems: string[];
  availableRepositories: string[];
  availableOrganizations: string[];
  availableLabels: string[];
  availableRepoTypes: string[];
}

export interface IssueDetailResult {
  issue: Issue;
  scoreDetails?: {
    id: string;
    scoringVersion: string;
    calculatedAt: string;
    compositeScore: number;
    technicalDifficulty: number;
    codebaseComplexity: number;
    issueScope: number;
    domainKnowledge: number;
    expectedImpact: number;
    testingComplexity: number;
    issueClarity: number;
    maintainerActivity: number;
    reasoning?: string;
  };
}

interface FilterMetadataCache {
  availableOrganizations: string[];
  availableRepositories: string[];
  availableLanguages: string[];
  availableEcosystems: string[];
  availableRepoTypes: string[];
  availableLabels: string[];
  fetchedAt: number;
}

let cachedMetadata: FilterMetadataCache | null = null;
const METADATA_TTL_MS = 5 * 60 * 1000; // 5-minute in-memory TTL for filter metadata

async function getFilterMetadata(): Promise<FilterMetadataCache> {
  const now = Date.now();
  if (cachedMetadata && now - cachedMetadata.fetchedAt < METADATA_TTL_MS) {
    return cachedMetadata;
  }

  try {
    const [dbRepos, dbLabels] = await Promise.all([
      prisma.repository.findMany({
        select: { owner: true, fullName: true, language: true, ecosystem: true, repoType: true },
      }),
      prisma.issue.findMany({
        select: { labels: true },
        take: 1000,
      }),
    ]);

    const availableOrganizations = Array.from(new Set(dbRepos.map((r) => r.owner).filter((x): x is string => Boolean(x)))).sort();
    const availableRepositories = Array.from(new Set(dbRepos.map((r) => r.fullName).filter((x): x is string => Boolean(x)))).sort();
    const availableLanguages = Array.from(new Set(dbRepos.map((r) => r.language).filter((x): x is string => Boolean(x)))).sort();
    const availableEcosystems = Array.from(new Set(dbRepos.map((r) => r.ecosystem).filter((x): x is string => Boolean(x)))).sort();
    const availableRepoTypes = Array.from(new Set(dbRepos.map((r) => r.repoType).filter((x): x is string => Boolean(x)))).sort();
    const availableLabels = Array.from(new Set(dbLabels.flatMap((i) => i.labels).filter((x): x is string => Boolean(x)))).sort();

    cachedMetadata = {
      availableOrganizations,
      availableRepositories,
      availableLanguages,
      availableEcosystems,
      availableRepoTypes,
      availableLabels,
      fetchedAt: now,
    };

    return cachedMetadata;
  } catch (err) {
    if (cachedMetadata) return cachedMetadata;
    return {
      availableOrganizations: getTargetOrganizationLogins(),
      availableRepositories: [],
      availableLanguages: [],
      availableEcosystems: [],
      availableRepoTypes: [],
      availableLabels: [],
      fetchedAt: 0,
    };
  }
}

/**
 * Server-side query service for Issue Explorer with 15 composable AND filters.
 * REPO RESCUE DEFAULT FEED SPECIFICATION:
 * Default query shows newest active issues with NO PRs across partner organizations (grafana + supabase),
 * ordered by createdAt DESC, id DESC.
 */
export async function getFilteredIssues(params: GetIssuesParams): Promise<GetIssuesResult> {
  const {
    search = '',
    status = '',
    difficultyTier = '',
    minDifficulty = 0,
    maxDifficulty = 10,
    minPoints = 0,
    maxPoints = 100,
    repo = '',
    organization = '',
    language = '',
    ecosystem = '',
    label = '',
    issueType = '',
    prActivity = '',
    minMaintainerActivity = 0,
    issueAgeDays = 0,
    lastActivityDays = 0,
    minComments = 0,
    maxComments = 100,
    hasScore = false,
    sortBy = 'recent',
    page = 1,
    pageSize = 10,
  } = params;

  try {
    const andConditions: Prisma.IssueWhereInput[] = [];

    // Only surface issues from repositories that passed discovery eligibility checks.
    andConditions.push({
      repository: {
        eligibilityStatus: 'ELIGIBLE',
        isArchived: false,
        isFork: false,
        hasIssues: true,
      },
    });

    // 1. Status & PR Activity Filter / Default PR Constraint
    if (status === 'CLOSED') {
      andConditions.push({
        OR: [{ status: 'CLOSED' }, { githubState: 'closed' }],
      });
    } else {
      andConditions.push({ status: { notIn: ['CLOSED', 'RESOLVED'] } });
      andConditions.push({ githubState: { not: 'closed' } });

      // Default requirement: Issue must be UNASSIGNED (assigneeCount = 0)
      andConditions.push({ assigneeCount: 0 });

      if (status === 'OPEN_NO_PR' || prActivity === 'OPEN_NO_PR') {
        andConditions.push({ openPrCount: 0 });
      } else if (status === 'OPEN_PR_IN_PROGRESS' || prActivity === 'OPEN_PR_IN_PROGRESS') {
        andConditions.push({ openPrCount: { gt: 0 } });
      } else {
        // Default requirement: Issue must have NO associated PR (openPrCount = 0)
        andConditions.push({ openPrCount: 0 });
      }
    }

    // 2. Organization Filter / Default Organization Constraint
    if (organization && organization.trim() !== '') {
      andConditions.push({
        repository: { owner: { mode: 'insensitive', equals: organization.trim() } },
      });
    } else {
      // Default requirement: All configured partner organizations
      const targetLogins = getTargetOrganizationLogins();
      const allVariations = Array.from(
        new Set(targetLogins.flatMap((l) => [l, l.toLowerCase(), l.toUpperCase()]))
      );
      andConditions.push({
        repository: { owner: { in: allVariations } },
      });
    }

    // 3. Repository Filter
    if (repo && repo.trim() !== '') {
      andConditions.push({
        repository: { fullName: { mode: 'insensitive', equals: repo.trim() } },
      });
    }

    // 4. Language Filter
    if (language && language.trim() !== '') {
      andConditions.push({
        OR: [
          { language: { mode: 'insensitive', equals: language.trim() } },
          { repository: { language: { mode: 'insensitive', equals: language.trim() } } },
        ],
      });
    }

    // 5. Ecosystem Filter
    if (ecosystem && ecosystem.trim() !== '') {
      andConditions.push({
        OR: [
          { ecosystem: { mode: 'insensitive', equals: ecosystem.trim() } },
          { repository: { ecosystem: { mode: 'insensitive', equals: ecosystem.trim() } } },
        ],
      });
    }

    // 6. Label Filter
    if (label && label.trim() !== '') {
      andConditions.push({
        labels: { has: label.trim() },
      });
    }

    // 7. Issue Type / Repo Type Filter
    if (issueType && issueType.trim() !== '') {
      andConditions.push({
        repository: { repoType: { mode: 'insensitive', equals: issueType.trim() } },
      });
    }

    // 8. Maintainer Activity Score Filter
    if (minMaintainerActivity > 0) {
      andConditions.push({
        repository: { maintainerActivityScore: { gte: minMaintainerActivity } },
      });
    }

    // 9. Difficulty & Points Range
    const tierMin = difficultyTier === 'easy' ? 0 : difficultyTier === 'medium' ? 3.5 : difficultyTier === 'hard' ? 6.5 : 0;
    const tierMax = difficultyTier === 'easy' ? 3.4 : difficultyTier === 'medium' ? 6.4 : difficultyTier === 'hard' ? 10.0 : 10.0;

    const pointsMinDiff = minPoints > 0 ? minPoints / 10 : 0;
    const pointsMaxDiff = maxPoints < 100 ? maxPoints / 10 : 10;

    const effectiveMinDiff = Math.max(tierMin, minDifficulty, pointsMinDiff);
    const effectiveMaxDiff = Math.min(tierMax, maxDifficulty, pointsMaxDiff);

    if (effectiveMinDiff > 0 || effectiveMaxDiff < 10) {
      andConditions.push({
        rrDifficulty: { gte: effectiveMinDiff, lte: effectiveMaxDiff },
      });
    }

    // 10. Issue Age Days Filter
    if (issueAgeDays > 0) {
      const cutoff = new Date(Date.now() - issueAgeDays * 24 * 60 * 60 * 1000);
      andConditions.push({
        createdAt: { gte: cutoff },
      });
    }

    // 11. Last Activity Days Filter
    if (lastActivityDays > 0) {
      const activityCutoff = new Date(Date.now() - lastActivityDays * 24 * 60 * 60 * 1000);
      andConditions.push({
        OR: [
          { latestPrActivityAt: { gte: activityCutoff } },
          { createdAt: { gte: activityCutoff } },
        ],
      });
    }

    // 12. Comment Count Range
    if (minComments > 0 || maxComments < 100) {
      andConditions.push({
        commentsCount: { gte: minComments, lte: maxComments },
      });
    }

    // 13. Has Score
    if (hasScore) {
      andConditions.push({
        scores: { isNot: null },
      });
    }

    // 14. Free-text Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { labels: { has: q } },
          { language: { contains: q, mode: 'insensitive' } },
          { ecosystem: { contains: q, mode: 'insensitive' } },
          { repository: { fullName: { contains: q, mode: 'insensitive' } } },
          { repository: { owner: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.IssueWhereInput = { AND: andConditions };

    // Determine OrderBy
    let orderBy: Prisma.IssueOrderByWithRelationInput[];
    switch (sortBy) {
      case 'difficulty_asc':
        orderBy = [{ rrDifficulty: 'asc' }, { id: 'desc' }];
        break;
      case 'difficulty_desc':
        orderBy = [{ rrDifficulty: 'desc' }, { id: 'desc' }];
        break;
      case 'points_desc':
        orderBy = [{ rrDifficulty: 'desc' }, { id: 'desc' }];
        break;
      case 'impact_desc':
        orderBy = [{ scores: { expectedImpact: 'desc' } }, { id: 'desc' }];
        break;
      case 'activity_desc':
        orderBy = [{ repository: { maintainerActivityScore: 'desc' } }, { id: 'desc' }];
        break;
      case 'recent':
      default:
        // Default requirement: Primary createdAt DESC, deterministic tie-breaker id DESC
        orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
        break;
    }

    const currentPage = Math.max(1, page);
    const take = pageSize;
    const skip = (currentPage - 1) * pageSize;

    // Fetch filter dropdown options (cached in-memory)
    const metadataPromise = getFilterMetadata();

    // Sequential DB query execution using bounded connection retry wrapper to prevent pool starvation
    const totalCount = await withPrismaRetry(() => prisma.issue.count({ where }));
    const dbIssues = await withPrismaRetry(() =>
      prisma.issue.findMany({
        where,
        orderBy,
        take,
        skip,
        include: { repository: true, scores: true },
      })
    );

    const {
      availableOrganizations,
      availableRepositories,
      availableLanguages,
      availableEcosystems,
      availableRepoTypes,
      availableLabels,
    } = await metadataPromise;

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const formattedIssues: Issue[] = dbIssues.map((i: any) => {
      const repoItem = i.repository;
      const score = i.scores;

      const formattedRepo: Repository = {
        id: repoItem.id,
        githubId: Number(repoItem.githubId),
        name: repoItem.name,
        fullName: repoItem.fullName,
        owner: repoItem.owner,
        description: repoItem.description || '',
        url: repoItem.url,
        language: repoItem.language || 'TypeScript',
        starsCount: repoItem.starsCount,
        forksCount: repoItem.forksCount,
        openIssuesCount: repoItem.openIssuesCount,
        ecosystem: repoItem.ecosystem || 'Node.js',
        repoType: repoItem.repoType || 'INFRA',
        maintainerActivityScore: repoItem.maintainerActivityScore ?? 5.0,
      };

      const mappedIssue: Issue = {
        id: i.id,
        githubId: Number(i.githubId),
        githubNumber: i.githubNumber,
        repository: formattedRepo,
        title: i.title,
        body: i.body || '',
        url: getGitHubIssueWebUrl({ url: i.url, githubNumber: i.githubNumber, repository: formattedRepo }),
        status: i.status,
        labels: i.labels || [],
        language: i.language || formattedRepo.language || 'TypeScript',
        ecosystem: i.ecosystem || formattedRepo.ecosystem || 'Node.js',
        authorUsername: i.authorUsername || 'ghost',
        rrDifficulty: i.rrDifficulty,
        createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
        prActivityClassification: classifyIssuePRActivity(i),
        openPrCount: i.openPrCount ?? 0,
        mergedPrCount: i.mergedPrCount ?? 0,
        latestPrActivityAt: i.latestPrActivityAt ? new Date(i.latestPrActivityAt).toISOString() : undefined,
        scoreBreakdown: score
          ? {
              technicalDifficulty: score.technicalDifficulty,
              codebaseComplexity: score.codebaseComplexity,
              issueScope: score.issueScope,
              domainKnowledge: score.domainKnowledge,
              expectedImpact: score.expectedImpact,
              testingComplexity: score.testingComplexity,
              issueClarity: score.issueClarity,
              maintainerActivity: score.maintainerActivity,
            }
          : undefined,
      };

      return mappedIssue;
    });

    return {
      issues: formattedIssues,
      totalCount,
      page: currentPage,
      totalPages,
      pageSize,
      availableLanguages,
      availableEcosystems,
      availableRepositories,
      availableOrganizations,
      availableLabels,
      availableRepoTypes,
    };
  } catch (err) {
    console.error('Error in getFilteredIssues:', err);
    return {
      issues: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      pageSize,
      availableLanguages: [],
      availableEcosystems: [],
      availableRepositories: [],
      availableOrganizations: getTargetOrganizationLogins(),
      availableLabels: [],
      availableRepoTypes: [],
    };
  }
}

/**
 * Single issue query service by ID with detailed 8-factor score metadata.
 */
export async function getIssueById(id: string): Promise<IssueDetailResult | null> {
  try {
    const isNum = !isNaN(parseInt(id, 10));
    const dbIssue = await withPrismaRetry(() =>
      prisma.issue.findFirst({
        where: {
          OR: [
            { id },
            ...(isNum ? [{ githubNumber: parseInt(id, 10) }] : []),
          ],
        },
        include: { repository: true, scores: true },
      })
    );

    if (!dbIssue) return null;

    // Layer 3 On-Demand Freshness Check (fire and forget, 2-min cooldown)
    if (dbIssue.repository?.fullName) {
      orchestrator.checkOnDemandFreshness(dbIssue.repository.fullName).catch(() => {});
    }

    const repoItem = dbIssue.repository;
    const score = dbIssue.scores;

    const formattedRepo: Repository = {
      id: repoItem.id,
      githubId: Number(repoItem.githubId),
      name: repoItem.name,
      fullName: repoItem.fullName,
      owner: repoItem.owner,
      description: repoItem.description || '',
      url: repoItem.url,
      language: repoItem.language || 'TypeScript',
      starsCount: repoItem.starsCount,
      forksCount: repoItem.forksCount,
      openIssuesCount: repoItem.openIssuesCount,
      ecosystem: repoItem.ecosystem || 'Node.js',
      repoType: repoItem.repoType || 'INFRA',
      maintainerActivityScore: repoItem.maintainerActivityScore ?? 5.0,
    };

    const formattedIssue: Issue = {
      id: dbIssue.id,
      githubId: Number(dbIssue.githubId),
      githubNumber: dbIssue.githubNumber,
      repository: formattedRepo,
      title: dbIssue.title,
      body: dbIssue.body || '',
      url: getGitHubIssueWebUrl({ url: dbIssue.url, githubNumber: dbIssue.githubNumber, repository: formattedRepo }),
      status: dbIssue.status,
      labels: dbIssue.labels || [],
      language: dbIssue.language || formattedRepo.language || 'TypeScript',
      ecosystem: dbIssue.ecosystem || formattedRepo.ecosystem || 'Node.js',
      authorUsername: dbIssue.authorUsername || 'ghost',
      rrDifficulty: dbIssue.rrDifficulty,
      createdAt: dbIssue.createdAt ? new Date(dbIssue.createdAt).toISOString() : new Date().toISOString(),
      prActivityClassification: classifyIssuePRActivity(dbIssue),
      openPrCount: dbIssue.openPrCount ?? 0,
      mergedPrCount: dbIssue.mergedPrCount ?? 0,
      latestPrActivityAt: dbIssue.latestPrActivityAt ? new Date(dbIssue.latestPrActivityAt).toISOString() : undefined,
      scoreBreakdown: score
        ? {
            technicalDifficulty: score.technicalDifficulty,
            codebaseComplexity: score.codebaseComplexity,
            issueScope: score.issueScope,
            domainKnowledge: score.domainKnowledge,
            expectedImpact: score.expectedImpact,
            testingComplexity: score.testingComplexity,
            issueClarity: score.issueClarity,
            maintainerActivity: score.maintainerActivity,
          }
        : undefined,
    };

    return {
      issue: formattedIssue,
      scoreDetails: score
        ? {
            id: score.id,
            scoringVersion: score.scoringVersion || 'v1.1.0',
            calculatedAt: score.calculatedAt ? new Date(score.calculatedAt).toISOString() : new Date().toISOString(),
            compositeScore: score.compositeScore ?? dbIssue.rrDifficulty,
            technicalDifficulty: score.technicalDifficulty,
            codebaseComplexity: score.codebaseComplexity,
            issueScope: score.issueScope,
            domainKnowledge: score.domainKnowledge,
            expectedImpact: score.expectedImpact,
            testingComplexity: score.testingComplexity,
            issueClarity: score.issueClarity,
            maintainerActivity: score.maintainerActivity,
            reasoning: score.reasoning || undefined,
          }
        : undefined,
    };
  } catch (err) {
    console.error('Error fetching issue by ID:', err);
    return null;
  }
}

/**
 * Related issues query service for issue detail page.
 */
export async function getRelatedIssues(currentIssueId: string, limit = 3): Promise<Issue[]> {
  try {
    const currentResult = await getIssueById(currentIssueId);
    const current = currentResult?.issue;
    const allResult = await getFilteredIssues({ pageSize: 30 });
    const otherIssues = allResult.issues.filter((i) => i.id !== currentIssueId);

    if (!current) return otherIssues.slice(0, limit);

    const scored = otherIssues.map((iss) => {
      let matchScore = 0;
      if (iss.repository?.id === current.repository.id) matchScore += 5;
      if (iss.language === current.language) matchScore += 3;
      if (iss.ecosystem === current.ecosystem) matchScore += 2;
      return { issue: iss, matchScore };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, limit).map((s) => s.issue);
  } catch (err) {
    console.error('Error in getRelatedIssues:', err);
    return [];
  }
}

