import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  const issues = await prisma.issue.findMany({
    include: {
      repository: true,
      scores: true,
    }
  });

  console.log(`Total issues fetched: ${issues.length}`);

  // V1 Stats
  const v1Scores = issues.map(i => i.rrDifficulty);
  v1Scores.sort((a, b) => a - b);

  const minV1 = v1Scores[0];
  const maxV1 = v1Scores[v1Scores.length - 1];
  const sumV1 = v1Scores.reduce((a, b) => a + b, 0);
  const meanV1 = sumV1 / v1Scores.length;
  const medianV1 = v1Scores[Math.floor(v1Scores.length / 2)];

  // V2.3 Simulation
  const v2Results = issues.map(issue => {
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
      githubNumber: issue.githubNumber,
      repoFullName: issue.repository?.fullName,
      title: issue.title,
      v1Score: issue.rrDifficulty,
      v2Score: evalRes.compositeScore,
      diff: Math.abs(evalRes.compositeScore - issue.rrDifficulty),
      signedDiff: evalRes.compositeScore - issue.rrDifficulty,
      factors: evalRes.factors,
      reasoning: evalRes.overallReasoning,
    };
  });

  const v2Scores = v2Results.map(r => r.v2Score).sort((a, b) => a - b);
  const minV2 = v2Scores[0];
  const maxV2 = v2Scores[v2Scores.length - 1];
  const sumV2 = v2Scores.reduce((a, b) => a + b, 0);
  const meanV2 = sumV2 / v2Scores.length;
  const medianV2 = v2Scores[Math.floor(v2Scores.length / 2)];

  const changedCount = v2Results.filter(r => r.diff > 0.001).length;

  // 1-point buckets
  const v1Buckets1: Record<string, number> = {};
  const v2Buckets1: Record<string, number> = {};
  for (let b = 0; b <= 10; b++) {
    v1Buckets1[`[${b}.0 - ${b+1}.0)`] = 0;
    v2Buckets1[`[${b}.0 - ${b+1}.0)`] = 0;
  }
  v1Scores.forEach(s => {
    const bucket = Math.min(10, Math.floor(s));
    v1Buckets1[`[${bucket}.0 - ${bucket+1}.0)`]++;
  });
  v2Scores.forEach(s => {
    const bucket = Math.min(10, Math.floor(s));
    v2Buckets1[`[${bucket}.0 - ${bucket+1}.0)`]++;
  });

  // 0.5-point buckets
  const v1Buckets05: Record<string, number> = {};
  const v2Buckets05: Record<string, number> = {};
  for (let b = 0; b < 20; b++) {
    const start = (b * 0.5).toFixed(1);
    const end = ((b + 1) * 0.5).toFixed(1);
    v1Buckets05[`[${start} - ${end})`] = 0;
    v2Buckets05[`[${start} - ${end})`] = 0;
  }
  v1Scores.forEach(s => {
    const idx = Math.min(19, Math.floor(s * 2));
    const start = (idx * 0.5).toFixed(1);
    const end = ((idx + 1) * 0.5).toFixed(1);
    v1Buckets05[`[${start} - ${end})`]++;
  });
  v2Scores.forEach(s => {
    const idx = Math.min(19, Math.floor(s * 2));
    const start = (idx * 0.5).toFixed(1);
    const end = ((idx + 1) * 0.5).toFixed(1);
    v2Buckets05[`[${start} - ${end})`]++;
  });

  // Top 10 largest score changes
  const largestChanges = [...v2Results].sort((a, b) => b.diff - a.diff).slice(0, 10);

  console.log('=== V1 VS V2.3 SUMMARY ===');
  console.log(`Total Issues: ${issues.length}`);
  console.log(`Scores that will change: ${changedCount}`);
  console.log(`V1 Stats: Min=${minV1.toFixed(2)}, Max=${maxV1.toFixed(2)}, Mean=${meanV1.toFixed(2)}, Median=${medianV1.toFixed(2)}`);
  console.log(`V2 Stats: Min=${minV2.toFixed(2)}, Max=${maxV2.toFixed(2)}, Mean=${meanV2.toFixed(2)}, Median=${medianV2.toFixed(2)}`);

  fs.writeFileSync(
    path.join(__dirname, 'read-only-pre-migration-stats.json'),
    JSON.stringify({
      totalCount: issues.length,
      changedCount,
      v1: { min: minV1, max: maxV1, mean: meanV1, median: medianV1, buckets1: v1Buckets1, buckets05: v1Buckets05 },
      v2: { min: minV2, max: maxV2, mean: meanV2, median: medianV2, buckets1: v2Buckets1, buckets05: v2Buckets05 },
      largestChanges: largestChanges.map(c => ({
        issueId: c.issueId,
        repo: c.repoFullName,
        title: c.title,
        v1: c.v1Score,
        v2: c.v2Score,
        diff: c.diff,
      })),
    }, null, 2)
  );

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
