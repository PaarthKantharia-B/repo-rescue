import fs from 'fs';
import path from 'path';
import { evaluateRepositoryEligibility, parseGithubLinkHeader, DiscoveredGithubRepo } from '../src/lib/injector/discovery';
import { RawGithubIssue } from '../src/lib/injector/ingestion';

function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.replace(/\r$/, '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    // ignore
  }
}
loadEnvFile();

export type DryRunTerminalStatus = 'SUCCESS' | 'BLOCKED_RATE_LIMIT' | 'FAILED';

export interface DryRunOptions {
  customToken?: string;
  maxReposLimit?: number; // default undefined (scan ALL eligible repos)
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>; // optional mock fetch for deterministic tests
}

export interface DryRunResult {
  orgLogin: string;
  status: DryRunTerminalStatus;
  repositoriesDiscovered: number | 'UNKNOWN';
  eligibleCount: number | 'UNKNOWN';
  ineligibleCount: number | 'UNKNOWN';
  archivedCount: number | 'UNKNOWN';
  forkCount: number | 'UNKNOWN';
  noIssuesCount: number | 'UNKNOWN';
  privateCount: number | 'UNKNOWN';
  inaccessibleCount: number | 'UNKNOWN';
  repoListRequests: number;
  issueListRequests: number;
  totalPages: number;
  reposScannedSuccess: number;
  reposScannedFailed: number;
  issuesReturned: number | 'UNKNOWN';
  prsSkipped: number | 'UNKNOWN';
  apiErrorsCount: number;
  rateLimitResponsesCount: number;
  rateLimitRemaining: string;
  rateLimitReset: string;
  errors: string[];
  durationMs: number;
}

function isRateLimitResponse(res: Response, bodyText: string): boolean {
  if (res.status === 429) return true;
  const rem = res.headers.get('x-ratelimit-remaining');
  if (rem === '0') return true;
  if (res.status === 403) {
    if (rem === '0' || bodyText.toLowerCase().includes('rate limit')) {
      return true;
    }
  }
  return false;
}

