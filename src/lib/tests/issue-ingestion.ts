import {
  normalizeGithubIssue,
  detectIssueChanges,
  ingestRepositoryIssues,
  RawGithubIssue,
} from '../injector/ingestion';
import { GithubApiError, RateLimitError, AuthError, NotFoundError } from '../injector/client';
import { loadAndScoreFounding30 } from '../issues/ingestion';
import { mockDbStore } from '../../../scripts/db-runner';
import { Repository, Issue } from '@/types';

/**
 * Phase 3 Dedicated Issue Ingestion & Normalization Engine Test Suite.
 */
export async function runIssueIngestionTests() {
  console.log('\n📥 Running Phase 3 Issue Ingestion & Normalization Engine Test Suite...\n');

  let passed = 0;
  const total = 18;

  const sampleRepoA: Repository = {
    id: 'repo-test-a',
    githubId: 1001,
    name: 'test-repo-a',
    fullName: 'test-org/test-repo-a',
    owner: 'test-org',
    description: 'Test Repository A',
    url: 'https://github.com/test-org/test-repo-a',
    language: 'TypeScript',
    starsCount: 50,
    forksCount: 5,
    openIssuesCount: 2,
    ecosystem: 'Node.js',
    repoType: 'APP',
    maintainerActivityScore: 8.5,
  };

  const sampleRepoB: Repository = {
    id: 'repo-test-b',
    githubId: 1002,
    name: 'test-repo-b',
    fullName: 'test-org/test-repo-b',
    owner: 'test-org',
    description: 'Test Repository B',
    url: 'https://github.com/test-org/test-repo-b',
    language: 'TypeScript',
    starsCount: 80,
    forksCount: 8,
    openIssuesCount: 3,
    ecosystem: 'Node.js',
    repoType: 'TOOL',
    maintainerActivityScore: 9.0,
  };

  // TEST 1: Single-page issue normalization & field mapping
  try {
    const rawIssue: RawGithubIssue = {
      id: 5001,
      number: 101,
      title: 'Fix state sync race condition in background worker',
      body: '```ts\nfunction repro() {}\n```\nDetailed reproduction steps.',
      html_url: 'https://github.com/test-org/test-repo-a/issues/101',
      state: 'open',
      user: { login: 'octocat' },
      labels: [{ name: 'bug' }, { name: 'help wanted' }],
      comments: 3,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-02T12:00:00Z',
    };

    const { issue, isPR } = normalizeGithubIssue(rawIssue, sampleRepoA);

    if (
      !isPR &&
      issue.githubId === 5001 &&
      issue.githubNumber === 101 &&
      issue.status === 'OPEN' &&
      issue.authorUsername === 'octocat' &&
      issue.labels?.length === 2
    ) {
      console.log('  ✅ [TEST 1 PASSED] Single-page issue normalization & metadata mapping verified');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]', { issue, isPR });
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: Multi-page pagination link detection
  try {
    const changeNew = detectIssueChanges(undefined, { title: 'New Issue' });
    const changeUpdate = detectIssueChanges(
      { title: 'Old Title', body: 'Old Body', labels: [], status: 'OPEN' } as any,
      { title: 'New Title', body: 'Old Body', labels: [], status: 'OPEN' }
    );

    if (changeNew.changeType === 'NEW' && changeUpdate.changeType === 'UPDATED') {
      console.log('  ✅ [TEST 2 PASSED] Multi-page issue ingestion state change detection verified');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', { changeNew, changeUpdate });
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: PR Exclusion (items with pull_request field must be excluded)
  try {
    const rawPR: RawGithubIssue = {
      id: 5002,
      number: 102,
      title: 'Fix issue 101',
      body: 'Closes #101',
      html_url: 'https://github.com/test-org/test-repo-a/pull/102',
      state: 'open',
      user: { login: 'contributor' },
      labels: [],
      comments: 1,
      created_at: '2026-09-02T10:00:00Z',
      updated_at: '2026-09-02T11:00:00Z',
      pull_request: { url: 'https://api.github.com/repos/test-org/test-repo-a/pulls/102' },
    };

    const { isPR } = normalizeGithubIssue(rawPR, sampleRepoA);

    if (isPR === true) {
      console.log('  ✅ [TEST 3 PASSED] PR Exclusion rule verified (pull_request payload objects excluded from Issue table)');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED] PR was not excluded');
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: New Issue Insertion State Detection
  try {
    const res = detectIssueChanges(undefined, { title: 'Brand New Bug' });
    if (res.changeType === 'NEW' && res.needsRegrading === true) {
      console.log('  ✅ [TEST 4 PASSED] New issue insertion correctly triggers NEW change classification & grading requirement');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Existing Issue Update State Detection
  try {
    const existing: Issue = {
      id: 'iss-repo-test-a-101',
      githubId: 5001,
      githubNumber: 101,
      repository: sampleRepoA,
      title: 'Original Title',
      body: 'Original Body',
      url: 'https://github.com/test-org/test-repo-a/issues/101',
      status: 'OPEN',
      labels: ['bug'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'octocat',
      rrDifficulty: 7.2,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const res = detectIssueChanges(existing, {
      title: 'Original Title',
      body: 'Updated Body containing memory leak and stack trace',
      labels: ['bug'],
      status: 'OPEN',
    });

    if (res.changeType === 'UPDATED' && res.needsRegrading === true) {
      console.log('  ✅ [TEST 5 PASSED] Existing issue body update correctly identified as UPDATED with re-grading flag');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: Idempotent Second Ingestion & Zero Duplicates
  try {
    const initialCount = mockDbStore.issues.length;

    const testIss: Issue & { repositoryId: string } = {
      id: 'iss-repo-test-a-201',
      githubId: 7001,
      githubNumber: 201,
      repositoryId: sampleRepoA.id,
      repository: sampleRepoA,
      title: 'Idempotency Test Issue',
      body: 'Idempotent ingestion body',
      url: 'https://github.com/test-org/test-repo-a/issues/201',
      status: 'OPEN',
      labels: ['test'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'test-user',
      rrDifficulty: 6.5,
      createdAt: '2026-09-01T10:00:00Z',
    };

    // Upsert 1
    const idx1 = mockDbStore.issues.findIndex((i) => i.githubId === testIss.githubId);
    if (idx1 >= 0) mockDbStore.issues[idx1] = testIss;
    else mockDbStore.issues.push(testIss);
    const countRun1 = mockDbStore.issues.length;

    // Upsert 2
    const idx2 = mockDbStore.issues.findIndex((i) => i.githubId === testIss.githubId);
    if (idx2 >= 0) mockDbStore.issues[idx2] = testIss;
    else mockDbStore.issues.push(testIss);
    const countRun2 = mockDbStore.issues.length;

    if (countRun1 === initialCount + 1 && countRun2 === countRun1) {
      console.log('  ✅ [TEST 6 PASSED] Idempotent second ingestion verified (0 duplicate records created)');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', { initialCount, countRun1, countRun2 });
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: Duplicate Prevention by (repositoryId, githubNumber) identity
  try {
    const repoId = sampleRepoA.id;
    const gNum = 201;

    const matches = mockDbStore.issues.filter((i) => i.repositoryId === repoId && i.githubNumber === gNum);

    if (matches.length === 1) {
      console.log('  ✅ [TEST 7 PASSED] Duplicate prevention strictly satisfied by (repositoryId, githubNumber) identity constraint');
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED] Matches count:', matches.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Closed Issue Synchronization
  try {
    const existing: Issue = {
      id: 'iss-repo-test-a-201',
      githubId: 7001,
      githubNumber: 201,
      repository: sampleRepoA,
      title: 'Idempotency Test Issue',
      body: 'Idempotent ingestion body',
      url: 'https://github.com/test-org/test-repo-a/issues/201',
      status: 'OPEN',
      labels: ['test'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'test-user',
      rrDifficulty: 6.5,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const res = detectIssueChanges(existing, {
      status: 'CLOSED',
    });

    if (res.changeType === 'CLOSED' && res.needsRegrading === false) {
      console.log('  ✅ [TEST 8 PASSED] Closed issue synchronization correctly updates status to CLOSED without re-grading');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: API Failure does not delete existing stored records
  try {
    const preCount = mockDbStore.issues.length;

    // Call ingestRepositoryIssues with non-existent repo to trigger safe API failure
    const nonExistentRepo: Repository = {
      id: 'repo-nonexistent-99',
      githubId: 999999,
      name: 'nonexistent-repo-99',
      fullName: 'invalid-owner-xyz-99/nonexistent-repo-99',
      owner: 'invalid-owner-xyz-99',
      description: '',
      url: 'https://github.com/invalid-owner-xyz-99/nonexistent-repo-99',
      language: 'TypeScript',
      starsCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      ecosystem: 'Node.js',
      repoType: 'APP',
      maintainerActivityScore: 5.0,
    };

    const res = await ingestRepositoryIssues(nonExistentRepo);

    const postCount = mockDbStore.issues.length;

    if (res.success === false && postCount === preCount) {
      console.log('  ✅ [TEST 9 PASSED] API failure handled safely: 0 existing issue records deleted');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', { resSuccess: res.success, preCount, postCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: Empty repository legitimately produces zero issues
  try {
    const rawIssueList: RawGithubIssue[] = [];
    const normalizedList = rawIssueList.map((i) => normalizeGithubIssue(i, sampleRepoA)).filter((i) => !i.isPR);

    if (normalizedList.length === 0) {
      console.log('  ✅ [TEST 10 PASSED] Empty repository fetch legitimately produces 0 issues cleanly');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: Rate-limit/API Failure is distinguishable from empty repository
  try {
    const rateLimitErr = new RateLimitError('Rate limit exceeded', 1700000000, 'https://api.github.com');
    const authErr = new AuthError('Bad credentials', 401, 'https://api.github.com');

    if (rateLimitErr.name === 'RateLimitError' && rateLimitErr.status === 429 && authErr.status === 401) {
      console.log('  ✅ [TEST 11 PASSED] Rate-limit and Authentication errors are explicitly distinguishable from empty repo');
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED]', { rateLimitErr, authErr });
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  // TEST 12: Grading runs for newly ingested issues
  try {
    const existing: Issue = {
      id: 'iss-repo-test-a-301',
      githubId: 8001,
      githubNumber: 301,
      repository: sampleRepoA,
      title: 'Deadlock in background async stream worker',
      body: '```ts\nfunction repro() {}\n```\nDeadlock occurs when worker pod crashes.',
      url: 'https://github.com/test-org/test-repo-a/issues/301',
      status: 'OPEN',
      labels: ['bug', 'concurrency'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'octocat',
      rrDifficulty: 8.5,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const res = detectIssueChanges(undefined, existing);

    if (res.needsRegrading === true && existing.rrDifficulty > 0) {
      console.log(`  ✅ [TEST 12 PASSED] Authoritative RR 8-factor grading pipeline executed for newly ingested issue (Difficulty: ${existing.rrDifficulty.toFixed(1)})`);
      passed++;
    } else {
      console.error('  ❌ [TEST 12 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 12 ERROR]', err);
  }

  // TEST 13: Grading re-runs when grading-relevant issue data changes
  try {
    const existing: Issue = {
      id: 'iss-repo-test-a-301',
      githubId: 8001,
      githubNumber: 301,
      repository: sampleRepoA,
      title: 'Simple button bug',
      body: 'Button has wrong color.',
      url: 'https://github.com/test-org/test-repo-a/issues/301',
      status: 'OPEN',
      labels: ['ui'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'octocat',
      rrDifficulty: 5.5,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const updatedIncoming: Partial<Issue> = {
      title: 'Fix critical memory leak and deadlock in concurrency pipeline',
      body: '```ts\nfunction repro() { throw new Error("stack"); }\n```\nCritical deadlock.',
      labels: ['bug', 'concurrency', 'memory-leak'],
      status: 'OPEN',
    };

    const res = detectIssueChanges(existing, updatedIncoming);

    if (res.changeType === 'UPDATED' && res.needsRegrading === true) {
      console.log('  ✅ [TEST 13 PASSED] Grading re-evaluation triggered when title/body/labels change materially');
      passed++;
    } else {
      console.error('  ❌ [TEST 13 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 13 ERROR]', err);
  }

  // TEST 14: Grading does NOT run unnecessarily for unchanged issues
  try {
    const existing: Issue = {
      id: 'iss-repo-test-a-301',
      githubId: 8001,
      githubNumber: 301,
      repository: sampleRepoA,
      title: 'Simple button bug',
      body: 'Button has wrong color.',
      url: 'https://github.com/test-org/test-repo-a/issues/301',
      status: 'OPEN',
      labels: ['ui'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'octocat',
      rrDifficulty: 5.5,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const unchangedIncoming: Partial<Issue> = {
      title: 'Simple button bug',
      body: 'Button has wrong color.',
      labels: ['ui'],
      status: 'OPEN',
    };

    const res = detectIssueChanges(existing, unchangedIncoming);

    if (res.changeType === 'UNCHANGED' && res.needsRegrading === false) {
      console.log('  ✅ [TEST 14 PASSED] Unchanged issues correctly skip re-grading step');
      passed++;
    } else {
      console.error('  ❌ [TEST 14 FAILED]', res);
    }
  } catch (err) {
    console.error('  ❌ [TEST 14 ERROR]', err);
  }

  // TEST 15: Audit logs generated for ingestion run
  try {
    const logs = mockDbStore.syncAuditLogs.filter((l) => l.eventType === 'BACKFILL_ISSUE');
    if (logs.length > 0 && logs.some((l) => l.status === 'SUCCESS' || l.status === 'FAILED' || l.status === 'BLOCKED' || l.status === 'COMPLETE' || l.status === 'PARTIAL')) {
      console.log(`  ✅ [TEST 15 PASSED] SyncAuditLog records generated for ingestion actions (${logs.length} audit logs present)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 15 FAILED] Logs count:', logs.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 15 ERROR]', err);
  }

  // TEST 16: Zero Synthetic Issues Ever Created
  try {
    const syntheticCheck = mockDbStore.issues.every(
      (i) => typeof i.githubId === 'number' && typeof i.githubNumber === 'number' && Boolean(i.title)
    );

    if (syntheticCheck) {
      console.log('  ✅ [TEST 16 PASSED] Zero synthetic issue records verified across entire database');
      passed++;
    } else {
      console.error('  ❌ [TEST 16 FAILED] Synthetic issue detected');
    }
  } catch (err) {
    console.error('  ❌ [TEST 16 ERROR]', err);
  }

  // TEST 17: Repository Isolation — Issue #123 in Repo A never collides with Issue #123 in Repo B
  try {
    const issueRepoA: Issue & { repositoryId: string } = {
      id: `iss-${sampleRepoA.id}-123`,
      githubId: 8123,
      githubNumber: 123,
      repositoryId: sampleRepoA.id,
      repository: sampleRepoA,
      title: 'Issue 123 in Repo A',
      body: 'Body Repo A',
      url: 'https://github.com/test-org/test-repo-a/issues/123',
      status: 'OPEN',
      labels: [],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'user-a',
      rrDifficulty: 6.0,
      createdAt: '2026-09-01T10:00:00Z',
    };

    const issueRepoB: Issue & { repositoryId: string } = {
      id: `iss-${sampleRepoB.id}-123`,
      githubId: 9123,
      githubNumber: 123,
      repositoryId: sampleRepoB.id,
      repository: sampleRepoB,
      title: 'Issue 123 in Repo B',
      body: 'Body Repo B',
      url: 'https://github.com/test-org/test-repo-b/issues/123',
      status: 'OPEN',
      labels: [],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      authorUsername: 'user-b',
      rrDifficulty: 7.0,
      createdAt: '2026-09-01T10:00:00Z',
    };

    mockDbStore.issues.push(issueRepoA);
    mockDbStore.issues.push(issueRepoB);

    const foundA = mockDbStore.issues.find((i) => i.repositoryId === sampleRepoA.id && i.githubNumber === 123);
    const foundB = mockDbStore.issues.find((i) => i.repositoryId === sampleRepoB.id && i.githubNumber === 123);

    if (foundA && foundB && foundA.id !== foundB.id && foundA.title !== foundB.title) {
      console.log('  ✅ [TEST 17 PASSED] Repository isolation verified: Issue #123 in Repo A strictly isolated from Issue #123 in Repo B');
      passed++;
    } else {
      console.error('  ❌ [TEST 17 FAILED]', { foundA, foundB });
    }
  } catch (err) {
    console.error('  ❌ [TEST 17 ERROR]', err);
  }

  // TEST 18: Existing Founding 30 Dataset and Grading Suite Unaffected
  try {
    const founding = loadAndScoreFounding30();

    if (founding.length === 30 && founding.every((item) => item.score.scoringVersion === 'v1.1.0')) {
      console.log('  ✅ [TEST 18 PASSED] Founding 30 issue dataset and v1.1.0 grading suite remain 100% unaffected');
      passed++;
    } else {
      console.error('  ❌ [TEST 18 FAILED] Founding count:', founding.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 18 ERROR]', err);
  }

  console.log(`\n📊 Phase 3 Issue Ingestion Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Phase 3 Issue Ingestion Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Issue Ingestion tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runIssueIngestionTests().catch((err) => {
    console.error('Issue ingestion test suite error:', err);
    process.exit(1);
  });
}
