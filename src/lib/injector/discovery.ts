import { OrganizationConfig, Repository, RepositoryEligibilityStatus, SyncAuditLog } from '@/types';
import { TARGET_ORGANIZATIONS_CONFIG, getOrganizationConfig } from '../organizations/config';
import { mockDbStore } from '../../../scripts/db-runner';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { fetchWithTimeout } from './client';

export interface EligibilityEvaluation {
  isEligible: boolean;
  status: RepositoryEligibilityStatus;
  reason: string;
}

export interface DiscoveredGithubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  private: boolean;
  fork: boolean;
  archived: boolean;
  has_issues: boolean;
}

export interface OrgDiscoveryResult {
  orgLogin: string;
  success: boolean;
  discoveredCount: number;
  eligibleCount: number;
  ineligibleCount: number;
  error?: string;
  repositories: Repository[];
}

/**
 * Evaluates a raw GitHub repository against Repo Rescue eligibility rules.
 */
export function evaluateRepositoryEligibility(
  repo: {
    private?: boolean;
    fork?: boolean;
    archived?: boolean;
    has_issues?: boolean;
    owner?: { login: string };
  },
  orgLogin: string
): EligibilityEvaluation {
  if (repo.private) {
    return {
      isEligible: false,
      status: 'INELIGIBLE_PRIVATE',
      reason: 'Repository is private.',
    };
  }
  if (repo.fork) {
    return {
      isEligible: false,
      status: 'INELIGIBLE_FORK',
      reason: 'Repository is a fork of another project.',
    };
  }
  if (repo.archived) {
    return {
      isEligible: false,
      status: 'INELIGIBLE_ARCHIVED',
      reason: 'Repository has been archived by maintainers.',
    };
  }
  if (repo.has_issues === false) {
    return {
      isEligible: false,
      status: 'INELIGIBLE_NO_ISSUES',
      reason: 'GitHub Issues are disabled on this repository.',
    };
  }
  if (repo.owner && repo.owner.login.toLowerCase() !== orgLogin.toLowerCase()) {
    return {
      isEligible: false,
      status: 'INELIGIBLE_INACCESSIBLE',
      reason: `Repository owner '${repo.owner.login}' does not match organization '${orgLogin}'.`,
    };
  }
  return {
    isEligible: true,
    status: 'ELIGIBLE',
    reason: 'Public, active, non-fork organization repository with GitHub Issues enabled.',
  };
}

/**
 * Parses Link header for GitHub REST API pagination.
 */
export function parseGithubLinkHeader(header: string | null): { next?: string } {
  if (!header) return {};
  const links: { next?: string } = {};
  const parts = header.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      if (match[2] === 'next') {
        links.next = match[1];
      }
    }
  }
  return links;
}

/**
 * Discovers and fetches all public repositories for a target organization from GitHub API with full pagination.
 * Zero synthetic or fake repository records are generated on network error.
 */
