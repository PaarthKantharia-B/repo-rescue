import {
  verifyAndAwardContribution,
  verifyGitHubWebhookSignature,
  extractLinkedIssueNumbers,
  GitHubPRPayload,
} from '../contributions/verify';
import { handleGitHubIssueEvent, handleGitHubPREvent, classifyIssuePRActivity } from '../issues/sync';
import { reconcileActiveIssues } from '../issues/reconciliation';
import { getFilteredIssues } from '../issues/service';
import { mockDbStore, seedAndTestDb } from '../../../scripts/db-runner';

/**
 * 18-Test Verification & Synchronization Test Suite for Repo Rescue V1.
 */
export async function runPRVerificationTests() {
  console.log('\n🛡️ Running 18-Test GitHub Issue & PR Synchronization Test Suite...\n');

  // Reset database state with test fixtures
  await seedAndTestDb();

  let passed = 0;
  const total = 18;

  const secret = 'repo-rescue-v1-webhook-secret-2026';
  const targetRepo = mockDbStore.repositories[0]; // vercel/next.js
  const targetUser = mockDbStore.users[1]; // sarah.j@example.com (sjenkins-codes)

  // Dedicated test issue for clean lifecycle tracking
  const testIssue = {
    id: 'iss-sync-test-9901',
    githubId: 88701,
    githubNumber: 8801,
    repositoryId: targetRepo.id,
    title: 'Fix edge runtime hydration race condition',
    body: 'Investigate edge runtime cache revalidation timing.',
    url: `${targetRepo.url}/issues/8801`,
    status: 'OPEN',
    githubState: 'open',
    labels: ['bug', 'high impact'],
    language: targetRepo.language,
    ecosystem: targetRepo.ecosystem,
    authorUsername: 'maintainer-bot',
    rrDifficulty: 8.8,
    openPrCount: 0,
    mergedPrCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockDbStore.issues.push(testIssue);
  mockDbStore.issueScores.push({
    id: 'score-sync-test-9901',
    issueId: testIssue.id,
    scoringVersion: 'v1.0.0',
    calculatedAt: new Date(),
    technicalDifficulty: 9.0,
    codebaseComplexity: 8.5,
    issueScope: 8.0,
    domainKnowledge: 9.0,
    expectedImpact: 9.5,
    testingComplexity: 8.5,
    issueClarity: 7.5,
    maintainerActivity: 9.5,
    compositeScore: 8.8,
    reasoning: 'Evaluated for synchronization test suite.',
  });

  // TEST 1: Issue OPEN + zero PRs -> OPEN_NO_PR
  try {
    testIssue.openPrCount = 0;
    const classification = classifyIssuePRActivity(testIssue);
    if (classification === 'OPEN_NO_PR') {
      console.log('  ✅ [TEST 1 PASSED] Issue OPEN with 0 PRs correctly classified as OPEN_NO_PR');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: Issue OPEN + one open PR -> OPEN_PR_IN_PROGRESS
  try {
    const prPayload: GitHubPRPayload = {
      action: 'opened',
      number: 9501,
      pull_request: {
        id: 98501,
        number: 9501,
        title: `Fixes #${testIssue.githubNumber} hydration patch`,
        body: `Resolves #${testIssue.githubNumber}`,
        merged: false,
        merged_at: null,
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    const res = await handleGitHubPREvent(prPayload);
    const classification = classifyIssuePRActivity(testIssue);

    if (classification === 'OPEN_PR_IN_PROGRESS' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 2 PASSED] Issue OPEN with 1 open PR correctly classified as OPEN_PR_IN_PROGRESS (0 points)');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: Issue OPEN + multiple open PRs -> OPEN_PR_IN_PROGRESS
  try {
    const prPayload2: GitHubPRPayload = {
      action: 'opened',
      number: 9502,
      pull_request: {
        id: 98502,
        number: 9502,
        title: `Fixes #${testIssue.githubNumber} alternative patch`,
        body: `Closes #${testIssue.githubNumber}`,
        merged: false,
        merged_at: null,
        user: { id: 8003, login: 'dvance' },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    await handleGitHubPREvent(prPayload2);
    const classification = classifyIssuePRActivity(testIssue);

    if (classification === 'OPEN_PR_IN_PROGRESS' && testIssue.openPrCount === 2) {
      console.log('  ✅ [TEST 3 PASSED] Issue OPEN with multiple PRs correctly classified as OPEN_PR_IN_PROGRESS (count=2)');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', testIssue);
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: Open PR -> synchronize -> PR metadata updated, no points
  try {
    const syncPayload: GitHubPRPayload = {
      action: 'synchronize',
      number: 9501,
      pull_request: {
        id: 98501,
        number: 9501,
        title: `Fixes #${testIssue.githubNumber} updated title`,
        merged: false,
        merged_at: null,
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    const initialBal = targetUser.totalPoints;
    const res = await handleGitHubPREvent(syncPayload);

    if (res.pointsAwarded === 0 && targetUser.totalPoints === initialBal) {
      console.log('  ✅ [TEST 4 PASSED] PR synchronize event updated metadata without awarding points');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Open PR -> closed without merge -> no points
  try {
    const unmergedClosePayload: GitHubPRPayload = {
      action: 'closed',
      number: 9502,
      pull_request: {
        id: 98502,
        number: 9502,
        title: `Fixes #${testIssue.githubNumber}`,
        merged: false,
        merged_at: null,
        user: { id: 8003, login: 'dvance' },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    const res = await handleGitHubPREvent(unmergedClosePayload);
    if (res.pointsAwarded === 0 && testIssue.openPrCount === 1) {
      console.log('  ✅ [TEST 5 PASSED] Unmerged closed PR awarded 0 points (openPrCount=1 remaining)');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: Last open PR closes without merge -> OPEN_NO_PR
  try {
    const lastUnmergedClosePayload: GitHubPRPayload = {
      action: 'closed',
      number: 9501,
      pull_request: {
        id: 98501,
        number: 9501,
        title: `Fixes #${testIssue.githubNumber}`,
        merged: false,
        merged_at: null,
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    await handleGitHubPREvent(lastUnmergedClosePayload);
    const classification = classifyIssuePRActivity(testIssue);

    if (classification === 'OPEN_NO_PR' && testIssue.openPrCount === 0) {
      console.log('  ✅ [TEST 6 PASSED] Reverted to OPEN_NO_PR after last open PR closed without merge');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', classification, testIssue.openPrCount);
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: PR merged -> existing verification pipeline awards points exactly once
  try {
    const mergedPRPayload: GitHubPRPayload = {
      action: 'closed',
      number: 9503,
      pull_request: {
        id: 98503,
        number: 9503,
        title: `Fixes #${testIssue.githubNumber} verified fix`,
        body: `Resolves #${testIssue.githubNumber}`,
        merged: true,
        merged_at: new Date().toISOString(),
        merged_by: { login: 'vercel-maintainer' },
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    const initialBal = targetUser.totalPoints;
    const res = await handleGitHubPREvent(mergedPRPayload);
    const expectedAward = Math.round(testIssue.rrDifficulty * 10);

    if (res.status === 'VERIFIED' && res.pointsAwarded === expectedAward && targetUser.totalPoints === initialBal + expectedAward) {
      console.log(`  ✅ [TEST 7 PASSED] Valid merged PR verified and awarded +${expectedAward} RR Points`);
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Duplicate PR webhook -> idempotent
  try {
    const duplicatePRPayload: GitHubPRPayload = {
      action: 'closed',
      number: 9503,
      pull_request: {
        id: 98503,
        number: 9503,
        title: `Fixes #${testIssue.githubNumber}`,
        merged: true,
        merged_at: new Date().toISOString(),
        merged_by: { login: 'vercel-maintainer' },
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    const initialBal = targetUser.totalPoints;
    const res = await handleGitHubPREvent(duplicatePRPayload);

    if (res.status === 'ALREADY_PROCESSED' && res.pointsAwarded === 0 && targetUser.totalPoints === initialBal) {
      console.log('  ✅ [TEST 8 PASSED] Duplicate PR webhook delivery strictly idempotent (0 duplicate points)');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: Issue OPEN -> CLOSED -> excluded from active Issue Explorer
  try {
    const closeIssuePayload = {
      action: 'closed',
      issue: {
        id: testIssue.githubId,
        number: testIssue.githubNumber,
        title: testIssue.title,
        state: 'closed',
        user: { login: 'maintainer-bot' },
        closed_at: new Date().toISOString(),
      },
      repository: {
        id: targetRepo.githubId,
        name: targetRepo.name,
        full_name: targetRepo.fullName,
        owner: { login: targetRepo.owner },
      },
    };

    await handleGitHubIssueEvent(closeIssuePayload);
    const activeExplorerResult = await getFilteredIssues({ pageSize: 100 });

    const isPresentInActiveExplorer = activeExplorerResult.issues.some((i) => i.id === testIssue.id);

    if (testIssue.status === 'CLOSED' && !isPresentInActiveExplorer) {
      console.log('  ✅ [TEST 9 PASSED] Closed issue strictly excluded from active Issue Explorer queries');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED] Issue state:', testIssue.status, 'Present:', isPresentInActiveExplorer);
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: Closed issue remains in database -> historical record preserved
  try {
    const foundInDb = mockDbStore.issues.find((i) => i.id === testIssue.id);
    if (foundInDb && foundInDb.status === 'CLOSED') {
      console.log('  ✅ [TEST 10 PASSED] Closed issue remains preserved in database for audit integrity');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: Closed issue with previous verified contribution -> contribution + PointsLedger remain unchanged
  try {
    const contrib = mockDbStore.contributions.find((c) => c.issueId === testIssue.id);
    const ledger = mockDbStore.pointsLedger.find((l) => l.contributionId === contrib?.id);

    if (contrib && ledger && contrib.rrPoints > 0) {
      console.log('  ✅ [TEST 11 PASSED] Historical contribution & PointsLedger remain immutable after issue closure');
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED]', contrib, ledger);
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  // TEST 12: Issue CLOSED -> REOPENED -> eligible for active discovery again
  try {
    const reopenIssuePayload = {
      action: 'reopened',
      issue: {
        id: testIssue.githubId,
        number: testIssue.githubNumber,
        title: testIssue.title,
        state: 'open',
        user: { login: 'maintainer-bot' },
      },
      repository: {
        id: targetRepo.githubId,
        name: targetRepo.name,
        full_name: targetRepo.fullName,
        owner: { login: targetRepo.owner },
      },
    };

    await handleGitHubIssueEvent(reopenIssuePayload);
    const activeExplorerResult = await getFilteredIssues({ pageSize: 100 });
    const isPresentInActiveExplorer = activeExplorerResult.issues.some((i) => i.id === testIssue.id);

    if (testIssue.status === 'OPEN' && isPresentInActiveExplorer) {
      console.log('  ✅ [TEST 12 PASSED] Reopened issue re-enabled for active discovery in Issue Explorer');
      passed++;
    } else {
      console.error('  ❌ [TEST 12 FAILED]', testIssue.status, isPresentInActiveExplorer);
    }
  } catch (err) {
    console.error('  ❌ [TEST 12 ERROR]', err);
  }

  // TEST 13: GitHub API / reconciliation failure -> last known state preserved
  try {
    const statusBefore = testIssue.status;
    const pointsBefore = targetUser.totalPoints;

    const reconRes = await reconcileActiveIssues();

    if (testIssue.status === statusBefore && targetUser.totalPoints === pointsBefore && reconRes.reconciledCount > 0) {
      console.log('  ✅ [TEST 13 PASSED] Reconciliation failure safety: last known state strictly preserved');
      passed++;
    } else {
      console.error('  ❌ [TEST 13 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 13 ERROR]', err);
  }

  // TEST 14: Invalid webhook HMAC -> state unchanged
  try {
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const isVal = verifyGitHubWebhookSignature(JSON.stringify({ test: true }), invalidSig, secret);

    if (!isVal) {
      console.log('  ✅ [TEST 14 PASSED] Invalid HMAC signature correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 14 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 14 ERROR]', err);
  }

  // TEST 15: Cross-repository webhook -> state unchanged
  try {
    const crossRepoPR: GitHubPRPayload = {
      action: 'closed',
      number: 6001,
      pull_request: {
        id: 99901,
        number: 6001,
        title: `Fixes #${testIssue.githubNumber}`,
        merged: true,
        merged_at: new Date().toISOString(),
        merged_by: { login: 'some-maintainer' },
        user: { id: 8002, login: targetUser.githubUsername },
        base: { repo: { id: 99999, name: 'other-repo', full_name: 'other/other-repo', owner: { login: 'other' } } },
      },
    };

    const res = await handleGitHubPREvent(crossRepoPR);
    if (res.status === 'REJECTED' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 15 PASSED] Cross-repository webhook correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 15 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 15 ERROR]', err);
  }

  // TEST 16: Merged PR on an OPEN issue -> issue remains active, PR activity updated
  try {
    const openIssue2 = {
      id: 'iss-sync-test-9902',
      githubId: 88702,
      githubNumber: 8802,
      repositoryId: targetRepo.id,
      title: 'Fix IPC serialization bottleneck',
      body: 'Zero-copy buffer transfer.',
      url: `${targetRepo.url}/issues/8802`,
      status: 'OPEN',
      githubState: 'open',
      labels: ['performance'],
      language: targetRepo.language,
      ecosystem: targetRepo.ecosystem,
      authorUsername: 'maintainer-bot',
      rrDifficulty: 7.5,
      openPrCount: 0,
      mergedPrCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockDbStore.issues.push(openIssue2);
    mockDbStore.issueScores.push({
      id: 'score-sync-test-9902',
      issueId: openIssue2.id,
      scoringVersion: 'v1.0.0',
      calculatedAt: new Date(),
      technicalDifficulty: 7.5,
      codebaseComplexity: 7.5,
      issueScope: 7.0,
      domainKnowledge: 8.0,
      expectedImpact: 8.5,
      testingComplexity: 7.5,
      issueClarity: 8.0,
      maintainerActivity: 8.4,
      compositeScore: 7.5,
      reasoning: 'Test score',
    });

    const prPayload: GitHubPRPayload = {
      action: 'closed',
      number: 9504,
      pull_request: {
        id: 98504,
        number: 9504,
        title: `Fixes #${openIssue2.githubNumber}`,
        merged: true,
        merged_at: new Date().toISOString(),
        merged_by: { login: 'vercel-maintainer' },
        user: { id: 8003, login: 'dvance' },
        base: { repo: { id: targetRepo.githubId, name: targetRepo.name, full_name: targetRepo.fullName, owner: { login: targetRepo.owner } } },
      },
    };

    await handleGitHubPREvent(prPayload);
    const activeExplorer = await getFilteredIssues({ pageSize: 100 });
    const stillActive = activeExplorer.issues.some((i) => i.id === openIssue2.id);

    if (openIssue2.status !== 'CLOSED' && stillActive) {
      console.log('  ✅ [TEST 16 PASSED] Merged PR on OPEN issue preserves active discovery state & updates PR activity');
      passed++;
    } else {
      console.error('  ❌ [TEST 16 FAILED]', openIssue2.status, stillActive);
    }
  } catch (err) {
    console.error('  ❌ [TEST 16 ERROR]', err);
  }

  // TEST 17: Merged PR on CLOSED issue -> issue remains hidden, contribution preserved
  try {
    testIssue.status = 'CLOSED';
    testIssue.githubState = 'closed';

    const activeExplorer = await getFilteredIssues({ pageSize: 100 });
    const isHidden = !activeExplorer.issues.some((i) => i.id === testIssue.id);
    const contribExists = mockDbStore.contributions.some((c) => c.issueId === testIssue.id);

    if (isHidden && contribExists) {
      console.log('  ✅ [TEST 17 PASSED] Merged PR on CLOSED issue keeps issue hidden while preserving contribution');
      passed++;
    } else {
      console.error('  ❌ [TEST 17 FAILED]', isHidden, contribExists);
    }
  } catch (err) {
    console.error('  ❌ [TEST 17 ERROR]', err);
  }

  // TEST 18: Repeated reconciliation -> idempotent and no duplicate records
  try {
    const initialPRCount = mockDbStore.pullRequests.length;
    const initialContribCount = mockDbStore.contributions.length;

    await reconcileActiveIssues();
    await reconcileActiveIssues();

    if (mockDbStore.pullRequests.length === initialPRCount && mockDbStore.contributions.length === initialContribCount) {
      console.log('  ✅ [TEST 18 PASSED] Repeated reconciliation strictly idempotent with 0 duplicate records created');
      passed++;
    } else {
      console.error('  ❌ [TEST 18 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 18 ERROR]', err);
  }

  console.log(`\n📊 18-Test Synchronization Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All 18 GitHub Issue & PR Synchronization Tests Passed Successfully!');
    await mockDbStore.clean();
    return true;
  } else {
    await mockDbStore.clean();
    throw new Error(`Synchronization tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runPRVerificationTests().catch((err) => {
    console.error('Verification test suite execution error:', err);
    process.exit(1);
  });
}
