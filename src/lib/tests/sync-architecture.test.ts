import { prisma } from '@/lib/prisma';
import { getOrganizationConfig, getTargetOrganizationLogins } from '../organizations/config';
import { processLiveIssueEvent, processLivePREvent, processLiveCommentEvent } from '../injector/sync-service';
import { reconcileRepositoryIncremental, reconcileRepositoryIssuesDatabase } from '../injector/reconciliation';
import { ProductionSyncOrchestrator } from '../injector/orchestrator';
import { getFilteredIssues, getIssueById } from '../issues/service';
import { evaluateV2FactorsWithEvidence } from '../issues/ingestion';
import { verifyAndAwardContribution } from '../contributions/verify';
import { validateCronAuth } from '../auth/cron-auth';


async function runTestSuite() {
  console.log('========================================================================');
  console.log('       RUNNING GITHUB REST SYNCHRONIZATION ARCHITECTURE TEST SUITE      ');
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

  // --- TEST A: New Issue Discovery ---
  console.log('\n--- Test A: New Issue Discovery & V2.3.0 Grading ---');
  const mockNewIssuePayload = {
    action: 'opened',
    issue: {
      id: 99990001,
      number: 9001,
      title: 'Fix critical memory leak in connection pool',
      body: 'Memory usage increases linearly under high concurrent query load. Need to add proper resource cleanup in connection release handler.',
      state: 'open',
      labels: [{ name: 'bug' }, { name: 'performance' }],
      user: { login: 'test-contributor-dev' },
      comments: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    repository: {
      id: 1392386002,
      name: 'test-repo-one-',
      full_name: 'supabase/test-repo-one-',
      owner: { login: 'supabase' },
    },
  };

  const syncResultA = await processLiveIssueEvent(mockNewIssuePayload as any);
  assert(syncResultA.status === 'SUCCESS' || syncResultA.status === 'UPDATED', 'Test A1', 'Issue ingestion succeeded');
  assert(syncResultA.gradingRan === true, 'Test A2', 'V2.3.0 grading ran for new issue');
  assert(typeof syncResultA.gradingScore === 'number' && syncResultA.gradingScore > 0, 'Test A3', `RR Difficulty calculated: ${syncResultA.gradingScore}`);

  const dbIssueA = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
    include: { scores: true },
  });
  assert(dbIssueA !== null, 'Test A4', 'Issue record persisted in PostgreSQL');
  assert(dbIssueA?.scores?.scoringVersion === 'v2.3.0', 'Test A5', 'scoringVersion is v2.3.0');

  // --- TEST B: Updated Issue Synchronization & Regrading ---
  console.log('\n--- Test B: Updated Issue Content Synchronization ---');
  const mockUpdatePayload = {
    ...mockNewIssuePayload,
    action: 'edited',
    issue: {
      ...mockNewIssuePayload.issue,
      title: 'Fix critical memory leak and buffer overflow in connection pool engine',
      body: 'Detailed rewrite required with cryptography and lock-free thread safe queue implementation.',
      labels: [{ name: 'bug' }, { name: 'security' }, { name: 'performance' }],
      updated_at: new Date().toISOString(),
    },
  };

  const syncResultB = await processLiveIssueEvent(mockUpdatePayload as any);
  assert(syncResultB.status === 'UPDATED', 'Test B1', 'Issue content update processed');
  assert(syncResultB.gradingRan === true, 'Test B2', 'Material content change triggered V2.3.0 regrading');

  // --- TEST C: Comment Count Synchronization ---
  console.log('\n--- Test C: Comment Count Synchronization ---');
  const mockCommentPayload = {
    action: 'created',
    issue: { id: 99990001, number: 9001, comments: 5 },
    comment: { id: 70001, body: 'I can reproduce this issue on Node v20.', user: { login: 'tester-1' } },
    repository: mockNewIssuePayload.repository,
  };

  const syncResultC = await processLiveCommentEvent(mockCommentPayload as any);
  assert(syncResultC.status === 'UPDATED', 'Test C1', 'Comment count update processed');

  const dbIssueC = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
  });
  assert(dbIssueC?.commentsCount === 5, 'Test C2', `commentsCount updated to ${dbIssueC?.commentsCount}`);

  // --- TEST D: PR Opened against Issue ---
  console.log('\n--- Test D: PR Opened & Issue Feed Classification ---');
  const mockPROpenPayload = {
    action: 'opened',
    number: 501,
    pull_request: {
      id: 88880001,
      number: 501,
      title: 'Fixes #9001 connection pool memory leak',
      body: 'Closes #9001 by implementing resource cleanup on release.',
      merged: false,
      user: { id: 12345, login: 'test-contributor-dev' },
      base: { repo: mockNewIssuePayload.repository },
    },
  };

  const syncResultD = await processLivePREvent(mockPROpenPayload as any);
  assert(syncResultD.syncStatus === 'SUCCESS', 'Test D1', 'PR open sync succeeded');

  const dbIssueD = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
  });
  assert(dbIssueD?.openPrCount === 1, 'Test D2', 'Issue openPrCount updated to 1');

  const explorerFeed = await getFilteredIssues({ organization: 'supabase', prActivity: 'OPEN_NO_PR' });
  const inDefaultFeed = explorerFeed.issues.some((i) => i.githubNumber === 9001);
  assert(!inDefaultFeed, 'Test D3', 'Issue with open PR excluded from default OPEN_NO_PR Explorer feed');

  // --- TEST E & W: PR Merged & Point Awarding Idempotency ---
  console.log('\n--- Test E & W: PR Merged & Anti-Cheating Verification ---');

  // First create user in DB
  const testUser = await prisma.user.upsert({
    where: { githubUsername: 'test-contributor-dev' },
    create: { githubUsername: 'test-contributor-dev', name: 'Test Contributor', totalPoints: 0 },
    update: {},
  });

  const mockPRMergedPayload = {
    action: 'closed',
    number: 501,
    pull_request: {
      id: 88880001,
      number: 501,
      title: 'Fixes #9001 connection pool memory leak',
      body: 'Closes #9001 by implementing resource cleanup on release.',
      merged: true,
      merged_at: new Date().toISOString(),
      merged_by: { login: 'maintainer-admin' },
      user: { id: 12345, login: 'test-contributor-dev' },
      base: { repo: mockNewIssuePayload.repository },
    },
  };

  const syncResultE1 = await processLivePREvent(mockPRMergedPayload as any);
  assert(syncResultE1.status === 'VERIFIED', 'Test E1', `Contribution verified: points awarded ${syncResultE1.pointsAwarded}`);

  // Re-run same merged PR to verify idempotency (No duplicate points)
  const syncResultE2 = await processLivePREvent(mockPRMergedPayload as any);
  assert(syncResultE2.status === 'ALREADY_PROCESSED' || syncResultE2.pointsAwarded === 0, 'Test E2', 'Repeated merged PR sync awarded 0 points (Idempotent)');

  // --- TEST F: Issue Closed ---
  console.log('\n--- Test F: Issue Closure ---');
  const mockClosePayload = {
    ...mockNewIssuePayload,
    action: 'closed',
    issue: {
      ...mockNewIssuePayload.issue,
      state: 'closed',
      closed_at: new Date().toISOString(),
    },
  };

  const syncResultF = await processLiveIssueEvent(mockClosePayload as any);
  assert(syncResultF.status === 'UPDATED', 'Test F1', 'Issue close event processed');

  const dbIssueF = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
  });
  assert(dbIssueF?.status === 'CLOSED', 'Test F2', 'Database issue status set to CLOSED');

  // --- TEST G: Issue Reopened ---
  console.log('\n--- Test G: Issue Reopening & V2.3.0 Regrading ---');
  const mockReopenPayload = {
    ...mockNewIssuePayload,
    action: 'reopened',
    issue: {
      ...mockNewIssuePayload.issue,
      state: 'open',
      closed_at: null,
    },
  };

  const syncResultG = await processLiveIssueEvent(mockReopenPayload as any);
  assert(syncResultG.status === 'UPDATED', 'Test G1', 'Issue reopen event processed');
  assert(syncResultG.gradingRan === true, 'Test G2', 'Reopened issue triggered V2.3.0 regrading');

  const dbIssueG = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
  });
  assert(dbIssueG?.status === 'OPEN', 'Test G3', 'Database issue status restored to OPEN');

  // --- TEST H: Tombstone / Deleted Issue Handling ---
  console.log('\n--- Test H: Deleted Issue Tombstoning ---');
  const mockDeletePayload = {
    ...mockNewIssuePayload,
    action: 'deleted',
    issue: {
      ...mockNewIssuePayload.issue,
      state: 'closed',
    },
  };

  const syncResultH = await processLiveIssueEvent(mockDeletePayload as any);
  assert(syncResultH.status === 'UPDATED', 'Test H1', 'Issue deletion processed');

  const dbIssueH = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 },
  });
  assert(dbIssueH?.status === 'CLOSED', 'Test H2', 'Deleted issue durable tombstone applied');

  // --- TEST I & N: Idempotency Verification ---
  console.log('\n--- Test I & N: Repeated Sync Idempotency ---');
  const syncResultI1 = await processLiveIssueEvent(mockNewIssuePayload as any);
  const syncResultI2 = await processLiveIssueEvent(mockNewIssuePayload as any);
  assert(syncResultI1.status === syncResultI2.status, 'Test I1', 'Repeated issue event execution produces identical result status');

  // --- TEST O: Multi-Organization Configuration Verification ---
  console.log('\n--- Test O: Multi-Organization Config Verification ---');
  const targetLogins = getTargetOrganizationLogins();
  assert(targetLogins.length === 10, 'Test O1', `All 10 target organizations configured (Count: ${targetLogins.length})`);
  assert(!targetLogins.includes('test-org-uno'), 'Test O2', "test-org-uno is NOT present in target organization list");

  // --- TEST Q & R & S: Sync Coordinator, Locking, and On-Demand Cooldown ---
  console.log('\n--- Test Q, R & S: Sync Coordinator & On-Demand Freshness ---');
  const testOrchestrator = new ProductionSyncOrchestrator();

  const acquired1 = testOrchestrator.acquireLock('supabase/test-repo-one-', 'job-1', 30000);
  assert(acquired1 === true, 'Test Q1', 'Lock acquired for supabase/test-repo-one-');

  const acquired2 = testOrchestrator.acquireLock('supabase/test-repo-one-', 'job-2', 30000);
  assert(acquired2 === false, 'Test R1', 'Prevented duplicate concurrent lock on same repository');

  testOrchestrator.releaseLock('supabase/test-repo-one-', 'job-1');

  // Update repo lastSyncedAt to current timestamp to verify cooldown
  await prisma.repository.update({
    where: { fullName: 'supabase/test-repo-one-' },
    data: { lastSyncedAt: new Date() },
  });

  const freshnessResult1 = await testOrchestrator.checkOnDemandFreshness('supabase/test-repo-one-', 120000);
  assert(freshnessResult1.triggered === false, 'Test S1', 'On-demand freshness check respected 2-minute cooldown window');

  // --- TEST T: External Scheduler Authorization ---
  console.log('\n--- Test T: External Scheduler Security & Authorization ---');
  process.env.SYNC_CRON_SECRET = 'test-sync-secret-12345';

  const validBearerReq = {
    headers: { get: (name: string) => name === 'authorization' ? 'Bearer test-sync-secret-12345' : null },
    url: 'https://repo-rescue.vercel.app/api/admin/sync?cron=true&mode=incremental',
  };
  const authBearerResult = validateCronAuth(validBearerReq as any);
  assert(authBearerResult.authorized === true, 'Test T1', 'Authorized scheduler request with Bearer token accepted');

  const validQueryReq = {
    headers: { get: () => null },
    url: 'https://repo-rescue.vercel.app/api/admin/sync?cron=true&mode=incremental&secret=test-sync-secret-12345',
  };
  const authQueryResult = validateCronAuth(validQueryReq as any);
  assert(authQueryResult.authorized === true, 'Test T2', 'Authorized scheduler request with query secret accepted');

  const validVercelReq = {
    headers: { get: (name: string) => name === 'x-vercel-cron' ? '1' : null },
    url: 'https://repo-rescue.vercel.app/api/admin/sync?cron=true&mode=full',
  };
  const authVercelResult = validateCronAuth(validVercelReq as any);
  assert(authVercelResult.authorized === true, 'Test T3', 'Vercel system cron request accepted');

  const invalidSecretReq = {
    headers: { get: (name: string) => name === 'authorization' ? 'Bearer wrong-secret' : null },
    url: 'https://repo-rescue.vercel.app/api/admin/sync?cron=true&mode=incremental',
  };
  const unauthResult = validateCronAuth(invalidSecretReq as any);
  assert(unauthResult.authorized === false, 'Test T4', 'Unauthorized scheduler request with wrong secret rejected');

  const unauthenticatedReq = {
    headers: { get: () => null },
    url: 'https://repo-rescue.vercel.app/api/admin/sync?cron=true&mode=incremental',
  };
  const unauthNoSecretResult = validateCronAuth(unauthenticatedReq as any);
  assert(unauthNoSecretResult.authorized === false, 'Test T5', 'Unauthenticated arbitrary internet request rejected');


  // Clean up test records created in DB
  console.log('\n--- Cleaning up test artifacts ---');
  await prisma.pullRequest.deleteMany({ where: { githubId: 88880001 } });
  await prisma.issueScore.deleteMany({ where: { issue: { githubNumber: 9001 } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9001 } });
  await prisma.user.deleteMany({ where: { githubUsername: 'test-contributor-dev' } });

  console.log('\n========================================================================');
  console.log(`                     TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED                      `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Test Suite Exception:', err);
  prisma.$disconnect();
  process.exit(1);
});
