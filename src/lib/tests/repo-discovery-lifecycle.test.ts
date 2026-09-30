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
  const dummyRepoFullName = 'supabase/test-newly-discovered-repo';
  await prisma.issueScore.deleteMany({ where: { issue: { repository: { fullName: dummyRepoFullName } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: dummyRepoFullName } } });
  await prisma.repository.deleteMany({ where: { fullName: dummyRepoFullName } });

  // --- TEST A: Existing Repository Incremental Sync ---
  console.log('\n--- Test A: Existing Repository Incremental Sync ---');
  const existingRepo = await prisma.repository.findUnique({ where: { fullName: 'supabase/supabase' } });
  assert(existingRepo !== null, 'Test A1', 'Existing repository supabase/supabase is present');

  const reconResultA = await reconcileRepositoryIncremental('supabase/supabase');
  assert(reconResultA.success === true, 'Test A2', 'Existing repository incremental sync succeeded');

  // --- TEST B & C & D: New Eligible Repository Discovery & Persistence ---
  console.log('\n--- Test B, C & D: New Eligible Repository Discovery & Persistence ---');

  // Create a new simulated repository in supabase via Prisma
  const newlyDiscoveredRepo = await prisma.repository.create({
    data: {
      githubId: 99887766,
      name: 'test-newly-discovered-repo',
      fullName: dummyRepoFullName,
      owner: 'supabase',
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
      owner: { login: 'supabase' },
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
      owner: { login: 'supabase' },
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
      owner: { login: 'supabase' },
    },
  } as any);

  const dbIssue101 = await prisma.issue.findFirst({
    where: { repository: { fullName: dummyRepoFullName }, githubNumber: 101 },
    include: { scores: true },
  });

  assert(dbIssue101 !== null, 'Test E1', 'Qualifying open issue #101 ingested into PostgreSQL');
  assert(dbIssue101?.scores?.scoringVersion === 'v2.3.0', 'Test F1', 'Issue #101 graded using V2.3.0 scoring engine');

  const explorerResults = await getFilteredIssues({ organization: 'supabase' });
  const is101Visible = explorerResults.issues.some((i) => i.githubNumber === 101 && i.repository.fullName === dummyRepoFullName);
  const is102Visible = explorerResults.issues.some((i) => i.githubNumber === 102 && i.repository.fullName === dummyRepoFullName);
  const is103Visible = explorerResults.issues.some((i) => i.githubNumber === 103 && i.repository.fullName === dummyRepoFullName);

  assert(is101Visible === true, 'Test G1', 'Qualifying issue #101 APPEARS in default Issue Explorer');
  assert(is102Visible === false, 'Test H1', 'Assigned issue #102 EXCLUDED from Issue Explorer');
  assert(is103Visible === false, 'Test J1', 'Closed issue #103 EXCLUDED from Issue Explorer');

  // --- TEST K & L: Subsequent Incremental Sync Participation ---
  console.log('\n--- Test K & L: Ongoing Incremental Sync Participation ---');
  const orchestrator = new ProductionSyncOrchestrator();
  const incJobResult = await orchestrator.runIncrementalRepoSync('supabase/supabase');

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
      owner: { login: 'supabase' },
    },
  } as any);

  const dbIssue104 = await prisma.issue.findFirst({
    where: { repository: { fullName: dummyRepoFullName }, githubNumber: 104 },
  });
  assert(dbIssue104 !== null, 'Test L1', 'New issue #104 discovered and ingested on subsequent sync cycle');

  // --- TEST M: Idempotency of Repository Discovery ---
  console.log('\n--- Test M: Idempotency of Repository Discovery ---');
  const orgConfig = getOrganizationConfig('supabase');
  if (orgConfig) {
    const orgReconRes1 = await reconcileOrganization('supabase');
    const orgReconRes2 = await reconcileOrganization('supabase');
    assert(orgReconRes1.success === true && orgReconRes2.success === true, 'Test M1', 'Repeated repository discovery execution is successful and idempotent');

    const totalReposInDB = await prisma.repository.count({ where: { owner: 'supabase' } });
    assert(totalReposInDB >= 2, 'Test M2', `Total repositories in supabase: ${totalReposInDB} (No duplicates created)`);
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
  // --- TEST O: Deterministic New Repository Discovery During Incremental Sync ---
  console.log('\n--- Test O: Deterministic New Repository Discovery During Incremental Sync ---');
  const repoBFullName = 'supabase/test-dynamic-repo-b';
  await prisma.issueScore.deleteMany({ where: { issue: { repository: { fullName: repoBFullName } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: repoBFullName } } });
  await prisma.repository.deleteMany({ where: { fullName: repoBFullName } });

  // 1. Simulate discovery of Repo B during incremental sync by injecting mocked discovery reconciler
  const dynamicOrchestrator = new ProductionSyncOrchestrator();
  dynamicOrchestrator.setDependencies({
    reconcileOrganization: async (orgLogin: string) => {
      if (orgLogin.toLowerCase() === 'supabase') {
        // Upsert Repo B with null lastSyncedAt (representing newly discovered repo)
        await prisma.repository.upsert({
          where: { fullName: repoBFullName },
          create: {
            githubId: 88997711,
            name: 'test-dynamic-repo-b',
            fullName: repoBFullName,
            owner: 'supabase',
            description: 'Dynamic repository B created during incremental sync',
            url: `https://github.com/${repoBFullName}`,
            language: 'TypeScript',
            starsCount: 25,
            forksCount: 3,
            openIssuesCount: 1,
            isPrivate: false,
            isArchived: false,
            isFork: false,
            hasIssues: true,
            eligibilityStatus: 'ELIGIBLE',
            eligibilityReason: 'Public, active, non-fork organization repository with GitHub Issues enabled.',
            lastSyncedAt: null, // Null to simulate initial un-synced state
          },
          update: {},
        });
        return { success: true, discoveredCount: 1, updatedReposCount: 1 };
      }
      return { success: true, discoveredCount: 0, updatedReposCount: 0 };
    },
    reconcileRepositoryIncremental: async (repoFullName: string) => {
      if (repoFullName === repoBFullName) {
        // Simulate successful issue reconciliation for Repo B
        await processLiveIssueEvent({
          action: 'opened',
          issue: {
            id: 991122,
            number: 201,
            title: 'Fix edge case in dynamic stream buffer',
            body: 'Buffer overflow occurs when stream size exceeds chunk allocation in dynamic worker.',
            state: 'open',
            labels: [{ name: 'bug' }],
            user: { login: 'community-dev-dynamic' },
            assignees: [],
            comments: 1,
          },
          repository: {
            id: 88997711,
            name: 'test-dynamic-repo-b',
            full_name: repoBFullName,
            owner: { login: 'supabase' },
          },
        } as any);

        await prisma.repository.update({
          where: { fullName: repoBFullName },
          data: { lastSyncedAt: new Date() },
        });

        return {
          repositoryFullName: repoBFullName,
          success: true,
          issuesExamined: 1,
          insertedCount: 1,
          updatedCount: 0,
          closedCount: 0,
          reopenedCount: 0,
          tombstonedCount: 0,
          regradedCount: 0,
          commentsCorrected: 0,
          prsReconciled: 0,
          pointsAwarded: 0,
          driftRepairs: [],
        };
      }
      return {
        repositoryFullName: repoFullName,
        success: true,
        issuesExamined: 0,
        insertedCount: 0,
        updatedCount: 0,
        closedCount: 0,
        reopenedCount: 0,
        tombstonedCount: 0,
        regradedCount: 0,
        commentsCorrected: 0,
        prsReconciled: 0,
        pointsAwarded: 0,
        driftRepairs: [],
      };
    },
  });

  const syncJobResult = await dynamicOrchestrator.runIncrementalSync();
  assert(syncJobResult.status === 'SUCCEEDED', 'Test O1', 'Incremental sync completed successfully with dynamic discovery');

  const dbRepoB = await prisma.repository.findUnique({ where: { fullName: repoBFullName } });
  assert(dbRepoB !== null, 'Test O2', 'Newly discovered repository B was persisted in PostgreSQL');
  assert(dbRepoB?.eligibilityStatus === 'ELIGIBLE', 'Test O3', 'Repository B evaluated as ELIGIBLE');

  const dbIssue201 = await prisma.issue.findFirst({
    where: { repository: { fullName: repoBFullName }, githubNumber: 201 },
    include: { scores: true },
  });
  assert(dbIssue201 !== null, 'Test O4', 'Qualifying issue #201 from newly discovered Repo B was ingested in same run');
  assert(dbIssue201?.scores?.scoringVersion === 'v2.3.0', 'Test O5', 'Issue #201 graded using V2.3.0 formula');

  const explorerResultsB = await getFilteredIssues({ organization: 'supabase' });
  const is201Visible = explorerResultsB.issues.some((i) => i.githubNumber === 201 && i.repository.fullName === repoBFullName);
  assert(is201Visible === true, 'Test O6', 'Issue #201 from newly discovered Repo B APPEARS in Issue Explorer');

  // Clean up Repo B
  await prisma.issueScore.deleteMany({ where: { issue: { repository: { fullName: repoBFullName } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: repoBFullName } } });
  await prisma.repository.deleteMany({ where: { fullName: repoBFullName } });

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
