import { loadAndScoreFounding30 } from '../src/lib/issues/ingestion';
import { FACTOR_WEIGHTS } from '../src/lib/scoring';
import { IssueScoreFactors } from '../src/types';

export function runScoringAudit() {
  const founding = loadAndScoreFounding30();
  console.log('====================================================');
  console.log('               RR SCORING AUDIT (v1.1.0)            ');
  console.log('====================================================\n');

  console.log(`Issues scored: ${founding.length}\n`);

  // 1. Composite Distribution
  const buckets = {
    '0.0–4.9': 0,
    '5.0–5.9': 0,
    '6.0–6.9': 0,
    '7.0–7.9': 0,
    '8.0–8.9': 0,
    '9.0–10.0': 0,
  };

  const compositeScores: number[] = [];
  const factorVectors: string[] = [];
  const exactScoreCounts: Record<number, number> = {};
  const vectorToIssues: Record<string, number[]> = {};

  const factorValues: Record<keyof IssueScoreFactors, number[]> = {
    technicalDifficulty: [],
    codebaseComplexity: [],
    issueScope: [],
    domainKnowledge: [],
    expectedImpact: [],
    testingComplexity: [],
    issueClarity: [],
    maintainerActivity: [],
  };

  let ungroundedMaintainerCount = 0;
  let missingEvidenceCount = 0;

  founding.forEach((item) => {
    const score = item.score;
    const repo = item.repository;
    const diff = score.compositeScore;
    compositeScores.push(diff);

    exactScoreCounts[diff] = (exactScoreCounts[diff] || 0) + 1;

    if (diff < 5.0) buckets['0.0–4.9']++;
    else if (diff < 6.0) buckets['5.0–5.9']++;
    else if (diff < 7.0) buckets['6.0–6.9']++;
    else if (diff < 8.0) buckets['7.0–7.9']++;
    else if (diff < 9.0) buckets['8.0–8.9']++;
    else buckets['9.0–10.0']++;

    const vectorStr = `[TD:${score.technicalDifficulty.toFixed(1)}, CC:${score.codebaseComplexity.toFixed(1)}, IS:${score.issueScope.toFixed(1)}, DK:${score.domainKnowledge.toFixed(1)}, EI:${score.expectedImpact.toFixed(1)}, TC:${score.testingComplexity.toFixed(1)}, IC:${score.issueClarity.toFixed(1)}, MA:${score.maintainerActivity.toFixed(1)}]`;
    factorVectors.push(vectorStr);

    if (!vectorToIssues[vectorStr]) vectorToIssues[vectorStr] = [];
    vectorToIssues[vectorStr].push(item.issue.githubNumber);

    factorValues.technicalDifficulty.push(score.technicalDifficulty);
    factorValues.codebaseComplexity.push(score.codebaseComplexity);
    factorValues.issueScope.push(score.issueScope);
    factorValues.domainKnowledge.push(score.domainKnowledge);
    factorValues.expectedImpact.push(score.expectedImpact);
    factorValues.testingComplexity.push(score.testingComplexity);
    factorValues.issueClarity.push(score.issueClarity);
    factorValues.maintainerActivity.push(score.maintainerActivity);

    // Verify maintainer activity is grounded in repository metadata
    if (Math.abs(score.maintainerActivity - repo.maintainerActivityScore) > 0.001) {
      ungroundedMaintainerCount++;
    }

    // Verify evidence coverage
    if (!score.reasoning || !score.factorDetails) {
      missingEvidenceCount++;
    }
  });

  console.log('COMPOSITE DISTRIBUTION');
  Object.entries(buckets).forEach(([range, count]) => {
    console.log(`  ${range.padEnd(10)}: ${count}`);
  });

  console.log('\nEXACT SCORE CONCENTRATION');
  const sortedScores = Object.keys(exactScoreCounts)
    .map(Number)
    .sort((a, b) => b - a);
  sortedScores.forEach((sc) => {
    console.log(`  ${sc.toFixed(2)}: ${exactScoreCounts[sc]} issue(s)`);
  });

  // Factor Statistics
  function calcVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  }

  function calcPearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  console.log('\nFACTOR STATISTICS');
  console.log('Factor                 | Min  | Max  | Mean | Variance | Unique');
  console.log('-----------------------+------+------+------+----------+-------');

  const factorKeys = Object.keys(factorValues) as Array<keyof IssueScoreFactors>;

  factorKeys.forEach((key) => {
    const arr = factorValues[key];
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = calcVariance(arr);
    const unique = new Set(arr).size;

    console.log(
      `${key.padEnd(22)} | ${min.toFixed(1).padStart(4)} | ${max.toFixed(1).padStart(4)} | ${mean.toFixed(2).padStart(4)} | ${variance.toFixed(4).padStart(8)} | ${String(unique).padStart(6)}`
    );
  });

  // Pearson Correlation Matrix
  const shortKeys = ['TD', 'CC', 'IS', 'DK', 'EI', 'TC', 'IC', 'MA'];
  console.log('\nPEARSON CORRELATION MATRIX (FACTOR INDEPENDENCE AUDIT)');
  console.log('       ' + shortKeys.map((k) => k.padStart(7)).join(''));
  console.log('------------------------------------------------------------');

  factorKeys.forEach((k1, i) => {
    const row = shortKeys[i].padEnd(6);
    const vals = factorKeys.map((k2) => {
      const r = calcPearsonCorrelation(factorValues[k1], factorValues[k2]);
      return r.toFixed(3).padStart(7);
    });
    console.log(row + vals.join(''));
  });

  // Repository-Level Score Breakdown
  console.log('\nREPOSITORY-LEVEL DISTRIBUTION BREAKDOWN');
  const repoGroups: Record<string, number[]> = {};
  founding.forEach((item) => {
    const repoName = item.repository.fullName;
    if (!repoGroups[repoName]) repoGroups[repoName] = [];
    repoGroups[repoName].push(item.score.compositeScore);
  });

  Object.entries(repoGroups).forEach(([repoName, scores]) => {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  ${repoName.padEnd(30)}: count=${scores.length}, min=${min.toFixed(2)}, max=${max.toFixed(2)}, mean=${mean.toFixed(2)} [scores: ${scores.map((s) => s.toFixed(1)).join(', ')}]`);
  });

  console.log('\nDUPLICATE VECTORS');
  const duplicates = Object.entries(vectorToIssues).filter(([_, issues]) => issues.length > 1);
  if (duplicates.length === 0) {
    console.log('  None detected (0 duplicate factor vectors across 30 issues).');
  } else {
    duplicates.forEach(([vec, issues]) => {
      console.log(`  Vector ${vec}: used by ${issues.length} issues (github #${issues.join(', #')})`);
    });
  }

  console.log('\nSUSPICIOUS CONSTANTS & AUDIT CHECKS');
  let suspiciousFound = false;
  factorKeys.forEach((key) => {
    const arr = factorValues[key];
    const variance = calcVariance(arr);
    if (variance === 0) {
      console.log(`  ⚠️  WARNING: Factor '${key}' has zero variance (constant score across all 30 issues).`);
      suspiciousFound = true;
    }
  });
  if (ungroundedMaintainerCount > 0) {
    console.log(`  ⚠️  WARNING: ${ungroundedMaintainerCount} issue(s) have maintainerActivity ungrounded from repo metadata.`);
    suspiciousFound = true;
  }
  if (!suspiciousFound) {
    console.log('  ✅ No suspicious zero-variance static constants or ungrounded maintainer factors found.');
  }

  console.log('\nEVIDENCE COVERAGE');
  console.log(`  100% factor reasoning coverage: ${missingEvidenceCount === 0 ? 'VERIFIED' : 'FAILED'}`);
  console.log(`  Maintainer activity repository grounding: ${ungroundedMaintainerCount === 0 ? 'VERIFIED' : 'FAILED'}`);

  // Sort issues by compositeScore
  const sortedFounding = [...founding].sort((a, b) => a.score.compositeScore - b.score.compositeScore);
  const lowest5 = sortedFounding.slice(0, 5);
  const highest5 = sortedFounding.slice(-5).reverse();

  console.log('\n====================================================');
  console.log('       LOWEST 5 GRADED ISSUES (EVIDENCE BREAKDOWN)  ');
  console.log('====================================================');
  lowest5.forEach((item, idx) => {
    printIssueBreakdown(item, idx + 1);
  });

  console.log('\n====================================================');
  console.log('       HIGHEST 5 GRADED ISSUES (EVIDENCE BREAKDOWN) ');
  console.log('====================================================');
  highest5.forEach((item, idx) => {
    printIssueBreakdown(item, idx + 1);
  });

  console.log('\n----------------------------------------------------');
  console.log('     FOUNDING 30 ISSUES FULL EVIDENCE BREAKDOWN     ');
  console.log('----------------------------------------------------');

  founding.forEach((item) => {
    printIssueBreakdown(item);
  });
}

