import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';
import { withPrismaRetry } from '../src/lib/prisma';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface MigrationOptions {
  backup?: boolean;
  dryRun?: boolean;
  execute?: boolean;
  verifyOnly?: boolean;
  batchSize?: number;
}

export interface BackupRecord {
  issueId: string;
  githubId: string;
  githubNumber: number;
  repoFullName: string;
  title: string;
  v1_rrDifficulty: number;
  v1_IssueScore: any | null;
}

function escapeSqlString(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  // Escape single quotes for raw SQL
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

export async function runV2_3Migration(options: MigrationOptions = {}) {
  const batchSize = options.batchSize || 500;
  console.log('====================================================');
  console.log('      REPO RESCUE — V2.3.0 PRODUCTION MIGRATION     ');
  console.log('====================================================');
  console.log(`Mode: ${options.verifyOnly ? 'VERIFY ONLY' : options.execute ? 'MIGRATE (EXECUTE BULK DB WRITES)' : options.dryRun ? 'DRY-RUN (READ-ONLY)' : 'DRY-RUN + BACKUP'}`);
  console.log(`Bulk Batch Size: ${batchSize}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const issues = await withPrismaRetry(() =>
    prisma.issue.findMany({
      include: {
        repository: true,
        scores: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  );

  console.log(`Total eligible issues found in PostgreSQL: ${issues.length}`);
  if (issues.length !== 14193) {
    console.warn(`WARNING: Expected 14,193 issues, found ${issues.length}`);
  }

  // 1. Pre-migration Backup
  const backupPath = path.join(__dirname, 'backup-v1-scores.json');
  if (options.backup || !options.verifyOnly) {
    if (!fs.existsSync(backupPath)) {
      console.log(`\n[STEP 1/4] Creating pre-migration backup at '${backupPath}'...`);
      const backupData: BackupRecord[] = issues.map((i) => ({
        issueId: i.id,
        githubId: String(i.githubId),
        githubNumber: i.githubNumber,
        repoFullName: i.repository?.fullName || 'unknown',
        title: i.title,
        v1_rrDifficulty: i.rrDifficulty,
        v1_IssueScore: i.scores ? { ...i.scores } : null,
      }));
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      console.log(`✓ Backup complete. ${backupData.length} issue records exported.`);
    } else {
      console.log(`\n[STEP 1/4] Pre-migration backup already exists at '${backupPath}'. Retaining original backup.`);
    }
  }

  // Calculate V1 distribution statistics
  const v1Scores = issues.map((i) => i.rrDifficulty).sort((a, b) => a - b);
  const minV1 = v1Scores[0];
  const maxV1 = v1Scores[v1Scores.length - 1];
  const sumV1 = v1Scores.reduce((a, b) => a + b, 0);
  const meanV1 = sumV1 / v1Scores.length;
  const medianV1 = v1Scores[Math.floor(v1Scores.length / 2)];

  // Compute V2.3 scores for all issues in memory
  console.log(`\n[STEP 2/4] Evaluating V2.3.0 scoring engine across ${issues.length} issues...`);
  const computedV2 = issues.map((issue) => {
    const evalRes = evaluateV2FactorsWithEvidence(
      issue.title,
      issue.body || '',
      issue.labels || [],
      issue.repository?.fullName || 'unknown/repo',
      issue.repository?.starsCount || 100,
      issue.repository?.repoType || 'APPLICATION'
    );
    return {
      issueId: issue.id,
      existingScoreId: issue.scores?.id || null,
      githubNumber: issue.githubNumber,
      repoFullName: issue.repository?.fullName || 'unknown',
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels || [],
      v1Score: issue.rrDifficulty,
      v2Result: evalRes,
      compositeScore: evalRes.compositeScore,
      diff: Math.abs(evalRes.compositeScore - issue.rrDifficulty),
      signedDiff: evalRes.compositeScore - issue.rrDifficulty,
    };
  });

  const v2Scores = computedV2.map((c) => c.compositeScore).sort((a, b) => a - b);
  const minV2 = v2Scores[0];
  const maxV2 = v2Scores[v2Scores.length - 1];
  const sumV2 = v2Scores.reduce((a, b) => a + b, 0);
  const meanV2 = sumV2 / v2Scores.length;
  const medianV2 = v2Scores[Math.floor(v2Scores.length / 2)];
  const changedCount = computedV2.filter((c) => c.diff > 0.001).length;

  console.log('\n--- SCORE DISTRIBUTION COMPARISON ---');
  console.log(`V1 Statistics:   Min=${minV1.toFixed(2)}, Max=${maxV1.toFixed(2)}, Mean=${meanV1.toFixed(2)}, Median=${medianV1.toFixed(2)}`);
  console.log(`V2.3 Statistics: Min=${minV2.toFixed(2)}, Max=${maxV2.toFixed(2)}, Mean=${meanV2.toFixed(2)}, Median=${medianV2.toFixed(2)}`);
  console.log(`Total scores changing: ${changedCount} / ${issues.length} (${((changedCount / issues.length) * 100).toFixed(2)}%)`);

  // Buckets calculation
  const v1Buckets1: Record<string, number> = {};
  const v2Buckets1: Record<string, number> = {};
  const v1Buckets05: Record<string, number> = {};
  const v2Buckets05: Record<string, number> = {};

  for (let b = 0; b <= 10; b++) {
    v1Buckets1[`[${b}.0 - ${b + 1}.0)`] = 0;
    v2Buckets1[`[${b}.0 - ${b + 1}.0)`] = 0;
  }
  for (let b = 0; b < 20; b++) {
    const s = (b * 0.5).toFixed(1);
    const e = ((b + 1) * 0.5).toFixed(1);
    v1Buckets05[`[${s} - ${e})`] = 0;
    v2Buckets05[`[${s} - ${e})`] = 0;
  }

  v1Scores.forEach((s) => {
    const b1 = Math.min(10, Math.floor(s));
    v1Buckets1[`[${b1}.0 - ${b1 + 1}.0)`]++;
    const b05 = Math.min(19, Math.floor(s * 2));
    const start05 = (b05 * 0.5).toFixed(1);
    const end05 = ((b05 + 1) * 0.5).toFixed(1);
    v1Buckets05[`[${start05} - ${end05})`]++;
  });

  v2Scores.forEach((s) => {
    const b1 = Math.min(10, Math.floor(s));
    v2Buckets1[`[${b1}.0 - ${b1 + 1}.0)`]++;
    const b05 = Math.min(19, Math.floor(s * 2));
    const start05 = (b05 * 0.5).toFixed(1);
    const end05 = ((b05 + 1) * 0.5).toFixed(1);
    v2Buckets05[`[${start05} - ${end05})`]++;
  });

  // Verify dry-run invariants
  let invalidScores = 0;
  computedV2.forEach((item) => {
    if (item.compositeScore < 0 || item.compositeScore > 10 || isNaN(item.compositeScore)) {
      invalidScores++;
    }
  });

  console.log(`\nInvariants Check: Invalid scores (<0 or >10 or NaN): ${invalidScores}`);
  if (invalidScores > 0) {
    throw new Error(`CRITICAL MIGRATION ERROR: ${invalidScores} scores out of bounds! Aborting.`);
  }

  if (options.dryRun || (!options.execute && !options.verifyOnly)) {
    console.log('\n✓ DRY-RUN COMPLETE. Database records were NOT modified.');
    console.log('To execute database migration, run with --execute');
    return {
      totalCount: issues.length,
      changedCount,
      v1Stats: { min: minV1, max: maxV1, mean: meanV1, median: medianV1, buckets1: v1Buckets1, buckets05: v1Buckets05 },
      v2Stats: { min: minV2, max: maxV2, mean: meanV2, median: medianV2, buckets1: v2Buckets1, buckets05: v2Buckets05 },
      computedV2,
    };
  }

  // 3. Ultra-Fast Bulk SQL Migration (High Performance & Zero Timeouts)
  if (options.execute) {
    console.log(`\n[STEP 3/4] Executing ultra-fast bulk raw SQL migration (chunk size = ${batchSize})...`);
    const startTime = Date.now();
    let totalUpdated = 0;

    for (let i = 0; i < computedV2.length; i += batchSize) {
      const chunk = computedV2.slice(i, i + batchSize);
      const chunkNum = Math.floor(i / batchSize) + 1;
      const totalChunks = Math.ceil(computedV2.length / batchSize);

      // A. Bulk UPDATE Issue.rrDifficulty
      const issueValuesSql = chunk
        .map((item) => `('${item.issueId}', ${item.compositeScore.toFixed(1)})`)
        .join(',\n  ');

      const updateIssueSql = `
        UPDATE "Issue" AS i
        SET "rrDifficulty" = v.score
        FROM (VALUES
          ${issueValuesSql}
        ) AS v(id, score)
        WHERE i.id = v.id;
      `;

      // B. Bulk UPSERT IssueScore
      const scoreValuesSql = chunk
        .map((item) => {
          const scoreId = item.existingScoreId || `c_score_${item.issueId}`;
          const f = item.v2Result.factors;
          const reasoning = escapeSqlString(item.v2Result.overallReasoning);
          return `('${scoreId}', '${item.issueId}', 'v2.3.0', NOW(), ${f.technicalComplexity.toFixed(1)}, ${f.changeScope.toFixed(1)}, ${f.changeScope.toFixed(1)}, ${f.domainSpecialization.toFixed(1)}, ${f.domainSpecialization.toFixed(1)}, ${f.testingVerificationEffort.toFixed(1)}, ${f.problemAmbiguity.toFixed(1)}, 5.0, ${item.compositeScore.toFixed(1)}, ${reasoning})`;
        })
        .join(',\n  ');

      const upsertScoreSql = `
        INSERT INTO "IssueScore" (
          "id", "issueId", "scoringVersion", "calculatedAt",
          "technicalDifficulty", "codebaseComplexity", "issueScope",
          "domainKnowledge", "expectedImpact", "testingComplexity",
          "issueClarity", "maintainerActivity", "compositeScore", "reasoning"
        ) VALUES
          ${scoreValuesSql}
        ON CONFLICT ("issueId") DO UPDATE SET
          "scoringVersion" = EXCLUDED."scoringVersion",
          "calculatedAt" = EXCLUDED."calculatedAt",
          "technicalDifficulty" = EXCLUDED."technicalDifficulty",
          "codebaseComplexity" = EXCLUDED."codebaseComplexity",
          "issueScope" = EXCLUDED."issueScope",
          "domainKnowledge" = EXCLUDED."domainKnowledge",
          "expectedImpact" = EXCLUDED."expectedImpact",
          "testingComplexity" = EXCLUDED."testingComplexity",
          "issueClarity" = EXCLUDED."issueClarity",
          "maintainerActivity" = EXCLUDED."maintainerActivity",
          "compositeScore" = EXCLUDED."compositeScore",
          "reasoning" = EXCLUDED."reasoning";
      `;

      await withPrismaRetry(async () => {
        await prisma.$executeRawUnsafe(updateIssueSql);
        await prisma.$executeRawUnsafe(upsertScoreSql);
      });

      totalUpdated += chunk.length;
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalUpdated / Math.max(0.1, parseFloat(elapsedSec))).toFixed(0);
      console.log(`   Chunk ${chunkNum}/${totalChunks}: Updated ${totalUpdated}/${computedV2.length} issues (${((totalUpdated / computedV2.length) * 100).toFixed(1)}%) | ${elapsedSec}s elapsed (${rate} issues/s)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Bulk raw SQL migration execution complete in ${duration}s.`);
  }

  // 4. Post-Migration Verification
  console.log(`\n[STEP 4/4] Performing complete post-migration verification against PostgreSQL...`);
  const postDbIssues = await withPrismaRetry(() =>
    prisma.issue.findMany({
      include: {
        scores: true,
        repository: true,
      },
    })
  );

  console.log(`Post-migration issue count in DB: ${postDbIssues.length}`);
  const missingScores = postDbIssues.filter((i) => !i.scores);
  const v1VersionScores = postDbIssues.filter((i) => i.scores?.scoringVersion !== 'v2.3.0');
  const outOfBoundDbScores = postDbIssues.filter((i) => i.rrDifficulty < 0 || i.rrDifficulty > 10 || isNaN(i.rrDifficulty));
  const mismatchedCompositeScores = postDbIssues.filter((i) => i.scores && Math.abs(i.scores.compositeScore - i.rrDifficulty) > 0.001);

  console.log(`Verification Checks:`);
  console.log(`  - Total processed: ${postDbIssues.length} (Expected: 14193) -> ${postDbIssues.length === 14193 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Missing IssueScore records: ${missingScores.length} -> ${missingScores.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - IssueScore scoringVersion != 'v2.3.0': ${v1VersionScores.length} -> ${v1VersionScores.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Out-of-bounds scores (<0 or >10): ${outOfBoundDbScores.length} -> ${outOfBoundDbScores.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Mismatched Issue.rrDifficulty vs IssueScore.compositeScore: ${mismatchedCompositeScores.length} -> ${mismatchedCompositeScores.length === 0 ? '✅ PASS' : '❌ FAIL'}`);

  const postScores = postDbIssues.map((i) => i.rrDifficulty).sort((a, b) => a - b);
  const minPost = postScores[0];
  const maxPost = postScores[postScores.length - 1];
  const sumPost = postScores.reduce((a, b) => a + b, 0);
  const meanPost = sumPost / postScores.length;
  const medianPost = postScores[Math.floor(postScores.length / 2)];

  console.log(`  - DB Min Score: ${minPost.toFixed(2)} (Simulation: ${minV2.toFixed(2)}) -> ${Math.abs(minPost - minV2) < 0.01 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - DB Max Score: ${maxPost.toFixed(2)} (Simulation: ${maxV2.toFixed(2)}) -> ${Math.abs(maxPost - maxV2) < 0.01 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - DB Mean Score: ${meanPost.toFixed(2)} (Simulation: ${meanV2.toFixed(2)}) -> ${Math.abs(meanPost - meanV2) < 0.01 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - DB Median Score: ${medianPost.toFixed(2)} (Simulation: ${medianV2.toFixed(2)}) -> ${Math.abs(medianPost - medianV2) < 0.01 ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed =
    postDbIssues.length === 14193 &&
    missingScores.length === 0 &&
    v1VersionScores.length === 0 &&
    outOfBoundDbScores.length === 0 &&
    mismatchedCompositeScores.length === 0;

  console.log(`\n====================================================`);
  console.log(`   MIGRATION VERIFICATION STATUS: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'CHECKS FAILED ❌'}`);
  console.log(`====================================================`);

  await prisma.$disconnect();

  return {
    totalCount: postDbIssues.length,
    changedCount,
    v1Stats: { min: minV1, max: maxV1, mean: meanV1, median: medianV1, buckets1: v1Buckets1, buckets05: v1Buckets05 },
    v2Stats: { min: minPost, max: maxPost, mean: meanPost, median: medianPost, buckets1: v2Buckets1, buckets05: v2Buckets05 },
    computedV2,
    allPassed,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    backup: true,
    dryRun: args.includes('--dry-run'),
    execute: args.includes('--execute'),
    verifyOnly: args.includes('--verify-only'),
  };

  runV2_3Migration(options).catch((err) => {
    console.error('Migration fatal error:', err);
    process.exit(1);
  });
}
