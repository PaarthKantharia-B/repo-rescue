import { TARGET_ORGANIZATIONS_CONFIG } from '../src/lib/organizations/config';
import { GithubApiClient } from '../src/lib/injector/client';
import { evaluateRepositoryEligibility } from '../src/lib/injector/discovery';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';
import { calculateRRDifficultyV2, SCORING_VERSION_V2_3 } from '../src/lib/scoring';
import { prisma, withPrismaRetry } from '../src/lib/prisma';

const client = new GithubApiClient();

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

const DB_CONCURRENCY_LIMIT = 4; // Conservative worker pool (4 active workers max out of 15 pool limit)

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
  console.log('   🚀 RESUMABLE PRODUCTION INGESTION (BOUNDED 4-WORKER POOL)   ');
  console.log('================================================================\n');

  const now = new Date();

  // Baseline Lock Verification
  const preGrafanaRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'grafana' } } }));
  const preGrafanaIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } } }));
  const preSupabaseRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'supabase' } } }));
  const preSupabaseIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } } }));

  console.log('🔒 PRODUCTION SAFETY LOCK VERIFICATION:');
  console.log(`  • Baseline Grafana:  ${preGrafanaRepos} repos, ${preGrafanaIssues} issues`);
  console.log(`  • Baseline Supabase: ${preSupabaseRepos} repos, ${preSupabaseIssues} issues`);
  console.log(`  • Worker Pool Concurrency: ${DB_CONCURRENCY_LIMIT} concurrent DB workers max (Connection Pool: 15)\n`);

  let totalIngestedRepos = 0;
  let totalIngestedIssues = 0;
  let totalIngestedScores = 0;

  for (const orgLogin of TARGET_8_ORGS) {
    const orgConfig = TARGET_ORGANIZATIONS_CONFIG.find((o) => o.login.toLowerCase() === orgLogin.toLowerCase());
    if (!orgConfig) {
      console.error(`❌ Missing config for organization @${orgLogin}`);
      continue;
    }

    console.log(`\n🏢 Processing Organization: ${orgConfig.name} (@${orgConfig.login})...`);

    // 1. Upsert Organization record in PostgreSQL
    const dbOrg = await withPrismaRetry(() =>
      prisma.organization.upsert({
        where: { login: orgConfig.login },
        create: {
          githubId: BigInt(orgConfig.githubId || Date.now()),
          login: orgConfig.login,
          name: orgConfig.name,
          description: orgConfig.description || null,
          htmlUrl: orgConfig.htmlUrl,
          autoDiscoverRepos: true,
          syncIssues: true,
          syncComments: true,
          syncLabels: true,
          syncPrActivity: true,
          reconciliationEnabled: true,
          lastDiscoveredAt: now,
          lastSyncedAt: now,
        },
        update: {
          lastDiscoveredAt: now,
          lastSyncedAt: now,
        },
      })
    );

    // 2. Discover Public Repositories via GitHub API
    let rawRepos: any[] = [];
    try {
      const repoRes = await client.fetchAllPages<any>(
        `https://api.github.com/orgs/${orgConfig.login}/repos?type=public&per_page=100`
      );
      rawRepos = repoRes.items || [];
    } catch (err: any) {
      console.error(`  ❌ Failed fetching repos for @${orgConfig.login}: ${err.message}`);
      continue;
    }

    const eligibleRepos = rawRepos.filter(
      (r) => evaluateRepositoryEligibility(r, orgConfig.login).isEligible
    );

    // Query existing repos and issues in PostgreSQL for this org to ensure idempotency & fast resume
    const existingDbRepos = await withPrismaRetry(() =>
      prisma.repository.findMany({
        where: { owner: { mode: 'insensitive', equals: orgConfig.login } },
        select: { id: true, fullName: true, githubId: true },
      })
    );

    const existingRepoMap = new Map<string, string>();
    existingDbRepos.forEach((r) => existingRepoMap.set(r.fullName.toLowerCase(), r.id));

    const existingIssues = await withPrismaRetry(() =>
      prisma.issue.findMany({
        where: { repository: { owner: { mode: 'insensitive', equals: orgConfig.login } } },
        select: { id: true, repositoryId: true, githubNumber: true, scores: { select: { id: true } } },
      })
    );

    const existingIssueMap = new Set<string>();
    existingIssues.forEach((i) => {
      if (i.scores) {
        existingIssueMap.add(`${i.repositoryId}:${i.githubNumber}`);
      }
    });

    console.log(
      `  ✅ @${orgConfig.login}: ${eligibleRepos.length} eligible repos (${existingDbRepos.length} already in DB, ${existingIssues.length} issues indexed). Ingesting with ${DB_CONCURRENCY_LIMIT} workers...`
    );

    let orgReposProcessed = 0;
    let orgIssuesIngested = 0;

    // Process repositories with bounded concurrency pool (4 workers max)
    await runPool(eligibleRepos, DB_CONCURRENCY_LIMIT, async (ghRepo, idx) => {
      try {
        // Upsert Repository record in PostgreSQL
        const dbRepo = await withPrismaRetry(() =>
          prisma.repository.upsert({
            where: { fullName: ghRepo.full_name },
            create: {
              githubId: BigInt(ghRepo.id),
              name: ghRepo.name,
              fullName: ghRepo.full_name,
              owner: orgConfig.login,
              description: ghRepo.description || '',
              url: ghRepo.html_url || `https://github.com/${ghRepo.full_name}`,
              language: ghRepo.language || 'TypeScript',
              starsCount: ghRepo.stargazers_count || 0,
              forksCount: ghRepo.forks_count || 0,
              openIssuesCount: ghRepo.open_issues_count || 0,
              isPrivate: Boolean(ghRepo.private),
              isArchived: Boolean(ghRepo.archived),
              isFork: Boolean(ghRepo.fork),
              hasIssues: Boolean(ghRepo.has_issues ?? true),
              eligibilityStatus: 'ELIGIBLE',
              ecosystem: 'Node.js',
              repoType: 'OPEN_SOURCE',
              maintainerActivityScore: 8.5,
              organizationId: dbOrg.id,
              lastSyncedAt: now,
            },
            update: {
              starsCount: ghRepo.stargazers_count || 0,
              forksCount: ghRepo.forks_count || 0,
              openIssuesCount: ghRepo.open_issues_count || 0,
              lastSyncedAt: now,
            },
          })
        );

        orgReposProcessed++;
        totalIngestedRepos++;

        if (ghRepo.open_issues_count === 0) return;

        // Fetch open issues from GitHub API
        let rawIssues: any[] = [];
        try {
          const issueUrl = `https://api.github.com/repos/${ghRepo.full_name}/issues?state=open&per_page=100&sort=updated`;
          const issueRes = await client.fetchPage<any[]>(issueUrl);
          rawIssues = (issueRes.data || []).filter((item) => !item.pull_request && item.state === 'open' && item.title);
        } catch (err: any) {
          console.warn(`    ⚠️ Could not fetch issues for ${ghRepo.full_name}: ${err.message}`);
          return;
        }

        const formattedRepoForScoring = {
          id: dbRepo.id,
          githubId: Number(dbRepo.githubId),
          name: dbRepo.name,
          fullName: dbRepo.fullName,
          owner: dbRepo.owner,
          description: dbRepo.description || '',
          url: dbRepo.url,
          language: dbRepo.language || 'TypeScript',
          starsCount: dbRepo.starsCount,
          forksCount: dbRepo.forksCount,
          openIssuesCount: dbRepo.openIssuesCount,
          ecosystem: dbRepo.ecosystem || 'Node.js',
          repoType: dbRepo.repoType || 'INFRA',
          maintainerActivityScore: dbRepo.maintainerActivityScore ?? 5.0,
        };

        for (const ghIssue of rawIssues) {
          const issueKey = `${dbRepo.id}:${ghIssue.number}`;

          // Idempotency: Skip issue if already in DB with an existing score
          if (existingIssueMap.has(issueKey)) {
            continue;
          }

          const rawLabels = Array.isArray(ghIssue.labels)
            ? ghIssue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
            : [];

          // Grade issue using V2.3.0 Evidence Accumulation Engine
          const evaluation = evaluateV2FactorsWithEvidence({
            title: ghIssue.title,
            body: ghIssue.body || '',
            labels: rawLabels,
            repoName: dbRepo.name,
            repoStars: dbRepo.starsCount,
            repoType: dbRepo.repoType,
          });

          const rrDifficulty = evaluation.compositeScore;
          const bodyText = `${ghIssue.title} ${ghIssue.body || ''}`;
          const hasPrRef = /fix|fixes|close|closes|resolves|resolve/i.test(bodyText) && /#\d+/.test(bodyText);
          const openPrCount = hasPrRef ? 1 : 0;

          // Upsert Issue in PostgreSQL
          const dbIssue = await withPrismaRetry(() =>
            prisma.issue.upsert({
              where: {
                repositoryId_githubNumber: { repositoryId: dbRepo.id, githubNumber: ghIssue.number },
              },
              create: {
                githubId: BigInt(ghIssue.id),
                githubNumber: ghIssue.number,
                repositoryId: dbRepo.id,
                title: ghIssue.title,
                body: ghIssue.body || '',
                url: ghIssue.html_url || `https://github.com/${dbRepo.fullName}/issues/${ghIssue.number}`,
                status: 'OPEN',
                labels: rawLabels,
                language: dbRepo.language || 'TypeScript',
                ecosystem: dbRepo.ecosystem || 'Node.js',
                authorUsername: ghIssue.user?.login || 'ghost',
                rrDifficulty,
                githubState: 'open',
                githubStateUpdatedAt: ghIssue.updated_at ? new Date(ghIssue.updated_at) : now,
                lastSyncedAt: now,
                openPrCount,
                mergedPrCount: 0,
                commentsCount: ghIssue.comments || 0,
                createdAt: ghIssue.created_at ? new Date(ghIssue.created_at) : now,
              },
              update: {
                title: ghIssue.title,
                body: ghIssue.body || '',
                status: 'OPEN',
                labels: rawLabels,
                rrDifficulty,
                githubState: 'open',
                githubStateUpdatedAt: ghIssue.updated_at ? new Date(ghIssue.updated_at) : now,
                lastSyncedAt: now,
                commentsCount: ghIssue.comments || 0,
              },
            })
          );

          // Upsert IssueScore in PostgreSQL
          await withPrismaRetry(() =>
            prisma.issueScore.upsert({
              where: { issueId: dbIssue.id },
              create: {
                issueId: dbIssue.id,
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
                compositeScore: rrDifficulty,
                reasoning: evaluation.overallReasoning,
              },
              update: {
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
                compositeScore: rrDifficulty,
                reasoning: evaluation.overallReasoning,
              },
            })
          );

          existingIssueMap.add(issueKey);
          orgIssuesIngested++;
          totalIngestedIssues++;
          totalIngestedScores++;
        }

        if ((orgReposProcessed) % 25 === 0 || orgReposProcessed === eligibleRepos.length) {
          console.log(`    Progress @${orgConfig.login}: ${orgReposProcessed}/${eligibleRepos.length} repos processed (${orgIssuesIngested} issues ingested so far)`);
        }
      } catch (repoErr: any) {
        console.error(`  ❌ Error processing repo ${ghRepo.full_name}: ${repoErr.message || String(repoErr)}`);
      }
    });

    console.log(`  ✅ Completed @${orgConfig.login}: ${orgReposProcessed} repositories and ${orgIssuesIngested} new issues synced to PostgreSQL.`);
  }

  // Verification of production lock after completion
  const postGrafanaRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'grafana' } } }));
  const postGrafanaIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'grafana' } } } }));
  const postSupabaseRepos = await withPrismaRetry(() => prisma.repository.count({ where: { owner: { mode: 'insensitive', equals: 'supabase' } } }));
  const postSupabaseIssues = await withPrismaRetry(() => prisma.issue.count({ where: { repository: { owner: { mode: 'insensitive', equals: 'supabase' } } } }));

  console.log('\n================================================================');
  console.log('   🎉 PRODUCTION INGESTION COMPLETE - SUMMARY AUDIT            ');
  console.log('================================================================\n');

  console.log(`  • Total Repositories Processed : ${totalIngestedRepos}`);
  console.log(`  • New Issues Synced in Run     : ${totalIngestedIssues}`);
  console.log(`  • New IssueScores Synced in Run: ${totalIngestedScores}\n`);

  console.log('🔒 GRAFANA & SUPABASE PRODUCTION INTEGRITY VERIFICATION:');
  console.log(`  • Grafana Repos:  ${preGrafanaRepos} -> ${postGrafanaRepos} (${postGrafanaRepos === preGrafanaRepos ? 'UNMUTATED ✅' : 'MUTATED ❌'})`);
  console.log(`  • Grafana Issues: ${preGrafanaIssues} -> ${postGrafanaIssues} (${postGrafanaIssues === preGrafanaIssues ? 'UNMUTATED ✅' : 'MUTATED ❌'})`);
  console.log(`  • Supabase Repos:  ${preSupabaseRepos} -> ${postSupabaseRepos} (${postSupabaseRepos === preSupabaseRepos ? 'UNMUTATED ✅' : 'MUTATED ❌'})`);
  console.log(`  • Supabase Issues: ${preSupabaseIssues} -> ${postSupabaseIssues} (${postSupabaseIssues === preSupabaseIssues ? 'UNMUTATED ✅' : 'MUTATED ❌'})`);
}

main()
  .catch((e) => {
    console.error('Fatal production ingestion error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