export async function runOrganizationDryRun(
  orgLogin: string,
  options?: DryRunOptions
): Promise<DryRunResult> {
  const startTime = Date.now();
  const token = options?.customToken || process.env.GITHUB_TOKEN;
  const fetchImpl = options?.fetchFn || fetch;

  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-DryRun-V1',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  let repoListRequests = 0;
  let issueListRequests = 0;
  let totalPages = 0;
  let reposScannedSuccess = 0;
  let reposScannedFailed = 0;
  let issuesReturnedNum = 0;
  let prsSkippedNum = 0;
  let apiErrorsCount = 0;
  let rateLimitResponsesCount = 0;
  let rateLimitRemaining = 'Unknown';
  let rateLimitReset = 'Unknown';
  const errors: string[] = [];

  let repoDiscoveryBlockedRateLimit = false;
  let repoDiscoveryFailed = false;
  let issueScanBlockedRateLimit = false;
  let issueScanFailed = false;

  async function apiFetch(url: string, isIssueList = false): Promise<{ res: Response; bodyText: string }> {
    if (isIssueList) {
      issueListRequests++;
    } else {
      repoListRequests++;
    }
    totalPages++;

    let res: Response;
    try {
      res = await fetchImpl(url, { headers });
    } catch (err: any) {
      apiErrorsCount++;
      throw err;
    }

    const rem = res.headers.get('x-ratelimit-remaining');
    const rst = res.headers.get('x-ratelimit-reset');
    if (rem) rateLimitRemaining = rem;
    if (rst) {
      const resetDate = new Date(parseInt(rst, 10) * 1000);
      rateLimitReset = resetDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }

    const bodyText = await res.clone().text().catch(() => '');

    const rateLimited = isRateLimitResponse(res, bodyText);
    if (rateLimited) {
      rateLimitResponsesCount++;
    }

    if (!res.ok && res.status !== 304) {
      apiErrorsCount++;
    }

    return { res, bodyText };
  }

  // 1. Discover ALL Public Repositories (Paginated)
  const allRawRepos: DiscoveredGithubRepo[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.github.com/orgs/${orgLogin}/repos?type=public&per_page=100&page=${page}`;
    try {
      const { res, bodyText } = await apiFetch(url, false);
      if (!res.ok) {
        if (isRateLimitResponse(res, bodyText)) {
          repoDiscoveryBlockedRateLimit = true;
          errors.push(`Org repos fetch failed HTTP ${res.status}: rate limit exceeded`);
        } else {
          repoDiscoveryFailed = true;
          errors.push(`Org repos fetch failed HTTP ${res.status}: ${res.statusText}`);
        }
        break;
      }
      const items: DiscoveredGithubRepo[] = JSON.parse(bodyText);
      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        break;
      }
      allRawRepos.push(...items);
      const linkHeader = res.headers.get('Link');
      const parsedLinks = parseGithubLinkHeader(linkHeader);
      if (items.length < 100 || !parsedLinks.next) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (err: any) {
      repoDiscoveryFailed = true;
      errors.push(`Network error fetching org repos: ${err.message || String(err)}`);
      break;
    }
  }

  // 2. Evaluate Repository Eligibility if discovery succeeded
  let eligibleCountNum = 0;
  let archivedCountNum = 0;
  let forkCountNum = 0;
  let noIssuesCountNum = 0;
  let privateCountNum = 0;
  let inaccessibleCountNum = 0;
  const eligibleRepos: DiscoveredGithubRepo[] = [];

  if (!repoDiscoveryBlockedRateLimit && !repoDiscoveryFailed) {
    for (const repo of allRawRepos) {
      const evalResult = evaluateRepositoryEligibility(repo, orgLogin);
      if (evalResult.isEligible) {
        eligibleCountNum++;
        eligibleRepos.push(repo);
      } else {
        if (evalResult.status === 'INELIGIBLE_ARCHIVED') archivedCountNum++;
        else if (evalResult.status === 'INELIGIBLE_FORK') forkCountNum++;
        else if (evalResult.status === 'INELIGIBLE_NO_ISSUES') noIssuesCountNum++;
        else if (evalResult.status === 'INELIGIBLE_PRIVATE') privateCountNum++;
        else if (evalResult.status === 'INELIGIBLE_INACCESSIBLE') inaccessibleCountNum++;
      }
    }
  }

  // 3. Issue Scan across Eligible Repositories
  if (!repoDiscoveryBlockedRateLimit && !repoDiscoveryFailed && eligibleRepos.length > 0) {
    const reposToScan = options?.maxReposLimit ? eligibleRepos.slice(0, options.maxReposLimit) : eligibleRepos;

    for (const repo of reposToScan) {
      let repoFailed = false;
      let repoRateLimited = false;
      let issuePage = 1;
      let issueHasMore = true;

      while (issueHasMore) {
        const issueUrl = `https://api.github.com/repos/${repo.full_name}/issues?state=open&per_page=100&page=${issuePage}`;
        try {
          const { res, bodyText } = await apiFetch(issueUrl, true);
          if (!res.ok) {
            if (res.status === 422) {
              // GitHub REST API caps issue list pagination at 1,000 items (10 pages x 100 per page)
              issueHasMore = false;
              break;
            }
            repoFailed = true;
            if (isRateLimitResponse(res, bodyText)) {
              repoRateLimited = true;
              issueScanBlockedRateLimit = true;
              errors.push(`Issue fetch failed HTTP ${res.status} (rate limit) for '${repo.full_name}'`);
            } else {
              issueScanFailed = true;
              errors.push(`Issue fetch failed HTTP ${res.status} for '${repo.full_name}'`);
            }
            break;
          }
          const items: RawGithubIssue[] = JSON.parse(bodyText);
          if (!Array.isArray(items) || items.length === 0) {
            issueHasMore = false;
            break;
          }

          for (const item of items) {
            if (item.pull_request !== undefined) {
              prsSkippedNum++;
            } else {
              issuesReturnedNum++;
            }
          }

          const linkHeader = res.headers.get('Link');
          const parsedLinks = parseGithubLinkHeader(linkHeader);
          if (items.length < 100 || !parsedLinks.next || issuePage >= 10) {
            issueHasMore = false;
          } else {
            issuePage++;
          }
        } catch (err: any) {
          repoFailed = true;
          issueScanFailed = true;
          errors.push(`Network error fetching issues for '${repo.full_name}': ${err.message || String(err)}`);
          break;
        }
      }

      if (repoFailed) {
        reposScannedFailed++;
      } else {
        reposScannedSuccess++;
      }

      if (repoRateLimited) {
        break;
      }
    }
  }

  let status: DryRunTerminalStatus = 'SUCCESS';
  if (repoDiscoveryBlockedRateLimit || issueScanBlockedRateLimit) {
    status = 'BLOCKED_RATE_LIMIT';
  } else if (repoDiscoveryFailed || issueScanFailed) {
    status = 'FAILED';
  } else {
    status = 'SUCCESS';
  }

  const repositoriesDiscovered = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : allRawRepos.length;
  const eligibleCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : eligibleCountNum;
  const ineligibleCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : (allRawRepos.length - eligibleCountNum);
  const archivedCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : archivedCountNum;
  const forkCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : forkCountNum;
  const noIssuesCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : noIssuesCountNum;
  const privateCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : privateCountNum;
  const inaccessibleCount = (repoDiscoveryBlockedRateLimit || repoDiscoveryFailed) ? 'UNKNOWN' : inaccessibleCountNum;

  const issuesReturned = (status !== 'SUCCESS') ? 'UNKNOWN' : issuesReturnedNum;
  const prsSkipped = (status !== 'SUCCESS') ? 'UNKNOWN' : prsSkippedNum;

  const durationMs = Date.now() - startTime;

  return {
    orgLogin,
    status,
    repositoriesDiscovered,
    eligibleCount,
    ineligibleCount,
    archivedCount,
    forkCount,
    noIssuesCount,
    privateCount,
    inaccessibleCount,
    repoListRequests,
    issueListRequests,
    totalPages,
    reposScannedSuccess,
    reposScannedFailed,
    issuesReturned,
    prsSkipped,
    apiErrorsCount,
    rateLimitResponsesCount,
    rateLimitRemaining,
    rateLimitReset,
    errors,
    durationMs,
  };
}