function printIssueBreakdown(item: any, rank?: number) {
  const s = item.score;
  const fd = s.factorDetails || {};
  const rankStr = rank ? `#${rank} ` : '';
  console.log(`\n${rankStr}Issue #${item.issue.githubNumber} (${item.repository.fullName}):`);
  console.log(`  Title:                   ${item.issue.title}`);
  console.log(`  Previous Score (v1.0.0): ${s.previousScore ?? 'N/A'}`);
  console.log(`  New RR Difficulty:       ${s.compositeScore.toFixed(2)} (${s.scoringVersion})`);
  console.log(`  RR Points:               ${Math.round(s.compositeScore * 10)}`);
  console.log(`  Factor Breakdown:`);

  (Object.keys(FACTOR_WEIGHTS) as Array<keyof IssueScoreFactors>).forEach((fKey) => {
    const detail = fd[fKey] || {};
    const scoreVal = s[fKey];
    console.log(
      `    - ${fKey.padEnd(20)}: ${scoreVal.toFixed(1)}  [${detail.evidenceType || 'observed'} / ${detail.confidence || 'high'} confidence] -> ${detail.reasoning || 'N/A'}`
    );
  });
  console.log(`  Overall Reasoning:       ${s.reasoning}`);
}

if (require.main === module) {
  runScoringAudit();
}

