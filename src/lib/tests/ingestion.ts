import { loadAndScoreFounding30, REPOSITORY_SEED_DATA, evaluate8FactorsWithEvidence } from '../issues/ingestion';
import { calculateRRDifficulty, calculateRRPointsFromScore, SCORING_VERSION } from '../scoring';

/**
 * 10-Test Ingestion & Scoring Test Suite for Repo Rescue V1.
 */
export async function runIngestionTests() {
  console.log('\n🚀 Running 10-Test Founding Issue Scoring & Ingestion Test Suite...\n');

  let passed = 0;
  const total = 10;
  const foundingSet = loadAndScoreFounding30();

  // TEST 1: Exactly 30 founding issues ingested
  try {
    if (foundingSet.length === 30) {
      console.log('  ✅ [TEST 1 PASSED] Exactly 30 founding issues scored and prepared for ingestion');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED] Count:', foundingSet.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: 6 target repositories represented (5 issues per repository)
  try {
    const reposMap = new Map<string, number>();
    foundingSet.forEach((item) => {
      const repo = item.repository.fullName.toLowerCase();
      reposMap.set(repo, (reposMap.get(repo) || 0) + 1);
    });

    const is6Repos = reposMap.size === 6;
    const allHave5 = Array.from(reposMap.values()).every((count) => count === 5);

    if (is6Repos && allHave5) {
      console.log('  ✅ [TEST 2 PASSED] Exactly 6 target repositories represented with 5 issues each');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', Array.from(reposMap.entries()));
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: PR Activity distribution verified
  try {
    const noPrCount = foundingSet.filter((i) => i.issue.prActivityClassification === 'OPEN_NO_PR').length;
    const prProgCount = foundingSet.filter((i) => i.issue.prActivityClassification === 'OPEN_PR_IN_PROGRESS').length;

    if (noPrCount === 13 && prProgCount === 17) {
      console.log(`  ✅ [TEST 3 PASSED] PR Activity classification verified (13 OPEN_NO_PR, 17 OPEN_PR_IN_PROGRESS)`);
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', { noPrCount, prProgCount });
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: 8-Factor score bounds (0.0 to 10.0 for every factor)
  try {
    const allValid = foundingSet.every((item) => {
      const s = item.score;
      const factors = [
        s.technicalDifficulty,
        s.codebaseComplexity,
        s.issueScope,
        s.domainKnowledge,
        s.expectedImpact,
        s.testingComplexity,
        s.issueClarity,
        s.maintainerActivity,
      ];
      return factors.every((f) => f >= 0.0 && f <= 10.0);
    });

    if (allValid) {
      console.log('  ✅ [TEST 4 PASSED] All 8 score factors strictly bounded between 0.0 and 10.0 across all 30 issues');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Composite RR Difficulty formula correctness
  try {
    const allCorrect = foundingSet.every((item) => {
      const s = item.score;
      const computed = calculateRRDifficulty({
        technicalDifficulty: s.technicalDifficulty,
        codebaseComplexity: s.codebaseComplexity,
        issueScope: s.issueScope,
        domainKnowledge: s.domainKnowledge,
        expectedImpact: s.expectedImpact,
        testingComplexity: s.testingComplexity,
        issueClarity: s.issueClarity,
        maintainerActivity: s.maintainerActivity,
      });
      return computed === item.issue.rrDifficulty && computed === s.compositeScore;
    });

    if (allCorrect) {
      console.log('  ✅ [TEST 5 PASSED] Composite RR Difficulty strictly matches 8-factor formula calculation for all 30 issues');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: V1 RR Points calculation (RR Difficulty * 10)
  try {
    const pointsValid = foundingSet.every((item) => {
      const expectedPoints = Math.round(item.issue.rrDifficulty * 10);
      return calculateRRPointsFromScore(item.issue.rrDifficulty) === expectedPoints;
    });

    if (pointsValid) {
      console.log('  ✅ [TEST 6 PASSED] V1 RR Points calculation (RR Difficulty × 10) verified');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: IssueScore audit record retention (scoringVersion = 'v1.0.0')
  try {
    const versionValid = foundingSet.every((item) => item.score.scoringVersion === SCORING_VERSION);

    if (versionValid) {
      console.log(`  ✅ [TEST 7 PASSED] All 30 IssueScore audit records retain scoringVersion '${SCORING_VERSION}'`);
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Active Issue Explorer query rule: CLOSED issues excluded by default
  try {
    const allOpen = foundingSet.every((item) => item.issue.status === 'OPEN' && item.issue.githubState === 'open');

    if (allOpen) {
      console.log('  ✅ [TEST 8 PASSED] All 30 founding issues are OPEN and eligible for active discovery');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: Unique repository + githubNumber constraint
  try {
    const keys = new Set<string>();
    let duplicates = 0;

    foundingSet.forEach((item) => {
      const key = `${item.repository.fullName}#${item.issue.githubNumber}`;
      if (keys.has(key)) {
        duplicates++;
      } else {
        keys.add(key);
      }
    });

    if (duplicates === 0 && keys.size === 30) {
      console.log('  ✅ [TEST 9 PASSED] Unique repo + githubNumber identity constraint strictly satisfied (30 unique keys)');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED] Duplicates:', duplicates);
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: Idempotent ingestion pipeline execution & strict determinism
  try {
    const run1 = loadAndScoreFounding30();
    const run2 = loadAndScoreFounding30();

    const isEqual =
      run1.length === run2.length &&
      run1.every(
        (item, idx) =>
          item.issue.id === run2[idx].issue.id &&
          item.score.compositeScore === run2[idx].score.compositeScore &&
          item.score.technicalDifficulty === run2[idx].score.technicalDifficulty
      );

    if (isEqual) {
      console.log('  ✅ [TEST 10 PASSED] Founding issue scoring & ingestion pipeline execution is strictly deterministic and idempotent');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  // TEST 11: Maintainer Activity is strictly grounded in repository metadata
  try {
    const maintainerGrounded = foundingSet.every((item) => {
      return Math.abs(item.score.maintainerActivity - item.repository.maintainerActivityScore) < 0.001;
    });

    if (maintainerGrounded) {
      console.log('  ✅ [TEST 11 PASSED] Maintainer activity factor is 100% grounded in repository metadata');
      passed++;
    } else {
      console.error('  ❌ [TEST 11 FAILED] Ungrounded maintainer activity detected');
    }
  } catch (err) {
    console.error('  ❌ [TEST 11 ERROR]', err);
  }

  // TEST 12: 100% Evidence Coverage for all 8 factors across all 30 issues
  try {
    const evidenceValid = foundingSet.every((item) => {
      const fd = item.score.factorDetails;
      if (!fd) return false;
      const keys = ['technicalDifficulty', 'codebaseComplexity', 'issueScope', 'domainKnowledge', 'expectedImpact', 'testingComplexity', 'issueClarity', 'maintainerActivity'];
      return keys.every((k) => fd[k] && fd[k].reasoning && fd[k].evidenceType && fd[k].confidence);
    });

    if (evidenceValid) {
      console.log('  ✅ [TEST 12 PASSED] 100% Evidence Coverage (reasoning, confidence, evidenceType) verified across all 8 factors');
      passed++;
    } else {
      console.error('  ❌ [TEST 12 FAILED] Incomplete factor evidence');
    }
  } catch (err) {
    console.error('  ❌ [TEST 12 ERROR]', err);
  }

  // TEST 13: Evidence Sensitivity Regression Test (altering input signals alters corresponding factors)
  try {
    const baseInput = {
      title: 'Fix issue in button component',
      body: 'Small UI bug.',
      repoFullName: 'twentyhq/twenty',
      repository: { repoType: 'APP', maintainerActivityScore: 9.1 },
    };

    const elevatedInput = {
      title: 'Fix memory leak and deadlock in batch processing pipeline',
      body: '```ts\nfunction repro() { throw new Error("stack trace"); }\n```\nExpected behavior: no deadlock.',
      repoFullName: 'twentyhq/twenty',
      repository: { repoType: 'APP', maintainerActivityScore: 9.1 },
    };

    const evalBase = evaluate8FactorsWithEvidence(baseInput);
    const evalElevated = evaluate8FactorsWithEvidence(elevatedInput);

    const techChanged = evalElevated.factors.technicalDifficulty > evalBase.factors.technicalDifficulty;
    const clarityChanged = evalElevated.factors.issueClarity > evalBase.factors.issueClarity;
    const testChanged = evalElevated.factors.testingComplexity > evalBase.factors.testingComplexity;

    if (techChanged && clarityChanged && testChanged) {
      console.log('  ✅ [TEST 13 PASSED] Evidence Sensitivity verified: changing input signals deterministically alters factor scores');
      passed++;
    } else {
      console.error('  ❌ [TEST 13 FAILED]', { techChanged, clarityChanged, testChanged });
    }
  } catch (err) {
    console.error('  ❌ [TEST 13 ERROR]', err);
  }

  // TEST 14: Historical Audit Retention (v1.0.0 score and factor data preserved alongside v1.1.0)
  try {
    const historicalAuditValid = foundingSet.every((item) => {
      const s = item.score;
      return (
        s.scoringVersion === 'v1.1.0' &&
        s.previousScoringVersion === 'v1.0.0' &&
        typeof s.previousScore === 'number' &&
        s.previousFactors != null
      );
    });

    if (historicalAuditValid) {
      console.log('  ✅ [TEST 14 PASSED] Historical audit retention verified (v1.0.0 score/factors preserved alongside v1.1.0)');
      passed++;
    } else {
      console.error('  ❌ [TEST 14 FAILED]');
    }
  } catch (err) {
    console.error('  ❌ [TEST 14 ERROR]', err);
  }

  // TEST 15: Defect Prevention — No flat factor vectors (all 8 factors identical)
  try {
    const noFlatVectors = foundingSet.every((item) => {
      const s = item.score;
      const vals = [
        s.technicalDifficulty,
        s.codebaseComplexity,
        s.issueScope,
        s.domainKnowledge,
        s.expectedImpact,
        s.testingComplexity,
        s.issueClarity,
        s.maintainerActivity,
      ];
      return new Set(vals).size > 1; // More than 1 unique value per issue
    });

    if (noFlatVectors) {
      console.log('  ✅ [TEST 15 PASSED] Defect Prevention verified: 0 flat factor vectors across all 30 issues');
      passed++;
    } else {
      console.error('  ❌ [TEST 15 FAILED] Flat factor vector detected');
    }
  } catch (err) {
    console.error('  ❌ [TEST 15 ERROR]', err);
  }

  console.log(`\n📊 15-Test Ingestion Suite Results: ${passed}/${total + 5} Passed\n`);

  if (passed === total + 5) {
    console.log('🎉 All 15 Ingestion Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Ingestion tests failed (${passed}/${total + 5} passed)`);
  }
}

if (require.main === module) {
  runIngestionTests().catch((err) => {
    console.error('Ingestion test suite execution error:', err);
    process.exit(1);
  });
}
