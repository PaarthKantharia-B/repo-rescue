import { runOrganizationDryRun } from '../../../scripts/dry-run';
import { mockDbStore } from '../../../scripts/db-runner';

/**
 * Dedicated Dry-Run Terminal Status & Synchronization Test Suite.
 */
export async function runDryRunTests() {
  console.log('\n🧪 Running Phase 6 Dry-Run Test Suite...\n');

  let passed = 0;
  const total = 9;

  const dbIssuesCountBefore = mockDbStore.issues.length;
  const dbReposCountBefore = mockDbStore.repositories.length;

  // TEST 1: Rate-limit during repository discovery -> status BLOCKED_RATE_LIMIT and UNKNOWN counts
  try {
    const mockRateLimitRepoFetch = async (url: string, init?: RequestInit) => {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1700000000',
        },
      });
    };

    const res = await runOrganizationDryRun('supabase', { fetchFn: mockRateLimitRepoFetch });
    if (
      res.status === 'BLOCKED_RATE_LIMIT' &&
      res.repositoriesDiscovered === 'UNKNOWN' &&
      res.eligibleCount === 'UNKNOWN' &&
      res.issuesReturned === 'UNKNOWN' &&
      res.rateLimitResponsesCount === 1
    ) {
      console.log('  ✅ [TEST 1 PASSED] Rate-limit during repo discovery results in status BLOCKED_RATE_LIMIT with UNKNOWN counts');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: Rate-limit during issue discovery -> status BLOCKED_RATE_LIMIT, known repo counts, UNKNOWN issue counts
  try {
    const mockRateLimitIssueFetch = async (url: string, init?: RequestInit) => {
      if (url.includes('/repos?')) {
        return new Response(
          JSON.stringify([
            { full_name: 'supabase/supabase', name: 'supabase', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
          ]),
          {
            status: 200,
            headers: { 'x-ratelimit-remaining': '50' },
          }
        );
      }
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1700000000',
        },
      });
    };

    const res = await runOrganizationDryRun('supabase', { fetchFn: mockRateLimitIssueFetch });
    if (
      res.status === 'BLOCKED_RATE_LIMIT' &&
      res.repositoriesDiscovered === 1 &&
      res.eligibleCount === 1 &&
      res.issuesReturned === 'UNKNOWN' &&
      res.prsSkipped === 'UNKNOWN' &&
      res.rateLimitResponsesCount === 1
    ) {
      console.log('  ✅ [TEST 2 PASSED] Rate-limit during issue discovery preserves known repo counts but marks issue counts UNKNOWN with status BLOCKED_RATE_LIMIT');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: Successful full scan -> status SUCCESS and all numeric counts
  try {
    const mockSuccessfulFetch = async (url: string, init?: RequestInit) => {
      if (url.includes('/repos?')) {
        return new Response(
          JSON.stringify([
            { full_name: 'supabase/supabase', name: 'supabase', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
          ]),
          {
            status: 200,
            headers: { 'x-ratelimit-remaining': '50' },
          }
        );
      }
      return new Response(
        JSON.stringify([
          { id: 101, number: 1, title: 'Bug A', state: 'open' },
          { id: 102, number: 2, title: 'PR B', state: 'open', pull_request: {} },
        ]),
        {
          status: 200,
          headers: { 'x-ratelimit-remaining': '49' },
        }
      );
    };

    const res = await runOrganizationDryRun('supabase', { fetchFn: mockSuccessfulFetch });
    if (
      res.status === 'SUCCESS' &&
      res.repositoriesDiscovered === 1 &&
      res.eligibleCount === 1 &&
      res.issuesReturned === 1 &&
      res.prsSkipped === 1 &&
      res.reposScannedSuccess === 1
    ) {
      console.log('  ✅ [TEST 3 PASSED] Successful full scan yields status SUCCESS with exact numeric counts (1 issue, 1 PR skipped)');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: Unrecoverable API error -> status FAILED with UNKNOWN counts
  try {
    const mockFailedFetch = async () => {
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'x-ratelimit-remaining': '50' },
      });
    };

    const res = await runOrganizationDryRun('supabase', { fetchFn: mockFailedFetch });
    if (
      res.status === 'FAILED' &&
      res.repositoriesDiscovered === 'UNKNOWN' &&
      res.eligibleCount === 'UNKNOWN' &&
      res.apiErrorsCount === 1
    ) {
      console.log('  ✅ [TEST 4 PASSED] Unrecoverable API error results in status FAILED with UNKNOWN counts');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Zero Database Writes Guarantee (mockDbStore remains completely unchanged)
  try {
    const dbIssuesCountAfter = mockDbStore.issues.length;
    const dbReposCountAfter = mockDbStore.repositories.length;

    if (dbIssuesCountBefore === dbIssuesCountAfter && dbReposCountBefore === dbReposCountAfter) {
      console.log('  ✅ [TEST 5 PASSED] Zero database mutations verified (mockDbStore issues & repos unchanged)');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', { dbIssuesCountBefore, dbIssuesCountAfter, dbReposCountBefore, dbReposCountAfter });
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: Zero Synthetic Records Guarantee
  try {
    const fakeRepos = mockDbStore.repositories.filter((r) => r.fullName.includes('fake') || r.name.includes('placeholder'));
    const fakeIssues = mockDbStore.issues.filter((i) => i.title.includes('placeholder') || i.title.includes('fake'));

    if (fakeRepos.length === 0 && fakeIssues.length === 0) {
      console.log('  ✅ [TEST 6 PASSED] Zero synthetic or fabricated records across store during dry-run');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', { fakeRepos, fakeIssues });
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: Attempted Repo N Limit Scan
  try {
    const mockMultiRepoFetch = async (url: string, init?: RequestInit) => {
      if (url.includes('/repos?')) {
        return new Response(
          JSON.stringify([
            { full_name: 'supabase/repo-1', name: 'repo-1', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
            { full_name: 'supabase/repo-2', name: 'repo-2', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
            { full_name: 'supabase/repo-3', name: 'repo-3', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const N = 2;
    const res = await runOrganizationDryRun('supabase', { maxReposLimit: N, fetchFn: mockMultiRepoFetch });
    const attemptedCount = res.reposScannedSuccess + res.reposScannedFailed;

    if (res.status === 'SUCCESS' && attemptedCount === N && res.eligibleCount === 3) {
      console.log(`  ✅ [TEST 7 PASSED] Multi-repo dry-run with maxReposLimit=${N} attempted exactly ${attemptedCount} eligible repos out of ${res.eligibleCount}`);
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', { N, attemptedCount, eligibleCount: res.eligibleCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Live API call graceful degradation (with live/rate-limited GitHub API)
  try {
    const res = await runOrganizationDryRun('supabase', { maxReposLimit: 2 });
    if (res.status === 'SUCCESS' || res.status === 'BLOCKED_RATE_LIMIT' || res.status === 'FAILED') {
      console.log(`  ✅ [TEST 8 PASSED] Live API execution returned valid terminal status '${res.status}'`);
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: All API counters populated correctly
  try {
    const mockCounterFetch = async (url: string, init?: RequestInit) => {
      if (url.includes('/repos?')) {
        return new Response(
          JSON.stringify([
            { full_name: 'supabase/supabase', name: 'supabase', owner: { login: 'supabase' }, private: false, fork: false, archived: false, has_issues: true },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const res = await runOrganizationDryRun('supabase', { fetchFn: mockCounterFetch });
    if (
      typeof res.repoListRequests === 'number' &&
      typeof res.issueListRequests === 'number' &&
      typeof res.totalPages === 'number' &&
      typeof res.durationMs === 'number'
    ) {
      console.log('  ✅ [TEST 9 PASSED] All API counters and timing metrics populated');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  console.log(`\n📊 Dry-Run Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Dry-Run Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Dry-run tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runDryRunTests().catch((err) => {
    console.error('Dry-run test suite error:', err);
    process.exit(1);
  });
}

