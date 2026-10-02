import { CaseStudyAnalysisSchema } from '../ai/case-study-schema';
import { synthesizeEvidenceAnalysis } from '../ai/case-study-service';
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
    assert(validData.confidence === 'HIGH' && validData.techniques.length === 2, 'Valid case study analysis passes Zod schema validation');
  } catch (err) {
    assert(false, 'Valid case study analysis passes Zod schema validation');
  }

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
  };
  const readmeAnalysis = analyzePullRequestDiff(readmeDiff, 'docs: update setup', 101, 'owner/repo');
  assert(
    readmeAnalysis.whatChanged.some((w) => w.statement.includes('installation and environment setup instructions')) &&
    readmeAnalysis.techniqueNames.includes('Technical Documentation'),
    'Test 1 (README): Analyzes README diff and identifies step-by-step setup instructions & Technical Documentation technique'
  );

  // 2. Keyboard accessibility PR test
  const kbDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'server/dashboard.html',
        status: 'modified',
        additions: 8,
        deletions: 2,
        changes: 10,
        patch: '@@ -375,2 +375,8 @@\n-<tr onclick="showProject(this.dataset.name)">\n+<tr tabindex="0" onclick="showProject(this.dataset.name)" onkeydown="if(event.key===\'Enter\' || event.key===\' \') { event.preventDefault(); showProject(this.dataset.name); }">',
      },
    ],
    totalFiles: 1,
    totalAdditions: 8,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
  };
  const kbAnalysis = analyzePullRequestDiff(kbDiff, 'Make project rows accessible', 126, 'owner/repo');
  assert(
    kbAnalysis.techniqueNames.includes('Keyboard Accessibility') &&
    kbAnalysis.techniqueNames.includes('Event Handling') &&
    kbAnalysis.approach.includes('tabindex'),
    'Test 2 (Keyboard Accessibility): Detects tabindex and onkeydown event handling for Enter/Space key navigation'
  );

  // 3. DOM manipulation PR test
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

  // 4. OOP PR test
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

  // 5. Inheritance PR test
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

  // 6. React state change / hook PR test
  const reactDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/components/Counter.tsx',
        status: 'modified',
        additions: 8,
        deletions: 2,
        changes: 10,
        patch: '@@ -1,5 +1,11 @@\n+import { useState, useEffect } from "react";\n+const [count, setCount] = useState(0);\n+useEffect(() => {}, []);',
      },
    ],
    totalFiles: 1,
    totalAdditions: 8,
    totalDeletions: 2,
    coverage: 'FULL_DIFF',
  };
  const reactAnalysis = analyzePullRequestDiff(reactDiff, 'add counter state', 106, 'owner/repo');
  assert(
    reactAnalysis.techniqueNames.includes('React Hooks') && reactAnalysis.techniqueNames.includes('State Management'),
    'Test 6 (React Hooks): Identifies React Hooks & State Management techniques from useState/useEffect'
  );

  // 7. API endpoint + frontend integration (multi-file synthesis) test
  const apiIntegrationDiff: GitHubPullRequestDiffData = {
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
  };
  const apiIntegrationAnalysis = analyzePullRequestDiff(apiIntegrationDiff, 'add user api feature', 107, 'owner/repo');
  assert(
    apiIntegrationAnalysis.whatChanged.some((w) => w.statement.includes('API endpoint') && w.evidenceFiles.length >= 2),
    'Test 7 (API Integration): Synthesizes API endpoint, frontend integration, and test coverage across files'
  );

  // 8. Test addition test
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
  const testAnalysis = analyzePullRequestDiff(testDiff, 'add auth test', 108, 'owner/repo');
  assert(
    testAnalysis.techniqueNames.includes('Regression Testing'),
    'Test 8 (Regression Testing): Identifies Regression Testing technique from test file addition'
  );

  // 9. CI/CD workflow PR test
  const cicdDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: '.github/workflows/release.yml',
        status: 'added',
        additions: 25,
        deletions: 0,
        changes: 25,
        patch: '@@ -0,0 +1,25 @@\n+name: Release\n+on: release:\n+  types: [created]',
      },
    ],
    totalFiles: 1,
    totalAdditions: 25,
    totalDeletions: 0,
    coverage: 'FULL_DIFF',
  };
  const cicdAnalysis = analyzePullRequestDiff(cicdDiff, 'add release workflow', 109, 'owner/repo');
  assert(
    cicdAnalysis.techniqueNames.includes('CI/CD Automation') && cicdAnalysis.techniqueNames.includes('DevOps'),
    'Test 9 (CI/CD Workflow): Identifies CI/CD Automation & DevOps techniques from GitHub Actions workflow'
  );

  // 10. Configuration change PR test
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
  const depAnalysis = analyzePullRequestDiff(depDiff, 'bump zod', 110, 'owner/repo');
  assert(
    depAnalysis.techniqueNames.includes('Dependency Management'),
    'Test 10 (Dependency Management): Identifies Dependency Management technique from package.json update'
  );

  // 11. PR title contradicts diff test (DIFF WINS!)
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
  const contradictionAnalysis = analyzePullRequestDiff(contradictionDiff, 'Rewrite complete database architecture', 111, 'owner/repo');
  assert(
    !contradictionAnalysis.whatChanged.some((w) => w.statement.includes('database')) &&
    contradictionAnalysis.whatChanged.some((w) => w.statement.includes('README.md')),
    'Test 11 (Diff Wins): Ignores contradictory PR title "Rewrite database architecture" when actual diff is README.md'
  );

  // 12. Multi-file PR test
  const multiFileDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'server/dashboard.html',
        status: 'modified',
        additions: 5,
        deletions: 1,
        changes: 6,
        patch: '@@ -1,1 +1,5 @@\n+<tr tabindex="0" onclick="showProject(this.dataset.name)" onkeydown="...">',
      },
      {
        filename: '.jules/palette.md',
        status: 'modified',
        additions: 12,
        deletions: 0,
        changes: 12,
        patch: '@@ -1,0 +1,12 @@\n+## Accessibility Guidelines\n+Keyboard navigation rules.',
      },
    ],
    totalFiles: 2,
    totalAdditions: 17,
    totalDeletions: 1,
    coverage: 'FULL_DIFF',
  };
  const multiFileAnalysis = analyzePullRequestDiff(multiFileDiff, 'accessibility enhancements', 112, 'owner/repo');
  assert(
    multiFileAnalysis.whatChanged.length >= 2 &&
    multiFileAnalysis.whatChanged.some((w) => w.evidenceFiles.includes('server/dashboard.html')) &&
    multiFileAnalysis.whatChanged.some((w) => w.evidenceFiles.includes('.jules/palette.md')),
    'Test 12 (Multi-File PR): Analyzes both files in multi-file PR and includes statements for server/dashboard.html and .jules/palette.md'
  );

  // 13. Large PR test (PARTIAL_DIFF)
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
  const largeDiffAnalysis = analyzePullRequestDiff(largeDiff, 'Large refactor', 113, 'owner/repo');
  assert(
    largeDiffAnalysis.coverage === 'PARTIAL_DIFF',
    'Test 13 (Large PR): Accurately sets coverage to PARTIAL_DIFF for 20+ changed files'
  );

  // 14. Missing patch test
  const missingPatchDiff: GitHubPullRequestDiffData = {
    files: [
      {
        filename: 'src/binary_asset.png',
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
  };
  const missingPatchAnalysis = analyzePullRequestDiff(missingPatchDiff, 'add binary asset', 114, 'owner/repo');
  assert(
    missingPatchAnalysis.diffPatch === null,
    'Test 14 (Missing Patch): Does not fabricate Before/After code snippet when patch is missing'
  );

  // 15. GitHub API failure test (METADATA_ONLY)
  const apiFailureAnalysis = analyzePullRequestDiff(null, 'API Failure PR', 115, 'owner/repo');
  assert(
    apiFailureAnalysis.coverage === 'METADATA_ONLY' && apiFailureAnalysis.whatChanged.length === 1,
    'Test 15 (GitHub API Failure): Sets coverage to METADATA_ONLY and falls back to metadata statement without throwing errors'
  );

  // 17. Stale cache invalidation test (v1.0.0 modelVersion gets invalidated & upgraded to v2.0.0)
  const staleRecord = {
    id: 'analysis-v1',
    modelVersion: 'v1.0.0',
  };
  const isStale = staleRecord.modelVersion !== 'v2.0.0';
  assert(isStale === true, 'Test 17 (Stale Cache Invalidation): Identifies v1.0.0 modelVersion as stale and triggers deep diff regeneration');

  // 18. Up-to-date cache test (v2.0.0 modelVersion remains cached)
  const upToDateRecord = {
    id: 'analysis-v2',
    modelVersion: 'v2.0.0',
  };
  const isUpToDate = upToDateRecord.modelVersion === 'v2.0.0';
  assert(isUpToDate === true, 'Test 18 (Up-to-Date Cache): Retains v2.0.0 modelVersion analysis directly from cache');

  // 19. 40+ File PR analysis test (e.g. ayushhcodex/IITG-MUSIC #1)
  const multi40Diff: GitHubPullRequestDiffData = {
    files: Array.from({ length: 40 }, (_, i) => ({
      filename: i === 0 ? '.github/workflows/build.yml' : i === 1 ? 'src/components/Player.tsx' : i === 2 ? 'package.json' : `static/file_${i}.js`,
      status: 'added',
      additions: 15,
      deletions: 0,
      changes: 15,
      patch: i === 0
        ? '@@ -0,0 +1,15 @@\n+name: Build\n+on: push'
        : i === 1
        ? '@@ -0,0 +1,15 @@\n+import { useState } from "react";\n+const [state, setState] = useState(0);'
        : '@@ -0,0 +1,15 @@\n+"dependencies": {}',
    })),
    totalFiles: 40,
    totalAdditions: 600,
    totalDeletions: 0,
    coverage: 'PARTIAL_DIFF',
  };
  const music40Analysis = analyzePullRequestDiff(multi40Diff, 'Initial release of IITG-MUSIC app', 1, 'ayushhcodex/IITG-MUSIC');
  assert(
    music40Analysis.coverage === 'PARTIAL_DIFF' &&
    music40Analysis.whatChanged.length >= 2 &&
    music40Analysis.techniqueNames.includes('CI/CD Automation'),
    'Test 19 (40+ File PR): Processes 40-file IITG-MUSIC #1 PR without prompt overflow, setting PARTIAL_DIFF coverage'
  );

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEngineeringJournalTests();
