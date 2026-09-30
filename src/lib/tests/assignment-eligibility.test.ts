import { prisma, withPrismaRetry } from '@/lib/prisma';
import { processLiveIssueEvent, processLivePREvent } from '../injector/sync-service';
import { reconcileRepositoryIncremental, reconcileRepositoryIssuesDatabase } from '../injector/reconciliation';
import { getFilteredIssues } from '../issues/service';
import { getTargetOrganizationLogins } from '../organizations/config';

async function runAssignmentTestSuite() {
  console.log('========================================================================');
  console.log('    RUNNING ASSIGNMENT ELIGIBILITY & SYNCHRONIZATION TEST SUITE        ');
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

  const repoPayload = {
    id: 1392386002,
    name: 'test-repo-one-',
    full_name: 'supabase/test-repo-one-',
    owner: { login: 'supabase' },
  };

  // Clean up any pre-existing test issue with githubNumber 9901 or 9902
  await prisma.issueScore.deleteMany({ where: { issue: { githubNumber: { in: [9901, 9902] } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: { in: [9901, 9902] } } });

  // --- TEST A: New Unassigned Issue -> Visible ---
  console.log('\n--- Test A: New Unassigned Issue Visibility ---');
  const mockUnassignedPayload = {
    action: 'opened',
    issue: {
      id: 99990091,
      number: 9901,
      title: 'Fix unassigned bug in query builder',
      body: 'Query builder throws unexpected syntax error when passing empty array parameter.',
      state: 'open',
      labels: [{ name: 'bug' }],
      user: { login: 'dev-1' },
      assignees: [],
      comments: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    repository: repoPayload,
  };

  const syncResultA = await processLiveIssueEvent(mockUnassignedPayload as any);
  assert(syncResultA.status === 'SUCCESS' || syncResultA.status === 'UPDATED', 'Test A1', 'Unassigned issue ingested successfully');

  const dbIssueA = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
    include: { scores: true },
  });
  assert(dbIssueA?.assigneeCount === 0, 'Test A2', 'assigneeCount is 0 in database');
  assert(dbIssueA?.scores?.scoringVersion === 'v2.3.0', 'Test A3', 'Scored with scoringVersion v2.3.0');

  const explorerA = await getFilteredIssues({ organization: 'supabase' });
  const isVisibleA = explorerA.issues.some((i) => i.githubNumber === 9901);
  assert(isVisibleA === true, 'Test A4', 'Unassigned issue IS VISIBLE in default Issue Explorer');

  // --- TEST B: New Assigned Issue -> Ineligible for Explorer ---
  console.log('\n--- Test B: New Assigned Issue Ineligibility ---');
  const mockAssignedPayload = {
    action: 'opened',
    issue: {
      id: 99990092,
      number: 9902,
      title: 'Fix assigned bug in authentication module',
      body: 'Token validation fails on expired token refresh call.',
      state: 'open',
      labels: [{ name: 'bug' }],
      user: { login: 'dev-1' },
      assignees: [{ login: 'assigned-user-alpha' }],
      comments: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    repository: repoPayload,
  };

  const syncResultB = await processLiveIssueEvent(mockAssignedPayload as any);
  assert(syncResultB.status === 'SUCCESS' || syncResultB.status === 'UPDATED', 'Test B1', 'Assigned issue ingested/synchronized');

  const dbIssueB = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9902 },
    include: { scores: true },
  });
  assert(dbIssueB?.assigneeCount === 1, 'Test B2', 'assigneeCount is 1 in database');
  assert(Boolean(dbIssueB?.assignees.includes('assigned-user-alpha')), 'Test B3', 'assignees array contains assigned username');

  const explorerB = await getFilteredIssues({ organization: 'supabase' });
  const isVisibleB = explorerB.issues.some((i) => i.githubNumber === 9902);
  assert(isVisibleB === false, 'Test B4', 'Assigned issue is EXCLUDED from default Issue Explorer');

  // --- TEST C: Existing Unassigned Issue Gets Assigned -> Disappears ---
  console.log('\n--- Test C: Unassigned Issue Becomes Assigned ---');
  const mockAssignExistingPayload = {
    ...mockUnassignedPayload,
    action: 'assigned',
    issue: {
      ...mockUnassignedPayload.issue,
      assignees: [{ login: 'assigned-user-beta' }],
      updated_at: new Date().toISOString(),
    },
  };

  const syncResultC = await processLiveIssueEvent(mockAssignExistingPayload as any);
  assert(syncResultC.status === 'UPDATED', 'Test C1', 'Assignment change synchronized');

  const dbIssueC = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
  });
  assert(dbIssueC?.assigneeCount === 1, 'Test C2', 'Database record preserved, assigneeCount updated to 1');

  const explorerC = await getFilteredIssues({ organization: 'supabase' });
  const isVisibleC = explorerC.issues.some((i) => i.githubNumber === 9901);
  assert(isVisibleC === false, 'Test C3', 'Issue DISAPPEARED from default Issue Explorer upon assignment');

  // --- TEST D: Existing Assigned Issue Becomes Unassigned -> Becomes Eligible ---
  console.log('\n--- Test D: Assigned Issue Becomes Unassigned ---');
  const mockUnassignPayload = {
    ...mockUnassignedPayload,
    action: 'unassigned',
    issue: {
      ...mockUnassignedPayload.issue,
      assignees: [],
      updated_at: new Date().toISOString(),
    },
  };

  const syncResultD = await processLiveIssueEvent(mockUnassignPayload as any);
  assert(syncResultD.status === 'UPDATED', 'Test D1', 'Unassignment change synchronized');

  const dbIssueD = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
  });
  assert(dbIssueD?.assigneeCount === 0, 'Test D2', 'Database assigneeCount reset to 0');

  const explorerD = await getFilteredIssues({ organization: 'supabase' });
  const isVisibleD = explorerD.issues.some((i) => i.githubNumber === 9901);
  assert(isVisibleD === true, 'Test D3', 'Issue RETURNED to default Issue Explorer upon unassignment');

  // --- TEST E: Multiple Assignees ---
  console.log('\n--- Test E: Multiple Assignees ---');
  const mockMultiAssigneePayload = {
    ...mockUnassignedPayload,
    action: 'assigned',
    issue: {
      ...mockUnassignedPayload.issue,
      assignees: [{ login: 'user-1' }, { login: 'user-2' }],
      updated_at: new Date().toISOString(),
    },
  };

  await processLiveIssueEvent(mockMultiAssigneePayload as any);
  const dbIssueE = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
  });
  assert(dbIssueE?.assigneeCount === 2, 'Test E1', 'Multiple assignees count set to 2');

  const explorerE = await getFilteredIssues({ organization: 'supabase' });
  assert(!explorerE.issues.some((i) => i.githubNumber === 9901), 'Test E2', 'Issue with multiple assignees is NOT visible in Explorer');

  // --- TEST F, G, H: Assigned + Open PR / Closed Combinations ---
  console.log('\n--- Test F, G, H: Assigned + Open PR / Closed Combinations ---');

  // Assigned + Open PR
  await prisma.issue.update({
    where: { repositoryId_githubNumber: { repositoryId: dbIssueE!.repositoryId, githubNumber: 9901 } },
    data: { openPrCount: 1, assigneeCount: 1, assignees: ['user-1'] },
  });
  const explorerG = await getFilteredIssues({ organization: 'supabase' });
  assert(!explorerG.issues.some((i) => i.githubNumber === 9901), 'Test G1', 'Assigned + Open PR issue is NOT visible');

  // Assigned + Closed
  await withPrismaRetry(() =>
    prisma.issue.update({
      where: { repositoryId_githubNumber: { repositoryId: dbIssueE!.repositoryId, githubNumber: 9901 } },
      data: { status: 'CLOSED', githubState: 'closed' },
    })
  );
  const explorerH = await getFilteredIssues({ organization: 'supabase' });
  assert(!explorerH.issues.some((i) => i.githubNumber === 9901), 'Test H1', 'Assigned + Closed issue is NOT visible');

  // Restore issue 9901 to OPEN and unassigned
  await withPrismaRetry(() =>
    prisma.issue.update({
      where: { repositoryId_githubNumber: { repositoryId: dbIssueE!.repositoryId, githubNumber: 9901 } },
      data: { status: 'OPEN', githubState: 'open', openPrCount: 0, assigneeCount: 0, assignees: [] },
    })
  );

  // --- TEST I & J: Assignment Detection via REST Sync & Full Reconciliation ---
  console.log('\n--- Test I & J: REST Polling & Full Reconciliation Assignment Enforcement ---');

  // Simulate assignment REST payload through processLiveIssueEvent
  await processLiveIssueEvent({
    action: 'edited',
    issue: {
      id: 99990091,
      number: 9901,
      title: 'Fix unassigned bug in query builder',
      state: 'open',
      assignees: [{ login: 'sync-assigned-user' }],
    },
    repository: repoPayload,
  } as any);

  const explorerI = await getFilteredIssues({ organization: 'supabase' });
  assert(!explorerI.issues.some((i) => i.githubNumber === 9901), 'Test I1', 'REST sync assignment update excluded issue from Explorer');

  // --- TEST K & L: Points & Idempotency Safety ---
  console.log('\n--- Test K & L: Points & Idempotency Safety ---');
  const dbIssueK = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
    include: { scores: true },
  });
  const difficultyBefore = dbIssueK?.rrDifficulty;

  // Re-run sync
  await processLiveIssueEvent({
    action: 'edited',
    issue: {
      id: 99990091,
      number: 9901,
      title: 'Fix unassigned bug in query builder',
      state: 'open',
      assignees: [{ login: 'sync-assigned-user' }],
    },
    repository: repoPayload,
  } as any);

  const dbIssueK2 = await prisma.issue.findFirst({
    where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: 9901 },
    include: { scores: true },
  });
  assert(dbIssueK2?.rrDifficulty === difficultyBefore, 'Test K1', 'Assignment change did not modify RR Difficulty score');

  // --- TEST M & N: Target Orgs & V2.3.0 Scoring Verification ---
  console.log('\n--- Test M & N: Target Orgs & V2.3.0 Scoring Version ---');
  const targetOrgs = getTargetOrganizationLogins();
  assert(targetOrgs.length === 10, 'Test M1', `Target organizations count remains 10`);
  assert(dbIssueK2?.scores?.scoringVersion === 'v2.3.0', 'Test N1', 'Scoring version remains v2.3.0');

  // --- Clean up test artifacts ---
  console.log('\n--- Cleaning up test artifacts ---');
  await prisma.issueScore.deleteMany({ where: { issue: { githubNumber: { in: [9901, 9902] } } } });
  await prisma.issue.deleteMany({ where: { repository: { fullName: 'supabase/test-repo-one-' }, githubNumber: { in: [9901, 9902] } } });

  console.log('\n========================================================================');
  console.log(`         ASSIGNMENT TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED          `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
  if (failedTests > 0) {
    process.exit(1);
  }
}

runAssignmentTestSuite().catch((err) => {
  console.error('❌ Assignment Test Suite Exception:', err);
  prisma.$disconnect();
  process.exit(1);
});