export async function discoverOrganizationRepositories(
  orgConfig: OrganizationConfig,
  customToken?: string,
  options?: { readOnly?: boolean; maxPages?: number; perPage?: number }
): Promise<OrgDiscoveryResult> {
  const isReadOnly = Boolean(options?.readOnly);
  const perPage = options?.perPage || 100;
  const maxPages = options?.maxPages;
  const token = customToken || process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Injector-V1',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const allRawRepos: DiscoveredGithubRepo[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      let url = `https://api.github.com/orgs/${orgConfig.login}/repos?type=public&sort=created&direction=desc&per_page=${perPage}&page=${page}`;
      console.log(`[Injector Discovery] GitHub repository discovery request started for org '${orgConfig.login}' (page ${page})...`);
      let res = await fetchWithTimeout(url, { headers }, 15000);

      if (!res.ok && res.status === 404) {
        url = `https://api.github.com/users/${orgConfig.login}/repos?type=public&sort=created&direction=desc&per_page=${perPage}&page=${page}`;
        res = await fetchWithTimeout(url, { headers }, 15000);
      }

      if (!res.ok) {
        const errText = `GitHub API request returned HTTP ${res.status} (${res.statusText}) for org '${orgConfig.login}'.`;
        console.warn(`[Injector Discovery] ${errText}`);

        // Log failure in SyncAuditLog
        const auditLog: SyncAuditLog = {
          id: `log-disc-err-${orgConfig.login}-${Date.now()}`,
          organizationId: orgConfig.login,
          eventType: 'ORG_DISCOVERED',
          status: 'FAILED',
          errorMessage: errText,
          createdAt: new Date().toISOString(),
        };
        mockDbStore.syncAuditLogs.push(auditLog);

        return {
          orgLogin: orgConfig.login,
          success: false,
          discoveredCount: 0,
          eligibleCount: 0,
          ineligibleCount: 0,
          error: errText,
          repositories: [],
        };
      }

      const items: DiscoveredGithubRepo[] = await res.json();
      console.log(`[Injector Discovery] GitHub repository discovery request complete for org '${orgConfig.login}' (fetched ${Array.isArray(items) ? items.length : 0} repos on page ${page}).`);
      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        break;
      }

      allRawRepos.push(...items);

      const linkHeader = res.headers.get('Link');
      const parsedLinks = parseGithubLinkHeader(linkHeader);

      if (items.length < perPage || !parsedLinks.next || (maxPages && page >= maxPages)) {
        hasMore = false;
      } else {
        page++;
      }
    }
  } catch (err: any) {
    const errText = `Network error contacting GitHub API for org '${orgConfig.login}': ${err.message || String(err)}`;
    console.warn(`[Injector Discovery] ${errText}`);

    const auditLog: SyncAuditLog = {
      id: `log-disc-err-${orgConfig.login}-${Date.now()}`,
      organizationId: orgConfig.login,
      eventType: 'ORG_DISCOVERED',
      status: 'FAILED',
      errorMessage: errText,
      createdAt: new Date().toISOString(),
    };
    mockDbStore.syncAuditLogs.push(auditLog);

    return {
      orgLogin: orgConfig.login,
      success: false,
      discoveredCount: 0,
      eligibleCount: 0,
      ineligibleCount: 0,
      error: errText,
      repositories: [],
    };
  }

  // Process raw repos and evaluate eligibility
  const processedRepos: Repository[] = [];
  let eligibleCount = 0;
  let ineligibleCount = 0;
  const now = new Date().toISOString();

  // Find org entity in mockDbStore
  const orgEntity = mockDbStore.organizations.find(
    (o) => o.login.toLowerCase() === orgConfig.login.toLowerCase()
  );

  let dbOrg: any = null;
  if (!isReadOnly) {
    try {
      console.log(`[Injector Discovery] Prisma organization upsert started for '${orgConfig.login}'...`);
      dbOrg = await withPrismaRetry(() =>
        prisma.organization.upsert({
          where: { login: orgConfig.login.toLowerCase() },
          create: {
            githubId: orgConfig.githubId || Math.floor(Math.random() * 1000000),
            login: orgConfig.login.toLowerCase(),
            name: orgConfig.name,
            description: orgConfig.description,
            avatarUrl: orgConfig.avatarUrl,
            htmlUrl: orgConfig.htmlUrl,
            autoDiscoverRepos: orgConfig.autoDiscoverRepos,
            syncIssues: orgConfig.syncIssues,
            syncComments: orgConfig.syncComments,
            syncLabels: orgConfig.syncLabels,
            syncPrActivity: orgConfig.syncPrActivity,
            reconciliationEnabled: orgConfig.reconciliationEnabled,
            lastDiscoveredAt: new Date(now),
            lastSyncedAt: new Date(now),
          },
          update: {
            name: orgConfig.name,
            description: orgConfig.description,
            avatarUrl: orgConfig.avatarUrl,
            htmlUrl: orgConfig.htmlUrl,
            lastDiscoveredAt: new Date(now),
            lastSyncedAt: new Date(now),
          },
        })
      );
      console.log(`[Injector Discovery] Prisma organization upsert complete for '${orgConfig.login}' (id: ${dbOrg?.id}).`);
    } catch (err) {
      console.warn(`[Injector Discovery] Prisma Organization upsert error:`, err);
    }
  }

  for (const raw of allRawRepos) {
    const evaluation = evaluateRepositoryEligibility(raw, orgConfig.login);
    if (evaluation.isEligible) {
      eligibleCount++;
    } else {
      ineligibleCount++;
    }

    // Upsert idempotently in mockDbStore.repositories
    const existingIdx = mockDbStore.repositories.findIndex(
      (r) => r.githubId === raw.id || r.fullName.toLowerCase() === raw.full_name.toLowerCase()
    );

    const repoId = `repo-gh-${raw.id}`;
    const repoRecord: Repository = {
      id: repoId,
      githubId: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      owner: raw.owner.login,
      description: raw.description || '',
      url: raw.html_url,
      language: raw.language || 'TypeScript',
      starsCount: raw.stargazers_count,
      forksCount: raw.forks_count,
      openIssuesCount: raw.open_issues_count,
      isPrivate: raw.private,
      isArchived: raw.archived,
      isFork: raw.fork,
      hasIssues: raw.has_issues,
      eligibilityStatus: evaluation.status,
      eligibilityReason: evaluation.reason,
      ecosystem: raw.language ? `${raw.language}` : 'Node.js',
      repoType: 'OPEN_SOURCE',
      maintainerActivityScore: 8.5,
      organizationId: dbOrg?.id || orgEntity?.id || orgConfig.login,
      lastSyncedAt: existingIdx >= 0 ? mockDbStore.repositories[existingIdx].lastSyncedAt : undefined,
    };

    if (existingIdx >= 0) {
      if (!isReadOnly) {
        mockDbStore.repositories[existingIdx] = {
          ...mockDbStore.repositories[existingIdx],
          ...repoRecord,
          id: mockDbStore.repositories[existingIdx].id, // preserve existing DB ID
          lastSyncedAt: mockDbStore.repositories[existingIdx].lastSyncedAt, // preserve issue sync timestamp
        };
      }
      processedRepos.push(repoRecord);
    } else {
      if (!isReadOnly) {
        mockDbStore.repositories.push(repoRecord);
      }
      processedRepos.push(repoRecord);
    }
  }

  console.log(`[Injector Discovery] Repository enumeration complete for '${orgConfig.login}': ${allRawRepos.length} total repos discovered (${eligibleCount} ELIGIBLE).`);

  // Sequential Prisma Repository upserts to prevent connection pool exhaustion
  if (!isReadOnly) {
    console.log(`[Injector Discovery] Starting sequential Prisma repository persistence for ${allRawRepos.length} repos...`);
    let repoPersistIndex = 0;
    for (const raw of allRawRepos) {
      repoPersistIndex++;
      if (repoPersistIndex === 1) {
        console.log(`[Injector Discovery] First repository persistence started: '${raw.full_name}'...`);
      }
      const evaluation = evaluateRepositoryEligibility(raw, orgConfig.login);
      try {
        await withPrismaRetry(() =>
          prisma.repository.upsert({
            where: { fullName: raw.full_name },
            create: {
              githubId: raw.id,
              name: raw.name,
              fullName: raw.full_name,
              owner: raw.owner.login,
              description: raw.description || '',
              url: raw.html_url,
              language: raw.language || 'TypeScript',
              starsCount: raw.stargazers_count,
              forksCount: raw.forks_count,
              openIssuesCount: raw.open_issues_count,
              isPrivate: raw.private,
              isArchived: raw.archived,
              isFork: raw.fork,
              hasIssues: raw.has_issues,
              eligibilityStatus: evaluation.status,
              eligibilityReason: evaluation.reason,
              ecosystem: raw.language ? `${raw.language}` : 'Node.js',
              repoType: 'OPEN_SOURCE',
              maintainerActivityScore: 8.5,
              organizationId: dbOrg?.id || undefined,
              lastSyncedAt: null, // Null to ensure newly discovered repos are queued immediately (nulls: 'first')
            },
            update: {
              name: raw.name,
              owner: raw.owner.login,
              description: raw.description || '',
              url: raw.html_url,
              language: raw.language || 'TypeScript',
              starsCount: raw.stargazers_count,
              forksCount: raw.forks_count,
              openIssuesCount: raw.open_issues_count,
              isPrivate: raw.private,
              isArchived: raw.archived,
              isFork: raw.fork,
              hasIssues: raw.has_issues,
              eligibilityStatus: evaluation.status,
              eligibilityReason: evaluation.reason,
              ecosystem: raw.language ? `${raw.language}` : 'Node.js',
              organizationId: dbOrg?.id || undefined,
              // DO NOT update lastSyncedAt here; lastSyncedAt is reserved for issue reconciliation
            },
          })
        );
        if (repoPersistIndex === 1) {
          console.log(`[Injector Discovery] First repository persistence complete: '${raw.full_name}'.`);
        }
      } catch (err) {
        console.warn(`[Injector Discovery] Prisma Repository upsert error for '${raw.full_name}':`, err);
      }
    }
    console.log(`[Injector Discovery] Sequential Prisma repository persistence complete for '${orgConfig.login}'.`);
  }

  // Update org entity timestamps
  if (!isReadOnly && orgEntity) {
    orgEntity.lastDiscoveredAt = now;
    orgEntity.lastSyncedAt = now;
  }

  // Record Audit Log
  const auditLog: SyncAuditLog = {
    id: `log-disc-${orgConfig.login}-${Date.now()}`,
    organizationId: orgConfig.login,
    eventType: 'ORG_DISCOVERED',
    status: 'SUCCESS',
    changesSummary: `Discovered ${allRawRepos.length} public repos (${eligibleCount} ELIGIBLE, ${ineligibleCount} INELIGIBLE).`,
    createdAt: now,
  };
  if (!isReadOnly) {
    mockDbStore.syncAuditLogs.push(auditLog);
    try {
      await withPrismaRetry(() =>
        prisma.syncAuditLog.create({
          data: {
            organizationId: dbOrg?.id || undefined,
            eventType: 'ORG_DISCOVERED',
            status: 'SUCCESS',
            changesSummary: auditLog.changesSummary,
          },
        })
      );
    } catch (err) {}
  }

  return {
    orgLogin: orgConfig.login,
    success: true,
    discoveredCount: allRawRepos.length,
    eligibleCount,
    ineligibleCount,
    repositories: processedRepos,
  };
}

/**
 * Discovers public repositories across all 10 target organizations.
 */
export async function discoverAllTargetOrganizations(
  customToken?: string
): Promise<OrgDiscoveryResult[]> {
  const results: OrgDiscoveryResult[] = [];
  for (const orgConf of TARGET_ORGANIZATIONS_CONFIG) {
    const res = await discoverOrganizationRepositories(orgConf, customToken);
    results.push(res);
  }
  return results;
}
