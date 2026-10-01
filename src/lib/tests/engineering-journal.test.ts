import { CaseStudyAnalysisSchema } from '../ai/case-study-schema';
import { synthesizeEvidenceAnalysis, extractEvidenceBasedTechniques } from '../ai/case-study-service';
import { analyzePullRequestDiff, GitHubPullRequestDiffData } from '../ai/diff-analysis-engine';

function runEngineeringJournalTests() {
  console.log('🧪 Running Evidence-Based Diff Analysis & Engineering Journal Tests...\n');
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

  // Test 1: CaseStudyAnalysisSchema validation
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
    assert(validData.confidence === 'HIGH' && validData.techniques.length === 2, 'Valid case study analysis passes Zod schema validation');
  } catch (err) {
    assert(false, 'Valid case study analysis passes Zod schema validation');
  }

  // Test 2: Invalid schema validation failure (empty problem string)
  try {
    CaseStudyAnalysisSchema.parse({
      problem: '',
      investigation: 'Test',
      approach: 'Test',
      result: 'Test',
    });
    assert(false, 'Schema rejects empty problem string');
  } catch (err) {
    assert(true, 'Schema rejects empty problem string');
  }

  // 1. README-only change test
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
  };
  const readmeAnalysis = analyzePullRequestDiff(readmeDiff, 'docs: update setup', 101, 'owner/repo');
  assert(
    readmeAnalysis.whatChanged.some((w) => w.statement.includes('installation and environment setup instructions')) &&
    readmeAnalysis.techniqueNames.includes('Documentation'),
    'Test 1 (README): Analyzes README diff and identifies step-by-step setup instructions & Documentation technique'
  );

  // 2. Syntax/formatting fix test
  const formatDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/utils.ts',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: '@@ -10,1 +10,1 @@\n-const x = foo+bar\n+const x = foo + bar',
      },
    ],
    totalFiles: 1,
    totalAdditions: 1,
    totalDeletions: 1,
    coverage: 'FULL_DIFF',
  };
  const formatAnalysis = analyzePullRequestDiff(formatDiff, 'fix spacing', 102, 'owner/repo');
  assert(
    formatAnalysis.whatChanged.some((w) => w.statement.includes('operator')),
    'Test 2 (Format): Detects expression formatting fix in code patch'
  );

  // 3. DOM manipulation test
  const domDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/dom.ts',
        status: 'modified',
        additions: 5,
        deletions: 0,
        changes: 5,
        patch: '@@ -1,0 +1,5 @@\n+const el = document.createElement("div");\n+el.textContent = "hello";\n+parent.appendChild(el);',
      },
    ],
    totalFiles: 1,
    totalAdditions: 5,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const domAnalysis = analyzePullRequestDiff(domDiff, 'add dom elements', 103, 'owner/repo');
  assert(
    domAnalysis.techniqueNames.includes('DOM Manipulation') && domAnalysis.techniqueNames.includes('Dynamic Rendering'),
    'Test 3 (DOM): Identifies DOM Manipulation & Dynamic Rendering techniques from document.createElement'
  );

  // 4. OOP class addition test
  const oopDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/UserService.ts',
        status: 'added',
        additions: 15,
        deletions: 0,
        changes: 15,
        patch: '@@ -0,0 +1,15 @@\n+class UserService {\n+  constructor() {}\n+  getUser() {}\n+}',
      },
    ],
    totalFiles: 1,
    totalAdditions: 15,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const oopAnalysis = analyzePullRequestDiff(oopDiff, 'add user service', 104, 'owner/repo');
  assert(
    oopAnalysis.techniqueNames.includes('Object-Oriented Programming') && oopAnalysis.techniqueNames.includes('Encapsulation'),
    'Test 4 (OOP): Detects Object-Oriented Programming & Encapsulation techniques from class definition'
  );

  // 5. Inheritance test
  const inheritDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/PaymentService.ts',
        status: 'added',
        additions: 20,
        deletions: 0,
        changes: 20,
        patch: '@@ -0,0 +1,20 @@\n+class PaymentService extends BaseService {\n+  constructor() {\n+    super();\n+  }\n+}',
      },
    ],
    totalFiles: 1,
    totalAdditions: 20,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const inheritAnalysis = analyzePullRequestDiff(inheritDiff, 'add payment service', 105, 'owner/repo');
  assert(
    inheritAnalysis.techniqueNames.includes('Inheritance'),
    'Test 5 (Inheritance): Detects Inheritance technique from class extends BaseService'
  );

  // 6. Refactoring (Loop to Map) test
  const refactorDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/transform.ts',
        status: 'modified',
        additions: 1,
        deletions: 4,
        changes: 5,
        patch: '@@ -5,4 +5,1 @@\n-const res = [];\n-for (let i = 0; i < items.length; i++) {\n-  res.push(items[i].val);\n-}\n+const res = items.map(i => i.val);',
      },
    ],
    totalFiles: 1,
    totalAdditions: 1,
    totalDeletions: 4,
    coverage: 'FULL_DIFF',
  };
  const refactorAnalysis = analyzePullRequestDiff(refactorDiff, 'clean loop', 106, 'owner/repo');
  assert(
    refactorAnalysis.techniqueNames.includes('Refactoring') && refactorAnalysis.techniqueNames.includes('Functional Programming'),
    'Test 6 (Refactoring): Detects Array.map() refactoring from explicit loop'
  );

  // 7. Test addition test
  const testDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'tests/auth.test.ts',
        status: 'added',
        additions: 30,
        deletions: 0,
        changes: 30,
        patch: '@@ -0,0 +1,30 @@\n+describe("Auth Test", () => {\n+  it("handles expired token", () => {});\n+});',
      },
    ],
    totalFiles: 1,
    totalAdditions: 30,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const testAnalysis = analyzePullRequestDiff(testDiff, 'add auth test', 107, 'owner/repo');
  assert(
    testAnalysis.techniqueNames.includes('Regression Testing'),
    'Test 7 (Testing): Identifies Regression Testing technique from test addition'
  );

  // 8. Dependency change test
  const depDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'package.json',
        status: 'modified',
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: '@@ -15,1 +15,2 @@\n-"zod": "^3.0.0"\n+"zod": "^3.22.0"',
      },
    ],
    totalFiles: 1,
    totalAdditions: 2,
    totalDeletions: 1,
    coverage: 'FULL_DIFF',
  };
  const depAnalysis = analyzePullRequestDiff(depDiff, 'bump zod', 108, 'owner/repo');
  assert(
    depAnalysis.techniqueNames.includes('Dependency Management'),
    'Test 8 (Dependency): Identifies Dependency Management technique from package.json change'
  );

  // 9. PR title contradicts diff test (DIFF WINS!)
  const contradictionDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 10,
        deletions: 0,
        changes: 10,
        patch: '@@ -1,0 +1,10 @@\n+## Setup\n+Run npm install',
      },
    ],
    totalFiles: 1,
    totalAdditions: 10,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const contradictionAnalysis = analyzePullRequestDiff(contradictionDiff, 'Rewrite complete database architecture', 109, 'owner/repo');
  assert(
    !contradictionAnalysis.whatChanged.some((w) => w.statement.includes('database')) &&
    contradictionAnalysis.whatChanged.some((w) => w.statement.includes('README.md')),
    'Test 9 (Diff Wins): Ignores contradictory PR title "Rewrite database architecture" when actual diff is README.md'
  );

  // 10. Missing diff test (METADATA_ONLY)
  const missingDiffAnalysis = analyzePullRequestDiff(null, 'Some PR', 110, 'owner/repo');
  assert(
    missingDiffAnalysis.coverage === 'METADATA_ONLY' && missingDiffAnalysis.whatChanged.length === 1,
    'Test 10 (Missing Diff): Sets coverage to METADATA_ONLY and avoids fabricating code implementation claims'
  );

  // 11. Large diff test (PARTIAL_DIFF)
  const largeDiff: GitHubPullRequestDiffData = {
    files: Array.from({ length: 20 }, (_, i) => ({
      filename: `src/file_${i}.ts`,
      status: 'modified',
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: '@@ -1,5 +1,10 @@\n+const x = 1;',
    })),
    totalFiles: 20,
    totalAdditions: 200,
    totalDeletions: 100,
    coverage: 'PARTIAL_DIFF',
  };
  const largeDiffAnalysis = analyzePullRequestDiff(largeDiff, 'Large refactor', 111, 'owner/repo');
  assert(
    largeDiffAnalysis.coverage === 'PARTIAL_DIFF',
    'Test 11 (Large Diff): Accurately records PARTIAL_DIFF coverage for large diffs'
  );

  // 12. AI / Service Fallback test
  const synthFallback = synthesizeEvidenceAnalysis({
    id: 'contrib-fallback',
    pullRequest: { githubNumber: 999, title: 'Fallback PR' },
    linesAdded: 5,
    linesDeleted: 1,
    filesChanged: 1,
    verifiedAt: new Date(),
    rrPoints: 50,
  });
  assert(
    synthFallback.evidence.length >= 2,
    'Test 12 (Fallback): Ensures contribution analysis synth fallback succeeds without throwing errors'
  );

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEngineeringJournalTests();
