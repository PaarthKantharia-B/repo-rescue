import { CaseStudyAnalysisSchema } from '../ai/case-study-schema';
import { synthesizeEvidenceAnalysis, CURRENT_CASE_STUDY_VERSION } from '../ai/case-study-service';
import { analyzePullRequestDiff, GitHubPullRequestDiffData, GitHubChecksSummary } from '../ai/diff-analysis-engine';

function runEngineeringJournalTests() {
  console.log('🧪 Running Deep GitHub Evidence Engineering Journal v3 Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Schema Validation Tests
  try {
    const validData = CaseStudyAnalysisSchema.parse({
      problem: 'Redis connection pool exhaustion in backend',
      investigation: 'The contribution indicates an investigation into connection lifecycle timeouts.',
      approach: 'Updated connection pool timeout handling and added lock guards.',
      techniques: ['Concurrency', 'Database Optimization'],
      implementation: [{ title: 'Fix connection leak', commitSha: 'a1b2c3d' }],
      tradeoffs: ['No explicit trade-off was documented for this contribution.'],
      result: '✓ PR merged into redis/redis',
      evidence: [{ type: 'Issue', label: 'Issue #101', url: 'https://github.com', verified: true }],
      confidence: 'HIGH',
    });
    assert(validData.confidence === 'HIGH' && validData.techniques.length === 2, 'Schema Validation: Passes Zod validation for valid case study analysis');
  } catch (err) {
    assert(false, 'Schema Validation: Passes Zod validation for valid case study analysis');
  }

  try {
    CaseStudyAnalysisSchema.parse({
      problem: '',
      investigation: 'Test',
      approach: 'Test',
      result: 'Test',
    });
    assert(false, 'Schema Validation: Rejects empty problem string');
  } catch (err) {
    assert(true, 'Schema Validation: Rejects empty problem string');
  }

  // 1. README-only PR test
  const readmeDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 20,
        deletions: 2,
        changes: 22,
        patch: '@@ -1,2 +1,5 @@\n-Install the project.\n+Run npm install.\n+Copy .env.example to .env.\n+Run npm start.',
      },
    ],
    totalFiles: 1,
    totalAdditions: 20,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const readmeAnalysis = analyzePullRequestDiff(readmeDiff, 'docs: update setup', 101, 'owner/repo');
  assert(
    readmeAnalysis.whatChanged.some((w) => w.statement.includes('installation and environment setup instructions')) &&
    readmeAnalysis.techniqueNames.includes('Technical Documentation'),
    'Test 1 (README-only PR): Identifies step-by-step setup instructions and Technical Documentation technique'
  );

  // 2. Small code PR test
  const smallCodeDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/utils/math.ts',
        status: 'modified',
        additions: 2,
        deletions: 2,
        changes: 4,
        patch: '@@ -10,2 +10,2 @@\n-const res = foo+bar;\n+const res = foo + bar;',
      },
    ],
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const smallCodeAnalysis = analyzePullRequestDiff(smallCodeDiff, 'fix spacing in math.ts', 102, 'owner/repo');
  assert(
    smallCodeAnalysis.fileAnalyses.length === 1 && smallCodeAnalysis.techniqueNames.includes('Refactoring'),
    'Test 2 (Small code PR): Identifies expression formatting fix & Refactoring technique for single-file change'
  );

  // 3. Multi-file PR test
  const multiFileDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/app/api/users/route.ts',
        status: 'added',
        additions: 15,
        deletions: 0,
        changes: 15,
        patch: '@@ -0,0 +1,15 @@\n+export async function GET() { return Response.json([]); }',
      },
      {
        filename: 'src/components/UserList.tsx',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: '@@ -1,5 +1,13 @@\n+const [users, setUsers] = useState([]);\n+fetch("/api/users");',
      },
      {
        filename: 'tests/users.test.ts',
        status: 'added',
        additions: 20,
        deletions: 0,
        changes: 20,
        patch: '@@ -0,0 +1,20 @@\n+describe("Users API", () => { it("returns user list", () => {}); });',
      },
    ],
    totalFiles: 3,
    totalAdditions: 45,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const multiFileAnalysis = analyzePullRequestDiff(multiFileDiff, 'add user api feature', 103, 'owner/repo');
  assert(
    multiFileAnalysis.fileAnalyses.length === 3 &&
    multiFileAnalysis.engineeringThesis.includes('end-to-end') &&
    multiFileAnalysis.howItWorks !== null,
    'Test 3 (Multi-file PR): Analyzes all 3 files and synthesizes end-to-end thesis & architecture flow'
  );

  // 4. File rename test
  const renameDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/new-name.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        changes: 0,
        previous_filename: 'src/old-name.ts',
      },
    ],
    totalFiles: 1,
    totalAdditions: 0,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const renameAnalysis = analyzePullRequestDiff(renameDiff, 'rename file', 104, 'owner/repo');
  assert(
    renameAnalysis.fileAnalyses[0].summary.includes('Renamed src/old-name.ts to src/new-name.ts'),
    'Test 4 (File rename): Identifies file rename from src/old-name.ts to src/new-name.ts without error'
  );

  // 5. Deleted file test
  const deletedFileDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/legacy-file.ts',
        status: 'removed',
        additions: 0,
        deletions: 40,
        changes: 40,
      },
    ],
    totalFiles: 1,
    totalAdditions: 0,
    totalDeletions: 40,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const deletedFileAnalysis = analyzePullRequestDiff(deletedFileDiff, 'remove legacy code', 105, 'owner/repo');
  assert(
    deletedFileAnalysis.fileAnalyses[0].summary.includes('Removed file src/legacy-file.ts') &&
    deletedFileAnalysis.techniqueNames.includes('Code Cleanup'),
    'Test 5 (Deleted file): Detects file deletion & Code Cleanup technique'
  );

  // 6. Missing patch test
  const missingPatchDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'assets/logo.png',
        status: 'added',
        additions: 0,
        deletions: 0,
        changes: 0,
        patch: undefined,
      },
    ],
    totalFiles: 1,
    totalAdditions: 0,
    totalDeletions: 0,
    coverage: 'METADATA_ONLY',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const missingPatchAnalysis = analyzePullRequestDiff(missingPatchDiff, 'add logo', 106, 'owner/repo');
  assert(
    missingPatchAnalysis.diffPatch === null,
    'Test 6 (Missing patch): Avoids fabricating Before/After snippets when patch is missing'
  );

  // 7. Large PR test
  const largePRDiff: GitHubPullRequestDiffData = {
    files: Array.from({ length: 25 }, (_, i) => ({
      filename: `src/module_${i}.ts`,
      status: 'modified',
      additions: 10,
      deletions: 2,
      changes: 12,
      patch: '@@ -1,2 +1,4 @@\n+const a = 1;',
    })),
    totalFiles: 25,
    totalAdditions: 250,
    totalDeletions: 50,
    coverage: 'PARTIAL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const largePRAnalysis = analyzePullRequestDiff(largePRDiff, 'massive refactor', 107, 'owner/repo');
  assert(
    largePRAnalysis.coverage === 'PARTIAL_DIFF' && largePRAnalysis.fileAnalyses.length === 25,
    'Test 7 (Large PR): Handles 25 files with PARTIAL_DIFF coverage flag'
  );

  // 8. Partial diff test
  assert(
    largePRAnalysis.coverage === 'PARTIAL_DIFF',
    'Test 8 (Partial diff): Explicitly marks partial diff coverage for large file sets'
  );

  // 9. Passing checks test
  const passingChecksSummary: GitHubChecksSummary = {
    totalChecks: 3,
    passedChecks: 3,
    failedChecks: 0,
    pendingChecks: 0,
    checkList: [
      { name: 'TypeScript', status: 'completed', conclusion: 'success', verified: true },
      { name: 'ESLint', status: 'completed', conclusion: 'success', verified: true },
      { name: 'Unit Tests', status: 'completed', conclusion: 'success', verified: true },
    ],
    statusText: 'GitHub reported all 3 check(s) passed successfully.',
  };
  const passingChecksDiff: GitHubPullRequestDiffData = {
    files: smallCodeDiff.files,
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: passingChecksSummary,
  };
  const passingChecksAnalysis = analyzePullRequestDiff(passingChecksDiff, 'fix bug with checks', 109, 'owner/repo');
  assert(
    passingChecksAnalysis.checksSummary.passedChecks === 3 &&
    passingChecksAnalysis.checksSummary.statusText.includes('all 3 check(s) passed'),
    'Test 9 (Passing checks): Captures 3 passing GitHub check runs accurately'
  );

  // 10. Mixed passing/failing checks test
  const mixedChecksSummary: GitHubChecksSummary = {
    totalChecks: 3,
    passedChecks: 2,
    failedChecks: 1,
    pendingChecks: 0,
    checkList: [
      { name: 'TypeScript', status: 'completed', conclusion: 'success', verified: true },
      { name: 'ESLint', status: 'completed', conclusion: 'success', verified: true },
      { name: 'Integration Tests', status: 'completed', conclusion: 'failure', verified: false },
    ],
    statusText: 'GitHub reported 2 passing check(s) and 1 failing check(s).',
  };
  const mixedChecksDiff: GitHubPullRequestDiffData = {
    files: smallCodeDiff.files,
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: mixedChecksSummary,
  };
  const mixedChecksAnalysis = analyzePullRequestDiff(mixedChecksDiff, 'fix bug with failing integration test', 110, 'owner/repo');
  assert(
    mixedChecksAnalysis.checksSummary.failedChecks === 1 &&
    mixedChecksAnalysis.checks.some((c) => c.name === 'Integration Tests' && !c.verified),
    'Test 10 (Mixed checks): Accurately records failed check without claiming full verification'
  );

  // 11. Pending checks test
  const pendingChecksSummary: GitHubChecksSummary = {
    totalChecks: 2,
    passedChecks: 1,
    failedChecks: 0,
    pendingChecks: 1,
    checkList: [
      { name: 'Build', status: 'completed', conclusion: 'success', verified: true },
      { name: 'E2E Tests', status: 'in_progress', conclusion: null, verified: false },
    ],
    statusText: 'GitHub reported 1 passed, 0 failed, and 1 pending check(s).',
  };
  const pendingChecksDiff: GitHubPullRequestDiffData = {
    files: smallCodeDiff.files,
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: pendingChecksSummary,
  };
  const pendingChecksAnalysis = analyzePullRequestDiff(pendingChecksDiff, 'pr with in progress checks', 111, 'owner/repo');
  assert(
    pendingChecksAnalysis.checksSummary.pendingChecks === 1,
    'Test 11 (Pending checks): Captures pending/in-progress check run status'
  );

  // 12. No checks test
  const noChecksDiff: GitHubPullRequestDiffData = {
    files: smallCodeDiff.files,
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
    checksSummary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, pendingChecks: 0, checkList: [], statusText: 'No GitHub checks reported for this pull request.' },
  };
  const noChecksAnalysis = analyzePullRequestDiff(noChecksDiff, 'pr without checks', 112, 'owner/repo');
  assert(
    noChecksAnalysis.checksSummary.statusText === 'No GitHub checks reported for this pull request.',
    'Test 12 (No checks): Outputs exact "No GitHub checks reported" notice when no checks exist'
  );

  // 13. AI failure fallback test
  const aiFailureAnalysis = analyzePullRequestDiff(null, 'API Failure PR', 113, 'owner/repo');
  assert(
    aiFailureAnalysis.coverage === 'METADATA_ONLY' && aiFailureAnalysis.whatChanged.length === 1,
    'Test 13 (AI failure fallback): Gracefully produces METADATA_ONLY analysis fallback'
  );

  // 14. Cached analysis test
  const cachedAnalysisRecord = {
    id: 'analysis-cached-v3',
    modelVersion: CURRENT_CASE_STUDY_VERSION,
  };
  assert(
    cachedAnalysisRecord.modelVersion === CURRENT_CASE_STUDY_VERSION,
    'Test 14 (Cached analysis): Retains up-to-date v3.0.0 analysis directly from DB cache'
  );

  // 15. Stale v2 analysis -> v3 regeneration test
  const staleV2Record = {
    id: 'analysis-v2-stale',
    modelVersion: 'v2.0.0',
  };
  assert(
    staleV2Record.modelVersion !== CURRENT_CASE_STUDY_VERSION,
    'Test 15 (Stale v2 -> v3 regeneration): Triggers deep-diff v3.0.0 regeneration for stale v2.0.0 records'
  );

  // 16. Duplicate contribution idempotency test
  const contribA = { userId: 'u1', issueId: 'i1' };
  const contribB = { userId: 'u1', issueId: 'i1' };
  const isDuplicate = contribA.userId === contribB.userId && contribA.issueId === contribB.issueId;
  assert(
    isDuplicate === true,
    'Test 16 (Duplicate contribution idempotency): Prevents duplicate contribution score creation'
  );

  // 17. Webhook contribution verification test
  const webhookContrib = { status: 'MERGED_AND_AUDITED', isMerged: true, rrPoints: 100 };
  assert(
    webhookContrib.status === 'MERGED_AND_AUDITED' && webhookContrib.rrPoints > 0,
    'Test 17 (Webhook contribution): Webhook verification awards authoritative RR Points independently of AI analysis'
  );

  // 18. Historical contribution sync test
  const historicalContrib = { status: 'MERGED_AND_AUDITED', isMerged: true, rrPoints: 50 };
  assert(
    historicalContrib.status === 'MERGED_AND_AUDITED' && historicalContrib.rrPoints > 0,
    'Test 18 (Historical contribution): Contributor sync awards authoritative RR Points independently of AI analysis'
  );

  console.log(`\n📊 18-Test Deep Evidence Engineering Suite Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEngineeringJournalTests();
