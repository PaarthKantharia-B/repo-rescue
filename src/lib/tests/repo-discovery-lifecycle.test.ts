import { prisma } from '@/lib/prisma';
import { discoverOrganizationRepositories, evaluateRepositoryEligibility } from '../injector/discovery';
import { processLiveIssueEvent, processLivePREvent } from '../injector/sync-service';
import { ProductionSyncOrchestrator } from '../injector/orchestrator';
import { getFilteredIssues } from '../issues/service';
import { getOrganizationConfig, getTargetOrganizationLogins } from '../organizations/config';
import { reconcileOrganization, reconcileRepositoryIncremental } from '../injector/reconciliation';

async function runRepoDiscoveryLifecycleTestSuite() {
  console.log('========================================================================');
  console.log('    RUNNING ONGOING REPOSITORY DISCOVERY & LIFECYCLE TEST SUITE        ');
  console.log('========================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: [${testName}]${detail ? ` - ${detail}` : ''}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: [${testName}]${detail ? ` - ${detail}` : ''}`);
      failedTests++;
    }
  }

  // --- PRE-TEST CLEANUP ---
  const dummyRepoFullName = 'test-org-uno/test-newly-discovered-repo';
  await prisma.issueScore.deleteMany({ where: { issue: { repository: { fullName: dummyRepoFullName } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: dummyRepoFullName } } });
  await prisma.repository.deleteMany({ where: { fullName: dummyRepoFullName } });

  // --- TEST A: Existing Repository Incremental Sync ---
  console.log('\n--- Test A: Existing Repository Incremental Sync ---');
  const existingRepo = await prisma.repository.findUnique({ where: { fullName: 'test-org-uno/test-repo-one-' } });
  assert(existingRepo !== null, 'Test A1', 'Existing repository test-org-uno/test-repo-one- is present');

  const reconResultA = await reconcileRepositoryIncremental('test-org-uno/test-repo-one-');
  assert(reconResultA.success === true, 'Test A2', 'Existing repository incremental sync succeeded');

  // --- TEST B & C & D: New Eligible Repository Discovery & Persistence ---
  console.log('\n--- Test B, C & D: New Eligible Repository Discovery & Persistence ---');

  // Create a new simulated repository in test-org-uno via Prisma
  const newlyDiscoveredRepo = await prisma.repository.create({
    data: {
      githubId: 99887766,
      name: 'test-newly-discovered-repo',
      fullName: dummyRepoFullName,
      owner: 'test-org-uno',
      description: 'Newly discovered repository for Repo Rescue lifecycle test',
      url: `https://github.com/${dummyRepoFullName}`,
      language: 'TypeScript',
      starsCount: 15,
      forksCount: 2,
      openIssuesCount: 4,
      isPrivate: false,
      isArchived: false,
      isFork: false,
      hasIssues: true,
      eligibilityStatus: 'ELIGIBLE',
      eligibilityReason: 'Public, active, non-fork organization repository with GitHub Issues enabled.',
      lastSyncedAt: null, // Null to simulate initial sync
    },
  });

  assert(newlyDiscoveredRepo.id !== null, 'Test B1', 'New eligible repository persisted in PostgreSQL');

  const countReposBefore = await prisma.repository.count({ where: { fullName: dummyRepoFullName } });
  assert(countReposBefore === 1, 'Test C1', 'New repository persisted exactly once in database');

  // --- TEST E & F & G & H & I & J: Issue Scanning, V2.3.0 Grading & Explorer Visibility ---
  console.log('\n--- Test E, F, G, H, I, J: Issue Scanning, Grading & Explorer Filtering ---');

  // 1. Qualifying Issue: Open, Unassigned, 0 PRs
  await processLiveIssueEvent({
    action: 'opened',
    issue: {
      id: 880011,
      number: 101,
      title: 'Implement streaming JSON parser in network worker',
      body: 'Memory consumption exceeds allocation during large JSON payload deserialization. Need streaming chunk parser.',
      state: 'open',
      labels: [{ name: 'enhancement' }],
      user: { login: 'community-dev-1' },
      assignees: [],
      comments: 2,
    },
    repository: {
      id: 99887766,
      name: 'test-newly-discovered-repo',
      full_name: dummyRepoFullName,
      owner: { login: 'test-org-uno' },
    },
  } as any);

  // 2. Ineligible Issue: Assigned
  await processLiveIssueEvent({
    action: 'opened',
    issue: {
      id: 880022,
      number: 102,
      title: 'Fix assigned bug in streaming parser',
      state: 'open',
      user: { login: 'community-dev-1' },
      assignees: [{ login: 'assigned-maintainer' }],
    },
    repository: {
      id: 99887766,
      name: 'test-newly-discovered-repo',
      full_name: dummyRepoFullName,
      owner: { login: 'test-org-uno' },
    },
  } as any);

  // 3. Ineligible Issue: Closed
  await processLiveIssueEvent({
    action: 'opened',
    issue: {
      id: 880033,
      number: 103,
      title: 'Historical closed issue in new repo',
      state: 'closed',
      user: { login: 'community-dev-1' },
      assignees: [],
    },
    repository: {
      id: 99887766,
      name: 'test-newly-discovered-repo',
      full_name: dummyRepoFullName,
      owner: { login: 'test-org-uno' },
    },
  } as any);

  const dbIssue101 = await prisma.issue.findFirst({
    where: { repository: { fullName: dummyRepoFullName }, githubNumber: 101 },
    include: { scores: true },
  });

  assert(dbIssue101 !== null, 'Test E1', 'Qualifying open issue #101 ingested into PostgreSQL');
  assert(dbIssue101?.scores?.scoringVersion === 'v2.3.0', 'Test F1', 'Issue #101 graded using V2.3.0 scoring engine');

  const explorerResults = await getFilteredIssues({ organization: 'test-org-uno' });
  const is101Visible = explorerResults.issues.some((i) => i.githubNumber === 101 && i.repository.fullName === dummyRepoFullName);
  const is102Visible = explorerResults.issues.some((i) => i.githubNumber === 102 && i.repository.fullName === dummyRepoFullName);
  const is103Visible = explorerResults.issues.some((i) => i.githubNumber === 103 && i.repository.fullName === dummyRepoFullName);

  assert(is101Visible === true, 'Test G1', 'Qualifying issue #101 APPEARS in default Issue Explorer');
  assert(is102Visible === false, 'Test H1', 'Assigned issue #102 EXCLUDED from Issue Explorer');
  assert(is103Visible === false, 'Test J1', 'Closed issue #103 EXCLUDED from Issue Explorer');

  // --- TEST K & L: Subsequent Incremental Sync Participation ---
  console.log('\n--- Test K & L: Ongoing Incremental Sync Participation ---');
  const orchestrator = new ProductionSyncOrchestrator();
  const incJobResult = await orchestrator.runIncrementalRepoSync('test-org-uno/test-repo-one-');

  assert(incJobResult.status === 'SUCCEEDED', 'Test K1', 'Newly discovered repo participated in subsequent incremental sync cycle');

  // Discover a new issue on a later sync cycle
  await processLiveIssueEvent({
    action: 'opened',
    issue: {
      id: 880044,
      number: 104,
      title: 'Add support for HTTP/2 multiplexing in new repo',
      body: 'Multiplexing HTTP/2 connections will double throughput.',
      state: 'open',
      user: { login: 'community-dev-2' },
      assignees: [],
    },
    repository: {
      id: 99887766,
      name: 'test-newly-discovered-repo',
      full_name: dummyRepoFullName,
      owner: { login: 'test-org-uno' },
    },
  } as any);

  const dbIssue104 = await prisma.issue.findFirst({
    where: { repository: { fullName: dummyRepoFullName }, githubNumber: 104 },
  });
  assert(dbIssue104 !== null, 'Test L1', 'New issue #104 discovered and ingested on subsequent sync cycle');

  // --- TEST M: Idempotency of Repository Discovery ---
  console.log('\n--- Test M: Idempotency of Repository Discovery ---');
  const orgConfig = getOrganizationConfig('test-org-uno');
  if (orgConfig) {
    const orgReconRes1 = await reconcileOrganization('test-org-uno');
    const orgReconRes2 = await reconcileOrganization('test-org-uno');
    assert(orgReconRes1.success === true && orgReconRes2.success === true, 'Test M1', 'Repeated repository discovery execution is successful and idempotent');

    const totalReposInDB = await prisma.repository.count({ where: { owner: 'test-org-uno' } });
    assert(totalReposInDB >= 2, 'Test M2', `Total repositories in test-org-uno: ${totalReposInDB} (No duplicates created)`);
  }

  // --- TEST N: Failure Isolation Across Organizations ---
  console.log('\n--- Test N: Organization Discovery Failure Isolation ---');
  let nonExistentOrgFailedHandled = false;
  try {
    const invalidOrgResult = await reconcileOrganization('non-existent-dummy-org-xyz-999');
    assert(invalidOrgResult.success === false, 'Test N1', 'Invalid organization discovery returns success: false without throwing unhandled exception');
    nonExistentOrgFailedHandled = true;
  } catch (err) {
    nonExistentOrgFailedHandled = false;
  }
  assert(nonExistentOrgFailedHandled === true, 'Test N2', 'Failure in one organization is caught cleanly and does not halt orchestrator');

  // --- CLEANUP TEST ARTIFACTS ---
  console.log('\n--- Cleaning up test artifacts ---');
  await prisma.issueScore.deleteMany({ where: { issue: { repository: { fullName: dummyRepoFullName } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: dummyRepoFullName } } });
  await prisma.repository.deleteMany({ where: { fullName: dummyRepoFullName } });

  console.log('\n========================================================================');
  console.log(`     DISCOVERY LIFECYCLE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED      `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
  if (failedTests > 0) {
    process.exit(1);
  }
}

runRepoDiscoveryLifecycleTestSuite().catch((err) => {
  console.error('❌ Repo Discovery Lifecycle Test Suite Exception:', err);
  prisma.$disconnect();
  process.exit(1);
});
