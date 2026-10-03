import { evaluateV2FactorsWithEvidence } from '../issues/ingestion';
import { calculateRRDifficultyV2, calculateRRPointsFromScore } from '../scoring';

function runTests() {
  console.log('================================================================================');
  console.log('                 REPO RESCUE V2.3.1 SCORING ENGINE REGRESSION SUITE             ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.log(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- 1. OFFICIAL EXAMPLE TEST MATRIX ---
  console.log('--- 1. OFFICIAL EXAMPLE TEST MATRIX ---');
  const officialMatrix = [
    {
      id: 'Ex1',
      title: 'Fix typo in user error message',
      body: 'Fix typo in error message string when user enters wrong password.',
      expectedCategory: 'Documentation / Typo / Text',
      minScore: 0.4,
      maxScore: 1.0,
      targetStr: '~0.4 / Trivial',
    },
    {
      id: 'Ex2',
      title: 'Fix typo in DB schema setup guide',
      body: 'Correct spelling of postgresql in setup.md',
      expectedCategory: 'Documentation / Typo / Text',
      minScore: 0.4,
      maxScore: 1.0,
      targetStr: '~0.4 / Trivial',
    },
    {
      id: 'Ex3',
      title: 'Fix button hover alignment',
      body: 'Button hover margin is off by 2px on desktop navbar.',
      expectedCategory: 'Simple Bug / UI Tweak',
      minScore: 1.5,
      maxScore: 2.5,
      targetStr: '~2.5 / Easy',
    },
    {
      id: 'Ex4',
      title: 'Add null check on avatar URI',
      body: 'Prevent crash when avatar URI is null by adding fallback check.',
      expectedCategory: 'Localized Code Fix / Syntax Correction',
      minScore: 1.5,
      maxScore: 2.5,
      targetStr: '~2.5 / Easy',
    },
    {
      id: 'Ex5',
      title: 'Validate email format in signup route',
      body: 'Add email regex validation to signup POST handler to prevent malformed email registration.',
      expectedCategory: 'Localized / Moderate Bug Fix',
      minScore: 3.0,
      maxScore: 4.5,
      targetStr: '~3.5 / Moderate',
    },
    {
      id: 'Ex6',
      title: 'Fix RLS policy bypass for organization member roles',
      body: 'Org member role check bypasses row-level security policy on tenant document queries.',
      expectedCategory: 'Security & Access Control Policy',
      minScore: 5.0,
      maxScore: 6.0,
      targetStr: '~5.2 / Hard',
    },
    {
      id: 'Ex7',
      title: 'Worker thread pool mutex race condition',
      body: 'Deadlock and memory buffer leak when worker pool threads contend for mutex under high queue load.',
      expectedCategory: 'Complex Concurrency / Deadlock / System Bug',
      minScore: 7.5,
      maxScore: 9.0,
      targetStr: '~7.8 / Complex Systems',
    },
    {
      id: 'Ex8',
      title: 'Raft consensus partition recovery',
      body: 'Split-brain recovery failure during WAL replication stream corruption on follower node failover.',
      expectedCategory: 'Distributed Systems / Consensus / Replication',
      minScore: 8.5,
      maxScore: 9.8,
      targetStr: '~8.6 / Extreme Engineering',
    },
  ];

  for (const item of officialMatrix) {
    const res = evaluateV2FactorsWithEvidence(item.title, item.body, []);
    const inCategory = res.category === item.expectedCategory || (item.id === 'Ex5' && (res.category === 'Localized / Moderate Bug Fix' || res.category === 'API Route / REST Logic Fix'));
    const inRange = res.compositeScore >= item.minScore && res.compositeScore <= item.maxScore;

    assert(
      inCategory && inRange,
      `[${item.id}] "${item.title}" -> Category="${res.category}", Score=${res.compositeScore} (Target: ${item.targetStr}, Range: ${item.minScore}-${item.maxScore})`
    );
  }

  // --- 2. ADDITIONAL CONTEXT TESTS A - G ---
  console.log('\n--- 2. ADDITIONAL CONTEXT TESTS (A - G) ---');

  // Test A
  const testA = evaluateV2FactorsWithEvidence('Fix print function syntax error', 'The print statement is invalid. Correct the syntax.', []);
  assert(
    testA.category === 'Localized Code Fix / Syntax Correction' && testA.compositeScore >= 1.5 && testA.compositeScore <= 2.5,
    `[Test A] "Fix print function syntax error" -> Category="${testA.category}", Score=${testA.compositeScore} (Expected ~1.5 - 2.5)`
  );

  // Test B
  const testB = evaluateV2FactorsWithEvidence('Fix print function and add notes', 'Correct the print statement and add explanatory notes.', []);
  assert(
    testB.category === 'Localized Code Fix / Syntax Correction' && (testB.category as string) !== 'Feature Request / Enhancement' && testB.compositeScore >= 1.5 && testB.compositeScore <= 2.5,
    `[Test B] "Fix print function and add notes" -> Category="${testB.category}", Score=${testB.compositeScore} (Expected Localized Code Fix, NOT Feature)`
  );

  // Test C
  const testC = evaluateV2FactorsWithEvidence('Add OAuth login', 'Add GitHub OAuth authentication so users can sign in.', []);
  assert(
    testC.category === 'Feature Request / Enhancement' && testC.compositeScore >= 4.5 && testC.compositeScore <= 6.0,
    `[Test C] "Add OAuth login" -> Category="${testC.category}", Score=${testC.compositeScore} (Expected Feature / Auth work)`
  );

  // Test D
  const testD = evaluateV2FactorsWithEvidence('Add comments explaining authentication flow', 'Add inline comments explaining the existing authentication logic.', []);
  assert(
    testD.category === 'Documentation / Typo / Text' && testD.compositeScore <= 1.5,
    `[Test D] "Add comments explaining authentication flow" -> Category="${testD.category}", Score=${testD.compositeScore} (Expected Doc tier, NOT Feature)`
  );

  // Test E
  const testE = evaluateV2FactorsWithEvidence('Fix syntax error in parser', 'Parser crashes on a malformed token.', []);
  assert(
    testE.category === 'Localized Parser / Compiler Edge Case Fix' && testE.compositeScore >= 4.5,
    `[Test E] "Fix syntax error in parser" -> Category="${testE.category}", Score=${testE.compositeScore} (Expected Parser Edge Case Fix)`
  );

  // Test F
  const testF = evaluateV2FactorsWithEvidence('Fix typo in error message', 'Correct one spelling mistake.', []);
  assert(
    testF.category === 'Documentation / Typo / Text' && testF.compositeScore <= 1.0,
    `[Test F] "Fix typo in error message" -> Category="${testF.category}", Score=${testF.compositeScore} (Expected Documentation / Typo)`
  );

  // Test G
  const testG = evaluateV2FactorsWithEvidence('Fix syntax error', 'The application crashes when parsing nested expressions. Stack trace included.', []);
  assert(
    testG.category === 'Localized Parser / Compiler Edge Case Fix' || testG.compositeScore >= 4.5,
    `[Test G] "Fix syntax error with parser body" -> Category="${testG.category}", Score=${testG.compositeScore} (Expected elevated parser score)`
  );

  // --- 3. AMBIGUITY TESTS ---
  console.log('\n--- 3. AMBIGUITY TESTS ---');

  const vagueLogin = evaluateV2FactorsWithEvidence('Fix login', 'Fix login.', []);
  const specificOAuth = evaluateV2FactorsWithEvidence('Fix login redirect after OAuth callback', 'Users are redirected to the wrong route after successful OAuth authentication.', []);
  const shortClearPrint = evaluateV2FactorsWithEvidence('Fix print function', 'The print statement raises a syntax error. Correct the invalid function call.', []);

  assert(
    vagueLogin.factors.problemAmbiguity >= 5.0,
    `Vague "Fix login" has elevated Problem Ambiguity (PA=${vagueLogin.factors.problemAmbiguity}, expected >= 5.0)`
  );

  assert(
    specificOAuth.factors.problemAmbiguity <= 3.0,
    `Specific OAuth redirect issue has low Problem Ambiguity (PA=${specificOAuth.factors.problemAmbiguity}, expected <= 3.0)`
  );

  assert(
    shortClearPrint.factors.problemAmbiguity <= 2.5,
    `Short but explicit "Fix print function" has low Problem Ambiguity (PA=${shortClearPrint.factors.problemAmbiguity}, expected <= 2.5)`
  );

  // --- 4. ANTI-GAMING KEYWORD STUFFING TEST ---
  console.log('\n--- 4. ANTI-GAMING TESTS ---');
  const normalDoc = evaluateV2FactorsWithEvidence('Fix typo in DB schema setup guide', 'Fix a spelling mistake in the setup documentation.', []);
  const stuffedDoc = evaluateV2FactorsWithEvidence('Fix typo in DB schema setup guide', 'Fix the spelling mistake. Distributed consensus, compiler AST, mutexes, MVCC, RLS, concurrency.', []);

  assert(
    normalDoc.category === 'Documentation / Typo / Text' && normalDoc.compositeScore <= 1.0,
    `Normal doc fix stays at Doc tier (Score=${normalDoc.compositeScore})`
  );

  assert(
    stuffedDoc.category === 'Documentation / Typo / Text' && stuffedDoc.compositeScore <= 1.0,
    `Keyword-stuffed doc fix stays at Doc tier (Score=${stuffedDoc.compositeScore}, NOT inflated by keywords)`
  );

  // --- 5. PRODUCTION ISSUE #1 RE-EVALUATION DRY-RUN ---
  console.log('\n--- 5. PRODUCTION ISSUE #1 DRY-RUN ---');
  const issue1Title = 'unexxpected syntax error';
  const issue1Body = 'Please fix print function and add notes for viewers convinence';
  const res1 = evaluateV2FactorsWithEvidence(issue1Title, issue1Body, []);

  assert(
    res1.category === 'Localized Code Fix / Syntax Correction',
    `Issue #1 classified as Localized Code Fix / Syntax Correction (Actual="${res1.category}")`
  );
  assert(
    res1.compositeScore <= 2.5 && res1.compositeScore >= 1.5,
    `Issue #1 V2.3.1 score is in Easy region (Score=${res1.compositeScore}, expected 1.5 - 2.5)`
  );

  console.log('\nIssue #1 Dry-Run Summary:');
  console.log(`  Category: ${res1.category}`);
  console.log(`  TC: ${res1.factors.technicalComplexity}`);
  console.log(`  CS: ${res1.factors.changeScope}`);
  console.log(`  DS: ${res1.factors.domainSpecialization}`);
  console.log(`  TE: ${res1.factors.testingVerificationEffort}`);
  console.log(`  PA: ${res1.factors.problemAmbiguity}`);
  console.log(`  V2.3.1 RR Difficulty: ${res1.compositeScore}`);
  console.log(`  Potential RR Points: +${calculateRRPointsFromScore(res1.compositeScore)} pts`);

  console.log(`\nRegression Suite Complete: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