export function formatDryRunReport(result: DryRunResult): string {
  const attemptedCount = result.reposScannedSuccess + result.reposScannedFailed;

  const repoDiscoveredStr = typeof result.repositoriesDiscovered === 'number' ? `${result.repositoriesDiscovered}` : 'UNKNOWN (Rate Limited / Failed)';
  const eligibleStr = typeof result.eligibleCount === 'number' ? `${result.eligibleCount}` : 'UNKNOWN (Rate Limited / Failed)';
  const ineligibleStr = typeof result.ineligibleCount === 'number' ? `${result.ineligibleCount}` : 'UNKNOWN (Rate Limited / Failed)';

  const archivedStr = typeof result.archivedCount === 'number' ? `${result.archivedCount}` : 'UNKNOWN';
  const forkStr = typeof result.forkCount === 'number' ? `${result.forkCount}` : 'UNKNOWN';
  const noIssuesStr = typeof result.noIssuesCount === 'number' ? `${result.noIssuesCount}` : 'UNKNOWN';
  const privateStr = typeof result.privateCount === 'number' ? `${result.privateCount}` : 'UNKNOWN';
  const inaccessibleStr = typeof result.inaccessibleCount === 'number' ? `${result.inaccessibleCount}` : 'UNKNOWN';

  const issuesReturnedStr = typeof result.issuesReturned === 'number' ? `${result.issuesReturned}` : 'UNKNOWN (Rate Limited / Failed)';
  const prsSkippedStr = typeof result.prsSkipped === 'number' ? `${result.prsSkipped}` : 'UNKNOWN (Rate Limited / Failed)';

  let statusHeader = '';
  let statusBanner = '';
  if (result.status === 'SUCCESS') {
    statusHeader = '✓ DRY RUN COMPLETE (SUCCESS)';
    statusBanner = `✓ ALL ${attemptedCount} ELIGIBLE REPOSITORIES ATTEMPTED`;
  } else if (result.status === 'BLOCKED_RATE_LIMIT') {
    statusHeader = '⚠️ DRY RUN BLOCKED (RATE LIMITED)';
    statusBanner = '⚠️ DISCOVERY OR ISSUE SCAN BLOCKED BY GITHUB RATE LIMIT';
  } else {
    statusHeader = '❌ DRY RUN FAILED';
    statusBanner = '❌ DISCOVERY OR ISSUE SCAN ENCOUNTERED UNRECOVERABLE ERRORS';
  }

  const hasToken = Boolean(process.env.GITHUB_TOKEN);

  const lines = [
    '══════════════════════════════════════════════',
    '        REPO RESCUE — ORGANIZATION DRY RUN',
    '══════════════════════════════════════════════',
    '',
    `Organization: ${result.orgLogin}`,
    `Status: ${result.status}`,
    `Authentication: ${hasToken ? 'AUTHENTICATED (GITHUB_TOKEN loaded)' : 'UNAUTHENTICATED'}`,
    'Mode: DRY RUN — NO DATABASE WRITES',
    '',
    'Repository Discovery',
    '──────────────────────────────────────────────',
    `Repositories discovered:       ${repoDiscoveredStr}`,
    `Eligible repositories:         ${eligibleStr}`,
    `Ineligible repositories:       ${ineligibleStr}`,
    '',
    'Eligibility Breakdown',
    '──────────────────────────────────────────────',
    `Archived:                      ${archivedStr}`,
    `Forks:                         ${forkStr}`,
    `Issues disabled:              ${noIssuesStr}`,
    `Private:                       ${privateStr}`,
    `Inaccessible:                 ${inaccessibleStr}`,
    '',
    'Issue Discovery',
    '──────────────────────────────────────────────',
    `Eligible repositories attempted: ${attemptedCount}`,
    `Repositories successfully scanned: ${result.reposScannedSuccess}`,
    `Repositories failed:           ${result.reposScannedFailed}`,
    `GitHub issues returned:        ${issuesReturnedStr}`,
    `Pull requests skipped:        ${prsSkippedStr}`,
    '',
    'GitHub API Counters',
    '──────────────────────────────────────────────',
    `Repository-list requests:      ${result.repoListRequests}`,
    `Issue-list requests:           ${result.issueListRequests}`,
    `Total pages fetched:           ${result.totalPages}`,
    `API errors:                    ${result.apiErrorsCount}`,
    `Rate-limit responses:          ${result.rateLimitResponsesCount}`,
    `Rate limit remaining:          ${result.rateLimitRemaining}`,
    `Rate limit reset:              ${result.rateLimitReset}`,
    '',
    'Errors',
    '──────────────────────────────────────────────',
    result.errors.length === 0 ? 'None' : result.errors.map((e) => `• ${e}`).join('\n'),
    '',
    `Duration: ${result.durationMs}ms`,
    '',
    statusHeader,
    statusBanner,
    '✓ NO DATABASE WRITES',
    '✓ NO SYNTHETIC RECORDS',
    '══════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

if (require.main === module) {
  const org = process.argv[2] || 'supabase';
  runOrganizationDryRun(org)
    .then((res) => {
      console.log(formatDryRunReport(res));
    })
    .catch((err) => {
      console.error('Dry run execution error:', err);
      process.exit(1);
    });
}

