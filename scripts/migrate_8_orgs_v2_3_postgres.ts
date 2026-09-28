import { prisma, withPrismaRetry } from '../src/lib/prisma';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';

const TARGET_8_ORGS = [
  'cloudflare',
  'appwrite',
  'vercel',
  'temporalio',
  'PostHog',
  'n8n-io',
  'directus',
  'calcom',
];

const WORKER_CONCURRENCY = 4;

async function runPool<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      await fn(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log('================================================================');
  console.log(' 🚀 PRODUCTION V2.3.0 SCORING MIGRATION (8 PARTNER ORGS)      ');
  console.log('================================================================\n');

  const now = new Date();

  // 1. Safety Lock Checks: Verify Grafana and Supabase baseline records
  const preGrafanaRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'grafana' } } }));
  const preGrafanaIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } } }));
  const preGrafanaV23 = await withPrismaRetry(() => prisma.issueScore.count({ where: { issue: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } }, scoringVersion: 'v2.3.0' } }));

  const preSupabaseRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'supabase' } } }));
  const preSupabaseIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } } }));
  const preSupabaseV23 = await withPrismaRetry(() => prisma.issueScore.count({ where: { issue: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } }, scoringVersion: 'v2.3.0' } }));

  console.log('🔒 BASELINE ORGANIZATIONS LOCK VERIFICATION:');
  console.log(`  • Baseline Grafana:  ${preGrafanaRepos} repos, ${preGrafanaIssues} issues, ${preGrafanaV23} v2.3.0 scores (Target: 590 / 12,526 / 12,526)`);
  console.log(`  • Baseline Supabase: ${preSupabaseRepos} repos, ${preSupabaseIssues} issues, ${preSupabaseV23} v2.3.0 scores (Target: 171 / 1,667 / 1,667)`);
  if (preGrafanaRepos !== 590 || preGrafanaIssues !== 12526 || preGrafanaV23 !== 12526 || preSupabaseRepos !== 171 || preSupabaseIssues !== 1667 || preSupabaseV23 !== 1667) {
    console.error('❌ Baseline lock verification failed! Aborting migration.');
    process.exit(1);
  }
  console.log('  ✅ Baseline organizations locked and verified.\n');

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const orgLogin of TARGET_8_ORGS) {
    console.log(`🏢 Processing Organization: @${orgLogin}...`);

    // Fetch IssueScores for this org that are NOT yet v2.3.0
    const pendingScores = await withPrismaRetry(() =>
      prisma.issueScore.findMany({
        where: {
          issue: { repository: { owner: { mode: 'insensitive', equals: orgLogin } } },
          scoringVersion: { not: 'v2.3.0' },
        },
        include: {
          issue: {
            select: {
              id: true,
              githubNumber: true,
              title: true,
              body: true,
              labels: true,
              repository: {
                select: {
                  name: true,
                  starsCount: true,
                  repoType: true,
                },
              },
            },
          },
        },
      })
    );

    console.log(`  • Found ${pendingScores.length} pending legacy scores to migrate for @${orgLogin}.`);

    if (pendingScores.length === 0) {
      console.log(`  ✅ @${orgLogin} already 100% migrated to V2.3.0.`);
      continue;
    }

    let orgMigrated = 0;

    // Migrate using bounded worker pool (4 workers)
    await runPool(pendingScores, WORKER_CONCURRENCY, async (scoreRecord) => {
      const evaluation = evaluateV2FactorsWithEvidence({
        title: scoreRecord.issue.title,
        body: scoreRecord.issue.body || '',
        labels: scoreRecord.issue.labels || [],
        repoName: scoreRecord.issue.repository.name,
        repoStars: scoreRecord.issue.repository.starsCount,
        repoType: scoreRecord.issue.repository.repoType,
      });

      const newScore = evaluation.compositeScore;

      // Update IssueScore record in PostgreSQL
      await withPrismaRetry(() =>
        prisma.issueScore.update({
          where: { id: scoreRecord.id },
          data: {
            scoringVersion: 'v2.3.0',
            calculatedAt: now,
            technicalDifficulty: evaluation.factors.technicalComplexity,
            codebaseComplexity: evaluation.factors.changeScope,
            issueScope: evaluation.factors.domainSpecialization,
            domainKnowledge: evaluation.factors.testingVerificationEffort,
            expectedImpact: evaluation.factors.problemAmbiguity,
            testingComplexity: evaluation.factors.testingVerificationEffort,
            issueClarity: evaluation.factors.problemAmbiguity,
            maintainerActivity: 5.0,
            compositeScore: newScore,
            reasoning: evaluation.overallReasoning,
          },
        })
      );

      // Update associated Issue rrDifficulty in PostgreSQL
      await withPrismaRetry(() =>
        prisma.issue.update({
          where: { id: scoreRecord.issueId },
          data: {
            rrDifficulty: newScore,
            lastSyncedAt: now,
          },
        })
      );

      orgMigrated++;
      if (orgMigrated % 100 === 0 || orgMigrated === pendingScores.length) {
        console.log(`    Progress @${orgLogin}: ${orgMigrated}/${pendingScores.length} IssueScores migrated to V2.3.0...`);
      }
    });

    totalMigrated += orgMigrated;
    console.log(`  ✅ @${orgLogin} migration completed: ${orgMigrated} IssueScores updated to V2.3.0.\n`);
  }

  // 3. Post-Migration Verification Audit
  console.log('================================================================');
  console.log(' 🔒 POST-MIGRATION VERIFICATION & RE-AUDIT                     ');
  console.log('================================================================\n');

  const postGrafanaRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'grafana' } } }));
  const postGrafanaIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } } }));
  const postGrafanaV23 = await withPrismaRetry(() => prisma.issueScore.count({ where: { issue: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } }, scoringVersion: 'v2.3.0' } }));

  const postSupabaseRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'supabase' } } }));
  const postSupabaseIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } } }));
  const postSupabaseV23 = await withPrismaRetry(() => prisma.issueScore.count({ where: { issue: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } }, scoringVersion: 'v2.3.0' } }));

  console.log('🔒 POST-MIGRATION BASELINE LOCK VERIFICATION:');
  console.log(`  • Grafana  : ${postGrafanaRepos} repos, ${postGrafanaIssues} issues, ${postGrafanaV23} v2.3.0 scores (Target: 590 / 12,526 / 12,526) -> ${postGrafanaRepos === 590 && postGrafanaIssues === 12526 && postGrafanaV23 === 12526 ? '100% UNMUTATED ✅' : 'MUTATED ❌'}`);
  console.log(`  • Supabase : ${postSupabaseRepos} repos, ${postSupabaseIssues} issues, ${postSupabaseV23} v2.3.0 scores (Target: 171 / 1,667 / 1,667) -> ${postSupabaseRepos === 171 && postSupabaseIssues === 1667 && postSupabaseV23 === 1667 ? '100% UNMUTATED ✅' : 'MUTATED ❌'}\n`);

  const globalV23 = await withPrismaRetry(() => prisma.issueScore.count({ where: { scoringVersion: 'v2.3.0' } }));
  const globalV11 = await withPrismaRetry(() => prisma.issueScore.count({ where: { scoringVersion: 'v1.1.0' } }));
  const globalTotalScores = await withPrismaRetry(() => prisma.issueScore.count());

  console.log('================================================================');
  console.log(' 🌐 FINAL GLOBAL SCORING VERSION TOTALS                        ');
  console.log('================================================================');
  console.log(`  • Total Newly Migrated Records             : ${totalMigrated}`);
  console.log(`  • PostgreSQL Total IssueScores             : ${globalTotalScores}`);
  console.log(`  • Total V2.3.0 Scores (100% System)        : ${globalV23} / ${globalTotalScores} -> ${globalV23 === globalTotalScores ? '100% V2.3.0 UNIFIED ✅' : 'MISMATCH ❌'}`);
  console.log(`  • Total Legacy V1.1.0 Scores Remaining     : ${globalV11} (Target: 0) -> ${globalV11 === 0 ? 'CLEAN ✅' : 'REMAINING ❌'}`);
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
