import {
  processLiveIssueEvent,
  processLivePREvent,
  clearDeliveryCache,
} from '../injector/sync-service';
import { reconcileRepositoryIssues } from '../injector/reconciliation';
import { getFilteredIssues } from '../issues/service';
import { mockDbStore } from '../../../scripts/db-runner';
import { Repository } from '@/types';

/**
 * Dedicated Production GitHub Continuous Synchronization Lifecycle Test Suite.
 * Tests live webhook transitions, idempotency, out-of-order recovery, and anti-cheating verification.
 */
export async function runSyncLifecycleTests() {
  console.log('\n🔄 Running Production Continuous Sync Lifecycle Test Suite...\n');

  let passed = 0;
  const total = 12;

  clearDeliveryCache();

  // Controlled test repository: supabase/realtime
  const controlledRepo: Repository = {
    id: 'repo-sync-rt-1',
    githubId: 210347143,
    name: 'realtime',
    fullName: 'supabase/realtime',
    owner: 'supabase',
    description: 'Listen to your PostgreSQL database in real-time over WebSockets.',
    url: 'https://github.com/supabase/realtime',
    language: 'Elixir',
    starsCount: 7640,
    forksCount: 450,
    openIssuesCount: 75,
    ecosystem: 'Node.js/SQL',
    repoType: 'INFRA',
    maintainerActivityScore: 9.0,
    organizationId: 'org-cfg-1',
    isPrivate: false,
    isArchived: false,
    isFork: false,
    hasIssues: true,
    eligibilityStatus: 'ELIGIBLE',
    syncState: 'NEVER_SYNCED',
  };

  const existingIdx = mockDbStore.repositories.findIndex((r) => r.id === controlledRepo.id || r.fullName === controlledRepo.fullName);
  if (existingIdx >= 0) mockDbStore.repositories[existingIdx] = controlledRepo;
  else mockDbStore.repositories.push(controlledRepo);

  const testIssueNumber = 501;

  // TEST 1: issues.opened -> Ingest, canonical identity, v1.1.0 score, Explorer visibility
  try {
    const payload = {
      action: 'opened',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'Connection drop under high WebSocket load',
        body: 'Realtime WebSocket connections drop when concurrency exceeds 5000 clients.',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'performance' }],
        user: { login: 'contributor-dev-1' },
        comments: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res = await processLiveIssueEvent(payload, 'dlv-live-op-1');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);
    const scoreRecord = mockDbStore.issueScores.find((s) => storedIssue && s.issueId === storedIssue.id);

    if (
      res.status === 'SUCCESS' &&
      storedIssue &&
      storedIssue.status === 'OPEN' &&
      scoreRecord &&
      scoreRecord.scoringVersion === 'v1.1.0' &&
      storedIssue.rrDifficulty > 0
    ) {
      console.log('  ✅ [TEST 1 PASSED] issues.opened: Ingested issue, resolved canonical identity, generated v1.1.0 score');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]', { res, storedIssue, scoreRecord });
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: issues.edited -> Resync data and regrade when title/body change materially
  try {
    const payload = {
      action: 'edited',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load (Memory Leak in Erlang VM)',
        body: 'Detailed stacktrace showing GenServer memory overflow under 5000 concurrent sockets.',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'performance' }, { name: 'critical' }],
        user: { login: 'contributor-dev-1' },
        comments: 5,
        updated_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res = await processLiveIssueEvent(payload, 'dlv-live-ed-2');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    if (res.status === 'UPDATED' && res.gradingRan === true && storedIssue?.title.includes('CRITICAL')) {
      console.log('  ✅ [TEST 2 PASSED] issues.edited: Resynced title/body/labels and re-evaluated v1.1.0 grading engine');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', { res, storedIssue });
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: issues.labeled / unlabeled & Label Permutation Safety
  try {
    const payload1 = {
      action: 'labeled',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load (Memory Leak in Erlang VM)',
        body: 'Detailed stacktrace showing GenServer memory overflow under 5000 concurrent sockets.',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'performance' }, { name: 'critical' }, { name: 'help wanted' }],
        user: { login: 'contributor-dev-1' },
        updated_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res1 = await processLiveIssueEvent(payload1, 'dlv-live-lbl-3a');

    // Label permutation (same labels, different array order)
    const payload2 = {
      action: 'labeled',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load (Memory Leak in Erlang VM)',
        body: 'Detailed stacktrace showing GenServer memory overflow under 5000 concurrent sockets.',
        state: 'open',
        labels: [{ name: 'help wanted' }, { name: 'critical' }, { name: 'performance' }, { name: 'bug' }],
        user: { login: 'contributor-dev-1' },
        updated_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res2 = await processLiveIssueEvent(payload2, 'dlv-live-lbl-3b');

    if (res1.gradingRan === true && res2.gradingRan === false) {
      console.log('  ✅ [TEST 3 PASSED] issues.labeled: Regraded on new label, safely skipped on label permutation');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', { res1, res2 });
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: issues.closed -> Hide from active Explorer queries while preserving DB history
  try {
    const payload = {
      action: 'closed',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load',
        body: 'Detailed stacktrace showing GenServer memory overflow.',
        state: 'closed',
        user: { login: 'contributor-dev-1' },
        closed_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    await processLiveIssueEvent(payload, 'dlv-live-cl-4');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    // Explorer query check
    const explorerRes = await getFilteredIssues({ search: 'WebSocket' });
    const inExplorer = explorerRes.issues.some((i) => i.id === storedIssue?.id);

    if (storedIssue?.status === 'CLOSED' && !inExplorer) {
      console.log('  ✅ [TEST 4 PASSED] issues.closed: Marked status CLOSED, hidden from active Explorer, preserved in DB');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', { storedIssue, inExplorer });
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: issues.reopened -> Reactivate issue & restore to Explorer queries
  try {
    const payload = {
      action: 'reopened',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load',
        body: 'Detailed stacktrace showing GenServer memory overflow.',
        state: 'open',
        user: { login: 'contributor-dev-1' },
        updated_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    await processLiveIssueEvent(payload, 'dlv-live-re-5');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    const explorerRes = await getFilteredIssues({ search: 'WebSocket' });
    const inExplorer = explorerRes.issues.some((i) => i.id === storedIssue?.id);

    if (storedIssue?.status === 'OPEN' && inExplorer) {
      console.log('  ✅ [TEST 5 PASSED] issues.reopened: Status updated to OPEN, Explorer query visibility restored');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', { storedIssue, inExplorer });
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: pull_request.opened -> Link PR to issue, update PR activity, 0 points awarded
  try {
    const payload = {
      action: 'opened',
      number: 901,
      pull_request: {
        id: 880901,
        number: 901,
        title: `Fixes #${testIssueNumber} connection drop by increasing socket buffer`,
        body: `Resolves #${testIssueNumber}. Increases GenServer socket buffer size.`,
        state: 'open',
        merged: false,
        user: { id: 7001, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: controlledRepo.githubId,
            name: controlledRepo.name,
            full_name: controlledRepo.fullName,
            owner: { login: controlledRepo.owner },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'dlv-live-pr-op-6');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    if (res.pointsAwarded === 0 && storedIssue?.openPrCount === 1 && storedIssue?.prActivityClassification === 'OPEN_PR_IN_PROGRESS') {
      console.log('  ✅ [TEST 6 PASSED] pull_request.opened: Linked PR to issue, updated PR activity classification, awarded 0 points');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', { res, storedIssue });
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: pull_request.synchronize -> Update PR timestamps, 0 points awarded
  try {
    const payload = {
      action: 'synchronize',
      number: 901,
      pull_request: {
        id: 880901,
        number: 901,
        title: `Fixes #${testIssueNumber} connection drop by increasing socket buffer`,
        body: `Resolves #${testIssueNumber}. Updated with unit tests.`,
        state: 'open',
        merged: false,
        user: { id: 7001, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: controlledRepo.githubId,
            name: controlledRepo.name,
            full_name: controlledRepo.fullName,
            owner: { login: controlledRepo.owner },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'dlv-live-pr-sync-7');
    if (res.pointsAwarded === 0 && res.syncStatus === 'SUCCESS') {
      console.log('  ✅ [TEST 7 PASSED] pull_request.synchronize: Updated PR activity timestamp cleanly with 0 points awarded');
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: pull_request.closed (merged) -> Anti-cheating verification & points allocation upon merge
  try {
    const payload = {
      action: 'closed',
      number: 901,
      pull_request: {
        id: 880901,
        number: 901,
        title: `Fixes #${testIssueNumber} connection drop by increasing socket buffer`,
        body: `Resolves #${testIssueNumber}. Approved and merged.`,
        state: 'closed',
        merged: true,
        merged_at: new Date().toISOString(),
        user: { id: 7001, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: controlledRepo.githubId,
            name: controlledRepo.name,
            full_name: controlledRepo.fullName,
            owner: { login: controlledRepo.owner },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'dlv-live-pr-cl-8');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    if (res.status === 'VERIFIED' && (res.pointsAwarded || 0) > 0 && storedIssue?.mergedPrCount === 1) {
      console.log(`  ✅ [TEST 8 PASSED] pull_request.closed (merged): Verified contribution anti-cheating rules and awarded +${res.pointsAwarded} RR Points`);
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', { res, storedIssue });
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: Duplicate Webhook Delivery Idempotency
  try {
    const dupPayload = {
      action: 'opened',
      issue: {
        id: 990501,
        number: testIssueNumber,
        title: 'CRITICAL: Connection drop under high WebSocket load',
        state: 'open',
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res = await processLiveIssueEvent(dupPayload, 'dlv-live-op-1'); // Duplicate delivery ID from Test 1
    const matchingIssues = mockDbStore.issues.filter((i) => i.repositoryId === controlledRepo.id && i.githubNumber === testIssueNumber);

    if (res.status === 'ALREADY_PROCESSED' && matchingIssues.length === 1) {
      console.log('  ✅ [TEST 9 PASSED] Duplicate webhook delivery skipped cleanly (0 duplicate records created)');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', { res, matchingIssues });
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: Out-of-Order Event Safety (e.g., closed received before opened)
  try {
    const outOfOrderClosedPayload = {
      action: 'closed',
      issue: {
        id: 990777,
        number: 777,
        title: 'Out-of-order closed issue',
        body: 'Event arrived before opened event.',
        state: 'closed',
        user: { login: 'contributor-dev-2' },
        closed_at: new Date().toISOString(),
      },
      repository: {
        id: controlledRepo.githubId,
        name: controlledRepo.name,
        full_name: controlledRepo.fullName,
        owner: { login: controlledRepo.owner },
      },
    };

    const res = await processLiveIssueEvent(outOfOrderClosedPayload, 'dlv-live-ooo-10');
    const storedIssue = mockDbStore.issues.find((i) => i.repositoryId === controlledRepo.id && i.githubNumber === 777);

    if (res.status === 'SUCCESS' && storedIssue?.status === 'CLOSED') {
      console.log('  ✅ [TEST 10 PASSED] Out-of-order event handled safely: Ingested in CLOSED state without crashing or corrupting data');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]', { res, storedIssue });
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: Reconciliation Recovery (Authoritative Source of Truth)
  try {
    // Simulate periodic reconciliation check on controlled repository
    const recRes = await reconcileRepositoryIssues(controlledRepo.fullName);
    if (recRes.success && recRes.issuesExamined >= 0) {
      console.log(`  ✅ [TEST 11 PASSED] Authoritative reconciliation executed on '${controlledRepo.fullName}' as source of truth (${recRes.issuesExamined} examined)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED]', recRes);
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  // TEST 12: Zero Synthetic & Zero Duplicate Guarantee
  try {
    const repoIssues = mockDbStore.issues.filter((i) => i.repositoryId === controlledRepo.id);
    const repoKeys = repoIssues.map((i) => `${i.repositoryId}#${i.githubNumber}`);
    const uniqueKeys = new Set(repoKeys);
    const synthetic = repoIssues.filter((i) => i.title.includes('fake') || i.title.includes('placeholder'));

    if (repoKeys.length === uniqueKeys.size && synthetic.length === 0) {
      console.log(`  ✅ [TEST 12 PASSED] Zero synthetic records and zero duplicate identity keys across store (${uniqueKeys.size} unique issues)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 12 FAILED]', { repoKeys, synthetic });
    }
  } catch (err) {
    console.error('  ❌ [TEST 12 ERROR]', err);
  }

  console.log(`\n📊 Continuous Sync Lifecycle Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Production Continuous Sync Lifecycle Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Sync lifecycle tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runSyncLifecycleTests().catch((err) => {
    console.error('Sync lifecycle test error:', err);
    process.exit(1);
  });
}
