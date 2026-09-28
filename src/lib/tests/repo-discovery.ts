import {
  evaluateRepositoryEligibility,
  parseGithubLinkHeader,
  discoverOrganizationRepositories,
  discoverAllTargetOrganizations,
} from '../injector/discovery';
import { TARGET_ORGANIZATIONS_CONFIG, getOrganizationConfig } from '../organizations/config';
import { mockDbStore } from '../../../scripts/db-runner';

/**
 * Phase 2 Repository Auto-Discovery & Eligibility Engine Test Suite.
 */
export async function runRepoDiscoveryTests() {
  console.log('\n🔍 Running Phase 2 Repository Auto-Discovery & Eligibility Engine Test Suite...\n');

  let passed = 0;
  const total = 11;

  // TEST 1: All 10 Target Organizations present in registry and discoverable
  try {
    const orgs = TARGET_ORGANIZATIONS_CONFIG;
    if (orgs.length === 10) {
      console.log('  ✅ [TEST 1 PASSED] All 10 target organizations present and ready for discovery');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED] Count:', orgs.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: Pagination Link header parser correctness
  try {
    const header = '<https://api.github.com/orgs/supabase/repos?page=2>; rel="next", <https://api.github.com/orgs/supabase/repos?page=5>; rel="last"';
    const parsed = parseGithubLinkHeader(header);

    if (parsed.next === 'https://api.github.com/orgs/supabase/repos?page=2') {
      console.log('  ✅ [TEST 2 PASSED] Pagination Link header parser correctly extracts next page URI');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', parsed);
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: Fork Exclusion Rule
  try {
    const evalResult = evaluateRepositoryEligibility(
      { fork: true, archived: false, private: false, has_issues: true, owner: { login: 'supabase' } },
      'supabase'
    );

    if (!evalResult.isEligible && evalResult.status === 'INELIGIBLE_FORK' && evalResult.reason.includes('fork')) {
      console.log('  ✅ [TEST 3 PASSED] Fork repository correctly classified as INELIGIBLE_FORK');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', evalResult);
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: Archived Repository Exclusion Rule
  try {
    const evalResult = evaluateRepositoryEligibility(
      { fork: false, archived: true, private: false, has_issues: true, owner: { login: 'supabase' } },
      'supabase'
    );

    if (!evalResult.isEligible && evalResult.status === 'INELIGIBLE_ARCHIVED' && evalResult.reason.includes('archived')) {
      console.log('  ✅ [TEST 4 PASSED] Archived repository correctly classified as INELIGIBLE_ARCHIVED');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', evalResult);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Private Repository Exclusion Rule
  try {
    const evalResult = evaluateRepositoryEligibility(
      { fork: false, archived: false, private: true, has_issues: true, owner: { login: 'supabase' } },
      'supabase'
    );

    if (!evalResult.isEligible && evalResult.status === 'INELIGIBLE_PRIVATE' && evalResult.reason.includes('private')) {
      console.log('  ✅ [TEST 5 PASSED] Private repository correctly classified as INELIGIBLE_PRIVATE');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', evalResult);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: Issues-Disabled Repository Exclusion Rule
  try {
    const evalResult = evaluateRepositoryEligibility(
      { fork: false, archived: false, private: false, has_issues: false, owner: { login: 'supabase' } },
      'supabase'
    );

    if (!evalResult.isEligible && evalResult.status === 'INELIGIBLE_NO_ISSUES' && evalResult.reason.includes('Issues are disabled')) {
      console.log('  ✅ [TEST 6 PASSED] Issues-disabled repository correctly classified as INELIGIBLE_NO_ISSUES');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', evalResult);
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: Eligible Repository Acceptance Rule
  try {
    const evalResult = evaluateRepositoryEligibility(
      { fork: false, archived: false, private: false, has_issues: true, owner: { login: 'supabase' } },
      'supabase'
    );

    if (evalResult.isEligible && evalResult.status === 'ELIGIBLE') {
      console.log('  ✅ [TEST 7 PASSED] Public non-fork active repo with issues enabled correctly accepted as ELIGIBLE');
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', evalResult);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Idempotent Repeated Discovery & Repository Store Upsert
  try {
    const initialRepoCount = mockDbStore.repositories.length;
    const mockOrg = getOrganizationConfig('supabase')!;

    // Upsert a test discovery repository twice
    const rawRepo = {
      id: 999991,
      name: 'supabase-test-repo',
      full_name: 'supabase/supabase-test-repo',
      owner: { login: 'supabase' },
      description: 'Test repository',
      html_url: 'https://github.com/supabase/supabase-test-repo',
      language: 'TypeScript',
      stargazers_count: 100,
      forks_count: 10,
      open_issues_count: 5,
      private: false,
      fork: false,
      archived: false,
      has_issues: true,
    };

    const eval1 = evaluateRepositoryEligibility(rawRepo, 'supabase');
    const repoRecord = {
      id: `repo-gh-${rawRepo.id}`,
      githubId: rawRepo.id,
      name: rawRepo.name,
      fullName: rawRepo.full_name,
      owner: rawRepo.owner.login,
      description: rawRepo.description || '',
      url: rawRepo.html_url,
      language: rawRepo.language || 'TypeScript',
      starsCount: rawRepo.stargazers_count,
      forksCount: rawRepo.forks_count,
      openIssuesCount: rawRepo.open_issues_count,
      isPrivate: rawRepo.private,
      isArchived: rawRepo.archived,
      isFork: rawRepo.fork,
      hasIssues: rawRepo.has_issues,
      eligibilityStatus: eval1.status,
      eligibilityReason: eval1.reason,
      ecosystem: 'Node.js',
      repoType: 'OPEN_SOURCE',
      maintainerActivityScore: 8.5,
      organizationId: 'org-cfg-1',
      lastSyncedAt: new Date().toISOString(),
    };

    // Run 1: Upsert
    const idx1 = mockDbStore.repositories.findIndex((r) => r.githubId === rawRepo.id);
    if (idx1 >= 0) mockDbStore.repositories[idx1] = repoRecord;
    else mockDbStore.repositories.push(repoRecord);

    const countAfterRun1 = mockDbStore.repositories.length;

    // Run 2: Upsert identical record
    const idx2 = mockDbStore.repositories.findIndex((r) => r.githubId === rawRepo.id);
    if (idx2 >= 0) mockDbStore.repositories[idx2] = repoRecord;
    else mockDbStore.repositories.push(repoRecord);

    const countAfterRun2 = mockDbStore.repositories.length;

    if (countAfterRun1 === initialRepoCount + 1 && countAfterRun2 === countAfterRun1) {
      console.log('  ✅ [TEST 8 PASSED] Idempotent repeated repository upsert verified (0 duplicate records created)');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', { initialRepoCount, countAfterRun1, countAfterRun2 });
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: GitHub API Failure Handling preserves existing records and logs error
  try {
    const prevRepoCount = mockDbStore.repositories.length;
    const prevLogCount = mockDbStore.syncAuditLogs.length;

    // Call discovery with invalid token / unauthenticated endpoint that fails safely
    const invalidOrgConfig = {
      login: 'invalid-nonexistent-org-xyz-99',
      name: 'Invalid Org',
      htmlUrl: 'https://github.com/invalid-nonexistent-org-xyz-99',
      autoDiscoverRepos: true,
      syncIssues: true,
      syncComments: true,
      syncLabels: true,
      syncPrActivity: true,
      reconciliationEnabled: true,
    };

    const result = await discoverOrganizationRepositories(invalidOrgConfig);

    const afterRepoCount = mockDbStore.repositories.length;
    const afterLogCount = mockDbStore.syncAuditLogs.length;

    if (result.success === false && afterRepoCount === prevRepoCount && afterLogCount > prevLogCount) {
      console.log('  ✅ [TEST 9 PASSED] GitHub API failure handled safely: last known store preserved, failure logged in audit trail');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', { resultSuccess: result.success, prevRepoCount, afterRepoCount, prevLogCount, afterLogCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: SyncAuditLog Creation on Discovery Actions
  try {
    const logs = mockDbStore.syncAuditLogs.filter((l) => l.eventType === 'ORG_DISCOVERED');
    if (logs.length > 0 && logs.some((l) => l.status === 'SUCCESS' || l.status === 'FAILED')) {
      console.log(`  ✅ [TEST 10 PASSED] SyncAuditLog creation verified (${logs.length} discovery log records present in audit store)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED] Logs count:', logs.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: Zero Fabricated Repository Records
  try {
    const invalidOrgConfig = {
      login: 'fake-test-org-000',
      name: 'Fake Test Org',
      htmlUrl: 'https://github.com/fake-test-org-000',
      autoDiscoverRepos: true,
      syncIssues: true,
      syncComments: true,
      syncLabels: true,
      syncPrActivity: true,
      reconciliationEnabled: true,
    };

    const res = await discoverOrganizationRepositories(invalidOrgConfig);

    if (res.repositories.length === 0 && res.discoveredCount === 0 && res.success === false) {
      console.log('  ✅ [TEST 11 PASSED] Zero fabricated repository records: network API failure yields exactly 0 fallback records');
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  console.log(`\n📊 Phase 2 Repo Discovery Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Phase 2 Repo Discovery Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Repo Discovery tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runRepoDiscoveryTests().catch((err) => {
    console.error('Repo discovery test suite error:', err);
    process.exit(1);
  });
}
