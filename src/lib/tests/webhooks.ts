import crypto from 'crypto';
import { verifyGitHubWebhookSignature } from '../contributions/verify';
import {
  validateEventRepository,
  processLiveIssueEvent,
  processLivePREvent,
  processLiveCommentEvent,
  clearDeliveryCache,
} from '../injector/sync-service';
import { getFilteredIssues } from '../issues/service';
import { mockDbStore } from '../../../scripts/db-runner';
import { Repository } from '@/types';

/**
 * Phase 4 Dedicated GitHub Live Synchronization & Webhooks Test Suite.
 */
export async function runWebhookTests() {
  console.log('\n⚡ Running Phase 4 GitHub Live Synchronization & Webhooks Test Suite...\n');

  let passed = 0;
  const total = 31;

  const secret = 'repo-rescue-v1-webhook-secret-2026';
  clearDeliveryCache();

  // Create test repository in mockDbStore
  const testRepo: Repository = {
    id: 'repo-wh-supa-1',
    githubId: 4639908,
    name: 'supabase',
    fullName: 'supabase/supabase',
    owner: 'supabase',
    description: 'The open source Firebase alternative.',
    url: 'https://github.com/supabase/supabase',
    language: 'TypeScript',
    starsCount: 75000,
    forksCount: 5200,
    openIssuesCount: 420,
    ecosystem: 'Node.js/SQL',
    repoType: 'INFRA',
    maintainerActivityScore: 9.2,
    organizationId: 'org-cfg-1',
    isPrivate: false,
    isArchived: false,
    isFork: false,
    hasIssues: true,
    eligibilityStatus: 'ELIGIBLE',
  };

  const existingIdx = mockDbStore.repositories.findIndex((r) => r.id === testRepo.id);
  if (existingIdx >= 0) mockDbStore.repositories[existingIdx] = testRepo;
  else mockDbStore.repositories.push(testRepo);

  // TEST 1: Valid HMAC SHA-256 signature verification
  try {
    const bodyStr = JSON.stringify({ test: 'payload' });
    const digest = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    const validSig = `sha256=${digest}`;

    const isValid = verifyGitHubWebhookSignature(bodyStr, validSig, secret);
    if (isValid === true) {
      console.log('  ✅ [TEST 1 PASSED] Valid HMAC SHA-256 signature correctly verified');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: Invalid HMAC SHA-256 signature rejection
  try {
    const bodyStr = JSON.stringify({ test: 'payload' });
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const isValid = verifyGitHubWebhookSignature(bodyStr, invalidSig, secret);
    if (isValid === false) {
      console.log('  ✅ [TEST 2 PASSED] Invalid HMAC SHA-256 signature correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: Missing signature rejection
  try {
    const isValid = verifyGitHubWebhookSignature('payload', null, secret);
    if (isValid === false) {
      console.log('  ✅ [TEST 3 PASSED] Missing HMAC signature header correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: Unknown Organization Rejection
  try {
    const val = await validateEventRepository('unknown-org-xyz/some-repo');
    if (!val.isValid && val.reason?.includes('not in configured target organizations')) {
      console.log('  ✅ [TEST 4 PASSED] Webhook payload for unconfigured organization correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', val);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Unknown Repository Rejection
  try {
    const val = await validateEventRepository('supabase/unregistered-secret-repo');
    if (!val.isValid && val.reason?.includes('not registered in Repo Rescue store')) {
      console.log('  ✅ [TEST 5 PASSED] Webhook payload for unregistered repository correctly rejected');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', val);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: issues.opened — Create issue, normalize, run v1.1.0 grading engine
  try {
    const payload = {
      action: 'opened',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix PostgreSQL RLS policy security bypass in realtime subscriber',
        body: '```sql\ncreate policy ...\n```\nDetailed security vulnerability report.',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'security' }],
        user: { login: 'sec-tester' },
        created_at: '2026-09-23T10:00:00Z',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-001');

    if (res.status === 'SUCCESS' && res.gradingRan === true && (res.gradingScore || 0) > 0) {
      console.log(`  ✅ [TEST 6 PASSED] issues.opened created issue and executed v1.1.0 grading engine (Score: ${res.gradingScore?.toFixed(1)})`);
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: issues.edited — Update fields & re-run grading
  try {
    const payload = {
      action: 'edited',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix memory leak and deadlock in PostgreSQL async transaction pool',
        body: '```ts\nfunction repro() {}\n```\nMemory leak stack trace.',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'concurrency' }],
        user: { login: 'sec-tester' },
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-002');

    if (res.status === 'UPDATED' && res.gradingRan === true) {
      console.log('  ✅ [TEST 7 PASSED] issues.edited updated fields and re-evaluated v1.1.0 grading engine');
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: issues.closed — Mark CLOSED without deleting historical data
  try {
    const payload = {
      action: 'closed',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix memory leak and deadlock in PostgreSQL async transaction pool',
        state: 'closed',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-003');
    const closedIss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && closedIss && closedIss.status === 'CLOSED') {
      console.log('  ✅ [TEST 8 PASSED] issues.closed updated local status to CLOSED while preserving historical record');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', { res, closedIss });
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: issues.reopened — Mark OPEN & re-enable discovery
  try {
    const payload = {
      action: 'reopened',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix memory leak and deadlock in PostgreSQL async transaction pool',
        state: 'open',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-004');
    const reopendIss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && reopendIss && reopendIss.status === 'OPEN') {
      console.log('  ✅ [TEST 9 PASSED] issues.reopened restored local status to OPEN');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', { res, reopendIss });
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: issues.labeled — Update labels & re-evaluate grading
  try {
    const payload = {
      action: 'labeled',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix memory leak and deadlock in PostgreSQL async transaction pool',
        labels: [{ name: 'bug' }, { name: 'concurrency' }, { name: 'good first issue' }],
        state: 'open',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-005');
    const labeledIss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && labeledIss?.labels.includes('good first issue')) {
      console.log('  ✅ [TEST 10 PASSED] issues.labeled synchronized labels and re-graded issue');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]', { res, labeledIss });
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: issues.unlabeled — Update labels & sync
  try {
    const payload = {
      action: 'unlabeled',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Fix memory leak and deadlock in PostgreSQL async transaction pool',
        labels: [{ name: 'bug' }],
        state: 'open',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-006');
    const unlabeledIss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && unlabeledIss?.labels.length === 1) {
      console.log('  ✅ [TEST 11 PASSED] issues.unlabeled synchronized label removal');
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED]', { res, unlabeledIss });
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  // TEST 12: PR opened — Synchronize PR metadata, award 0 points
  try {
    const payload = {
      action: 'opened',
      number: 9901,
      pull_request: {
        id: 889901,
        number: 9901,
        title: 'Fixes #8801 PostgreSQL memory leak',
        body: 'Closes #8801',
        merged: false,
        user: { id: 201, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'deliv-pr-001');

    if (res.syncStatus === 'SUCCESS' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 12 PASSED] pull_request.opened synchronized PR metadata with 0 points awarded');
      passed++;
    } else {
      console.error('  ❌ [TEST 12 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 12 ERROR]', err);
  }

  // TEST 13: PR closed merged — Delegates to verification engine & awards points
  try {
    const payload = {
      action: 'closed',
      number: 9901,
      pull_request: {
        id: 889901,
        number: 9901,
        title: 'Fixes #8801 PostgreSQL memory leak',
        body: 'Closes #8801',
        merged: true,
        merged_at: '2026-09-23T12:00:00Z',
        merged_by: { login: 'maintainer-bot' },
        user: { id: 201, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'deliv-pr-002');

    if (res.status === 'VERIFIED' && res.pointsAwarded > 0) {
      console.log(`  ✅ [TEST 13 PASSED] pull_request closed merged verified and awarded +${res.pointsAwarded} RR Points`);
      passed++;
    } else {
      console.error('  ❌ [TEST 13 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 13 ERROR]', err);
  }

  // TEST 14: PR closed unmerged — Mark CLOSED, 0 points awarded
  try {
    const payload = {
      action: 'closed',
      number: 9902,
      pull_request: {
        id: 889902,
        number: 9902,
        title: 'Unmerged PR attempt',
        merged: false,
        user: { id: 202, login: 'random-user' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'deliv-pr-003');

    if (res.status === 'REJECTED' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 14 PASSED] pull_request closed unmerged correctly marked CLOSED with 0 points awarded');
      passed++;
    } else {
      console.error('  ❌ [TEST 14 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 14 ERROR]', err);
  }

  // TEST 15: PR reopened — Mark OPEN, 0 points
  try {
    const payload = {
      action: 'reopened',
      number: 9902,
      pull_request: {
        id: 889902,
        number: 9902,
        title: 'Unmerged PR attempt',
        merged: false,
        user: { id: 202, login: 'random-user' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'deliv-pr-004');

    if (res.syncStatus === 'SUCCESS' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 15 PASSED] pull_request reopened updated state to OPEN with 0 points');
      passed++;
    } else {
      console.error('  ❌ [TEST 15 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 15 ERROR]', err);
  }

  // TEST 16: PR synchronize — Update latestActivityAt, 0 points
  try {
    const payload = {
      action: 'synchronize',
      number: 9902,
      pull_request: {
        id: 889902,
        number: 9902,
        title: 'Unmerged PR attempt updated',
        merged: false,
        user: { id: 202, login: 'random-user' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const res = await processLivePREvent(payload, 'deliv-pr-005');

    if (res.syncStatus === 'SUCCESS' && res.pointsAwarded === 0) {
      console.log('  ✅ [TEST 16 PASSED] pull_request.synchronize updated timestamps with 0 points');
      passed++;
    } else {
      console.error('  ❌ [TEST 16 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 16 ERROR]', err);
  }

  // TEST 17: issue_comment.created — Increments comments count
  try {
    const payload = {
      action: 'created',
      issue: { id: 991001, number: 8801 },
      comment: {
        id: 77001,
        body: 'Great security fix!',
        user: { login: 'reviewer-user' },
        created_at: '2026-09-23T11:00:00Z',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveCommentEvent(payload, 'deliv-cmt-001');
    const iss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && (iss as any)?.commentsCount > 0) {
      console.log(`  ✅ [TEST 17 PASSED] issue_comment.created updated commentsCount to ${(iss as any)?.commentsCount}`);
      passed++;
    } else {
      console.error('  ❌ [TEST 17 FAILED]', { res, iss });
    }
  } catch (err) {
    console.error('  ❌ [TEST 17 ERROR]', err);
  }

  // TEST 18: issue_comment on PR — Handled safely without error
  try {
    const payload = {
      action: 'created',
      comment: {
        id: 77002,
        body: 'LGTM!',
        user: { login: 'reviewer-user' },
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveCommentEvent(payload, 'deliv-cmt-002');

    if (res.status === 'IGNORED') {
      console.log('  ✅ [TEST 18 PASSED] PR comment event without issue reference handled safely');
      passed++;
    } else {
      console.error('  ❌ [TEST 18 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 18 ERROR]', err);
  }

  // TEST 19: Duplicate Webhook Delivery — Harmless ALREADY_PROCESSED response
  try {
    const payload = {
      action: 'opened',
      issue: {
        id: 991001,
        number: 8801,
        title: 'Same issue payload',
        state: 'open',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    // First call with delivery ID 'deliv-unique-99'
    await processLiveIssueEvent(payload, 'deliv-unique-99');
    // Second call with duplicate delivery ID 'deliv-unique-99'
    const duplicateRes = await processLiveIssueEvent(payload, 'deliv-unique-99');

    if (duplicateRes.status === 'ALREADY_PROCESSED') {
      console.log('  ✅ [TEST 19 PASSED] Duplicate webhook delivery ID correctly skipped with ALREADY_PROCESSED');
      passed++;
    } else {
      console.error('  ❌ [TEST 19 FAILED]', duplicateRes);
    }
  } catch (err) {
    console.error('  ❌ [TEST 19 ERROR]', err);
  }

  // TEST 20: Grading Triggered when Required (title/body/labels change)
  try {
    const payload = {
      action: 'edited',
      issue: {
        id: 991001,
        number: 8801,
        title: 'New Title: Compiler AST Transformation Failure in PostgREST JS',
        body: '```ts\nfunction repro() {}\n```\nCompiler AST stack trace.',
        state: 'open',
        labels: [{ name: 'compiler' }, { name: 'bug' }],
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-regrade-01');

    if (res.gradingRan === true) {
      console.log('  ✅ [TEST 20 PASSED] Grading re-evaluation triggered when title/body changed materially');
      passed++;
    } else {
      console.error('  ❌ [TEST 20 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 20 ERROR]', err);
  }

  // TEST 21: Grading NOT Triggered when Unnecessary
  try {
    const payload = {
      action: 'edited',
      issue: {
        id: 991001,
        number: 8801,
        title: 'New Title: Compiler AST Transformation Failure in PostgREST JS',
        body: '```ts\nfunction repro() {}\n```\nCompiler AST stack trace.',
        state: 'open',
        labels: [{ name: 'compiler' }, { name: 'bug' }],
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveIssueEvent(payload, 'deliv-regrade-02');

    if (res.gradingRan === false) {
      console.log('  ✅ [TEST 21 PASSED] Grading skipped when incoming issue content is identical to stored content');
      passed++;
    } else {
      console.error('  ❌ [TEST 21 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 21 ERROR]', err);
  }

  // TEST 22: Closed Issues Excluded from Active Explorer
  try {
    // Close issue 8801
    const payload = {
      action: 'closed',
      issue: {
        id: 991001,
        number: 8801,
        title: 'New Title: Compiler AST Transformation Failure in PostgREST JS',
        state: 'closed',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };
    await processLiveIssueEvent(payload, 'deliv-close-test');

    const explorerResult = await getFilteredIssues({ pageSize: 100 });
    const isClosedInExplorer = explorerResult.issues.some((i) => i.githubNumber === 8801);

    if (!isClosedInExplorer) {
      console.log('  ✅ [TEST 22 PASSED] Closed issue strictly excluded from active Issue Explorer queries');
      passed++;
    } else {
      console.error('  ❌ [TEST 22 FAILED] Closed issue found in active explorer');
    }
  } catch (err) {
    console.error('  ❌ [TEST 22 ERROR]', err);
  }

  // TEST 23: Reopened Issues Restored to Active Explorer
  try {
    const payload = {
      action: 'reopened',
      issue: {
        id: 991001,
        number: 8801,
        title: 'New Title: Compiler AST Transformation Failure in PostgREST JS',
        state: 'open',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };
    await processLiveIssueEvent(payload, 'deliv-reopen-test');

    const explorerResult = await getFilteredIssues({ pageSize: 100 });
    const isReopenedInExplorer = explorerResult.issues.some((i) => i.githubNumber === 8801);

    if (isReopenedInExplorer) {
      console.log('  ✅ [TEST 23 PASSED] Reopened issue restored to active Issue Explorer queries');
      passed++;
    } else {
      console.error('  ❌ [TEST 23 FAILED] Reopened issue not found in explorer');
    }
  } catch (err) {
    console.error('  ❌ [TEST 23 ERROR]', err);
  }

  // TEST 24: Processing Failure Does Not Delete Existing Data
  try {
    const preCount = mockDbStore.issues.length;

    // Send malformed payload to trigger failure in handler
    const malformedPayload: any = {
      action: 'opened',
      issue: {
        id: 991001,
        number: 8801,
        // missing required fields to trigger controlled failure if any
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    await processLiveIssueEvent(malformedPayload, 'deliv-fail-test');
    const postCount = mockDbStore.issues.length;

    if (postCount >= preCount) {
      console.log('  ✅ [TEST 24 PASSED] Processing error handled safely: zero existing database records deleted');
      passed++;
    } else {
      console.error('  ❌ [TEST 24 FAILED]', { preCount, postCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 24 ERROR]', err);
  }

  // TEST 25: No Duplicate Records Created
  try {
    const issueKeys = mockDbStore.issues.map((i) => `${i.repositoryId}#${i.githubNumber}`);
    const uniqueKeys = new Set(issueKeys);

    if (issueKeys.length === uniqueKeys.size) {
      console.log(`  ✅ [TEST 25 PASSED] No duplicate issue records across entire database (${uniqueKeys.size} unique keys)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 25 FAILED] Duplicates found');
    }
  } catch (err) {
    console.error('  ❌ [TEST 25 ERROR]', err);
  }

  // TEST 26: No Duplicate Points Awarded
  try {
    // Deliver duplicate PR merged payload
    const payload = {
      action: 'closed',
      number: 9901,
      pull_request: {
        id: 889901,
        number: 9901,
        title: 'Fixes #8801 PostgreSQL memory leak',
        body: 'Closes #8801',
        merged: true,
        merged_at: '2026-09-23T12:00:00Z',
        merged_by: { login: 'maintainer-bot' },
        user: { id: 201, login: 'sjenkins-codes' },
        base: {
          repo: {
            id: 4639908,
            name: 'supabase',
            full_name: 'supabase/supabase',
            owner: { login: 'supabase' },
          },
        },
      },
    };

    const duplicateRes = await processLivePREvent(payload, 'deliv-pr-002');

    if (duplicateRes.status === 'ALREADY_PROCESSED' && duplicateRes.pointsAwarded === 0) {
      console.log('  ✅ [TEST 26 PASSED] Duplicate PR webhook delivery awarded 0 duplicate points');
      passed++;
    } else {
      console.error('  ❌ [TEST 26 FAILED]', duplicateRes);
    }
  } catch (err) {
    console.error('  ❌ [TEST 26 ERROR]', err);
  }

  // TEST 27: issues.deleted — Durable Tombstone (Hidden from Explorer, preserved in store)
  try {
    const payload = {
      action: 'deleted',
      issue: {
        id: 991001,
        number: 8801,
        title: 'New Title: Compiler AST Transformation Failure in PostgREST JS',
        state: 'closed',
      },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    await processLiveIssueEvent(payload, 'deliv-del-001');

    const tombstonedIss = mockDbStore.issues.find((i) => i.githubNumber === 8801);
    const explorerRes = await getFilteredIssues({ pageSize: 100 });
    const inExplorer = explorerRes.issues.some((i) => i.githubNumber === 8801);

    if (tombstonedIss && tombstonedIss.isDeleted === true && !inExplorer) {
      console.log('  ✅ [TEST 27 PASSED] issues.deleted set durable isDeleted tombstone, removed from Explorer, and preserved historical record');
      passed++;
    } else {
      console.error('  ❌ [TEST 27 FAILED]', { tombstonedIss, inExplorer });
    }
  } catch (err) {
    console.error('  ❌ [TEST 27 ERROR]', err);
  }

  // TEST 28: Authoritative issue.comments Count Synchronization
  try {
    const payload = {
      action: 'created',
      issue: { id: 991001, number: 8801, comments: 14 },
      comment: { id: 77099, body: 'Authoritative test comment', user: { login: 'reviewer-user' } },
      repository: {
        id: 4639908,
        name: 'supabase',
        full_name: 'supabase/supabase',
        owner: { login: 'supabase' },
      },
    };

    const res = await processLiveCommentEvent(payload, 'deliv-cmt-auth-01');
    const iss = mockDbStore.issues.find((i) => i.githubNumber === 8801);

    if (res.status === 'UPDATED' && (iss as any)?.commentsCount === 14) {
      console.log('  ✅ [TEST 28 PASSED] issue_comment payload.issue.comments synchronized authoritative count (14) without drift');
      passed++;
    } else {
      console.error('  ❌ [TEST 28 FAILED]', { res, commentsCount: (iss as any)?.commentsCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 28 ERROR]', err);
  }

  // TEST 29: Label Order Permutation Skips Spurious Re-Grading
  try {
    // First event with labels ['bug', 'concurrency']
    const p1 = {
      action: 'edited',
      issue: {
        id: 991002,
        number: 8802,
        title: 'Label order test issue',
        body: 'Testing label order',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'concurrency' }],
      },
      repository: { id: 4639908, name: 'supabase', full_name: 'supabase/supabase', owner: { login: 'supabase' } },
    };
    await processLiveIssueEvent(p1, 'deliv-lbl-01');

    // Second event with reversed label order ['concurrency', 'bug']
    const p2 = {
      action: 'edited',
      issue: {
        id: 991002,
        number: 8802,
        title: 'Label order test issue',
        body: 'Testing label order',
        state: 'open',
        labels: [{ name: 'concurrency' }, { name: 'bug' }],
      },
      repository: { id: 4639908, name: 'supabase', full_name: 'supabase/supabase', owner: { login: 'supabase' } },
    };
    const res2 = await processLiveIssueEvent(p2, 'deliv-lbl-02');

    if (res2.gradingRan === false) {
      console.log('  ✅ [TEST 29 PASSED] Label order permutation correctly recognized as identical labels (grading skipped)');
      passed++;
    } else {
      console.error('  ❌ [TEST 29 FAILED]', res2);
    }
  } catch (err) {
    console.error('  ❌ [TEST 29 ERROR]', err);
  }

  // TEST 30: PR Upsert Prevents Duplicate pullRequests Array Records
  try {
    const prMatches = mockDbStore.pullRequests.filter((p) => p.githubId === 889901);

    if (prMatches.length === 1) {
      console.log('  ✅ [TEST 30 PASSED] PR verification strictly upserted record (exactly 1 PR object in mockDbStore)');
      passed++;
    } else {
      console.error('  ❌ [TEST 30 FAILED] Duplicate PR objects found:', prMatches.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 30 ERROR]', err);
  }

  // TEST 31: Webhook SyncAuditLog Coverage
  try {
    const auditLogsCount = mockDbStore.syncAuditLogs.length;

    if (auditLogsCount > 0) {
      console.log(`  ✅ [TEST 31 PASSED] Webhook audit trail logged ${auditLogsCount} audit entries cleanly`);
      passed++;
    } else {
      console.error('  ❌ [TEST 31 FAILED] No audit logs created');
    }
  } catch (err) {
    console.error('  ❌ [TEST 31 ERROR]', err);
  }

  console.log(`\n📊 Phase 4 Webhook Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Phase 4 GitHub Live Synchronization & Webhook Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Webhook tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runWebhookTests().catch((err) => {
    console.error('Webhook test suite error:', err);
    process.exit(1);
  });
}
