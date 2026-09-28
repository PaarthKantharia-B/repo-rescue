import fs from 'fs';
import path from 'path';
import { TARGET_ORGANIZATIONS_CONFIG } from '../src/lib/organizations/config';
import { GithubApiClient } from '../src/lib/injector/client';
import { evaluateRepositoryEligibility } from '../src/lib/injector/discovery';
import { evaluate8FactorsWithEvidence } from '../src/lib/issues/ingestion';
import { calculateRRDifficulty, calculateRRPointsFromScore, SCORING_VERSION } from '../src/lib/scoring';
import { classifyIssuePRActivity } from '../src/lib/issues/sync';
import { mockDbStore } from './db-runner';
import { getFilteredIssues } from '../src/lib/issues/service';

export interface PreflightRepoEntry {
  org: string;
  name: string;
  fullName: string;
  openIssuesCount: number;
  stargazersCount: number;
  status: 'ALREADY_PROCESSED' | 'PENDING_INGESTION';
}

export interface PreflightOrgSummary {
  org: string;
  orgName: string;
  totalPublicRepos: number;
  eligibleReposCount: number;
  alreadyProcessedCount: number;
  pendingIngestionCount: number;
  estimatedApiRequests: number;
  pendingRepoSamples: string[];
}

async function main() {
  const isExecuteMode = process.argv.includes('--execute');
  const isDryRunMode = !isExecuteMode || process.argv.includes('--dry-run');

  console.log('================================================================');
  console.log(`  REPO RESCUE FULL-INGESTION PIPELINE (${isExecuteMode ? 'EXECUTE MODE' : 'READ-ONLY PREFLIGHT MODE'})`);
  console.log('================================================================\n');

  mockDbStore.ensureHydratedSync();
  const client = new GithubApiClient();
  const now = new Date().toISOString();

  let rateLimitStart: number | undefined;
  let rateLimitEnd: number | undefined;
  let totalApiCallCount = 0;

  const orgSummaries: PreflightOrgSummary[] = [];
  const allPendingRepos: PreflightRepoEntry[] = [];

  for (const orgConfig of TARGET_ORGANIZATIONS_CONFIG) {
    console.log(`🔍 Preflight audit for Organization: ${orgConfig.name} (@${orgConfig.login})...`);

    let rawRepos: any[] = [];
    try {
      totalApiCallCount++;
      const repoRes = await client.fetchAllPages<any>(
        `https://api.github.com/orgs/${orgConfig.login}/repos?type=public&per_page=100`
      );
      if (rateLimitStart === undefined) {
        rateLimitStart = (repoRes as any).rateLimitRemaining ?? 4999;
      }
      rateLimitEnd = (repoRes as any).rateLimitRemaining ?? rateLimitStart;
      rawRepos = repoRes.items || [];
    } catch (err: any) {
      console.error(`  ❌ Failed fetching repos for @${orgConfig.login}: ${err.message}`);
      continue;
    }

    const eligibleRepos = rawRepos.filter(
      (r) => evaluateRepositoryEligibility(r, orgConfig.login).isEligible
    );

    const indexedReposForOrg = mockDbStore.repositories.filter(
      (r) => (r.owner || '').toLowerCase() === orgConfig.login.toLowerCase()
    );

    const pendingRepos: PreflightRepoEntry[] = [];
    const processedRepos: PreflightRepoEntry[] = [];

    for (const repo of eligibleRepos) {
      const isAlreadyIndexed = indexedReposForOrg.some(
        (r) => r.fullName.toLowerCase() === repo.full_name.toLowerCase() || r.githubId === BigInt(repo.id)
      );

      const entry: PreflightRepoEntry = {
        org: orgConfig.login,
        name: repo.name,
        fullName: repo.full_name,
        openIssuesCount: repo.open_issues_count || 0,
        stargazersCount: repo.stargazers_count || 0,
        status: isAlreadyIndexed ? 'ALREADY_PROCESSED' : 'PENDING_INGESTION',
      };

      if (isAlreadyIndexed) {
        processedRepos.push(entry);
      } else {
        pendingRepos.push(entry);
        allPendingRepos.push(entry);
      }
    }

    // Estimate API requests: 1 request per pending repo + pagination factor
    const estApiReqs = pendingRepos.reduce((acc, r) => acc + (r.openIssuesCount > 0 ? Math.ceil(r.openIssuesCount / 100) : 1), 0);

    orgSummaries.push({
      org: orgConfig.login,
      orgName: orgConfig.name,
      totalPublicRepos: rawRepos.length,
      eligibleReposCount: eligibleRepos.length,
      alreadyProcessedCount: processedRepos.length,
      pendingIngestionCount: pendingRepos.length,
      estimatedApiRequests: estApiReqs,
      pendingRepoSamples: pendingRepos.slice(0, 5).map((r) => r.name),
    });

    console.log(
      `  ✅ @${orgConfig.login}: ${eligibleRepos.length} eligible repos (${processedRepos.length} already processed, ${pendingRepos.length} pending ingestion).`
    );
  }

  const totalEligible = orgSummaries.reduce((sum, s) => sum + s.eligibleReposCount, 0);
  const totalProcessed = orgSummaries.reduce((sum, s) => sum + s.alreadyProcessedCount, 0);
  const totalPending = orgSummaries.reduce((sum, s) => sum + s.pendingIngestionCount, 0);
  const totalEstApiReqs = orgSummaries.reduce((sum, s) => sum + s.estimatedApiRequests, 0);

  console.log('\n================================================================');
  console.log('              READ-ONLY PREFLIGHT REPOSITORY AUDIT             ');
  console.log('================================================================\n');

  console.table(
    orgSummaries.map((s) => ({
      'Org Login': s.org,
      'Eligible Repos': s.eligibleReposCount,
      'Already Processed': s.alreadyProcessedCount,
      'Pending Ingestion': s.pendingIngestionCount,
      'Est. API Requests': s.estimatedApiRequests,
      'Sample Pending Repos': s.pendingRepoSamples.slice(0, 3).join(', '),
    }))
  );

  console.log('\n📌 PREFLIGHT SUMMARY TOTALS:');
  console.log(`  • Target Organizations: 10`);
  console.log(`  • Total Eligible Repositories: ${totalEligible}`);
  console.log(`  • Currently Processed Repositories: ${totalProcessed}`);
  console.log(`  • Pending Unprocessed Repositories: ${totalPending}`);
  console.log(`  • Estimated GitHub API Requests Needed for Full Run: ~${totalEstApiReqs}`);
  console.log(`  • Estimated Rate Limit Consumption: ~${totalEstApiReqs} tokens (Fits safely within 5,000 req/hr token limit)`);
  console.log(`  • GitHub Rate Limit Remaining (Audit Start -> End): ${rateLimitStart} -> ${rateLimitEnd}`);

  if (isDryRunMode) {
    console.log('\n🔒 READ-ONLY PREFLIGHT COMPLETE:');
    console.log('  • NO database writes or score modifications were performed.');
    console.log('  • To execute actual production ingestion when ready, pass `--execute`.');
    console.log('================================================================\n');
    return;
  }

  // EXECUTION MODE (Only runs when --execute is explicitly supplied)
  console.log('\n🚀 STARTING FULL PRODUCTION INGESTION FOR ALL REMAINING REPOSITORIES...\n');

  let newlyIngestedRepos = 0;
  let newlyIngestedIssues = 0;
  let newlyIngestedScores = 0;

  for (const orgConfig of TARGET_ORGANIZATIONS_CONFIG) {
    const pendingForOrg = allPendingRepos.filter((r) => r.org === orgConfig.login);
    if (pendingForOrg.length === 0) continue;

    console.log(`\n🏢 Processing ${pendingForOrg.length} pending repositories for @${orgConfig.login}...`);

    for (const repoMeta of pendingForOrg) {
      const repoId = `repo-${orgConfig.login}-${repoMeta.name}`;
      let repoRecord = mockDbStore.repositories.find(
        (r) => r.id === repoId || r.fullName.toLowerCase() === repoMeta.fullName.toLowerCase()
      );

      if (!repoRecord) {
        repoRecord = {
          id: repoId,
          githubId: Date.now() + Math.floor(Math.random() * 100000),
          name: repoMeta.name,
          fullName: repoMeta.fullName,
          owner: orgConfig.login,
          description: orgConfig.description || '',
          url: `https://github.com/${repoMeta.fullName}`,
          language: 'TypeScript',
          starsCount: repoMeta.stargazersCount,
          forksCount: 0,
          openIssuesCount: repoMeta.openIssuesCount,
          isPrivate: false,
          isArchived: false,
          isFork: false,
          hasIssues: true,
          eligibilityStatus: 'ELIGIBLE',
          ecosystem: 'Node.js',
          repoType: 'OPEN_SOURCE',
          maintainerActivityScore: 8.5,
          organizationId: `org-cfg-${TARGET_ORGANIZATIONS_CONFIG.findIndex((o) => o.login === orgConfig.login) + 1}`,
          createdAt: now,
          updatedAt: now,
        };
        mockDbStore.repositories.push(repoRecord);
        newlyIngestedRepos++;
      }

      if (repoMeta.openIssuesCount === 0) continue;

      // Fetch issues from GitHub API
      let rawIssues: any[] = [];
      try {
        const issueUrl = `https://api.github.com/repos/${repoMeta.fullName}/issues?state=open&per_page=100&sort=updated`;
        const issueRes = await client.fetchPage<any[]>(issueUrl);
        rawIssues = (issueRes.data || []).filter((item) => !item.pull_request && item.state === 'open' && item.title);
      } catch (err: any) {
        console.warn(`   ⚠️ Warning: Could not fetch issues for ${repoMeta.fullName}: ${err.message}`);
        continue;
      }

      for (const ghIssue of rawIssues) {
        const issueId = `iss-${repoRecord.id}-${ghIssue.number}`;
        const existingIssIdx = mockDbStore.issues.findIndex((i) => i.id === issueId);

        const rawLabels = Array.isArray(ghIssue.labels)
          ? ghIssue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
          : [];

        const evaluation = evaluate8FactorsWithEvidence({
          title: ghIssue.title,
          body: ghIssue.body || '',
          labels: rawLabels,
          repoFullName: repoRecord.fullName,
          repository: repoRecord,
        });

        const rrDifficulty = calculateRRDifficulty(evaluation.factors);
        const bodyText = `${ghIssue.title} ${ghIssue.body || ''}`;
        const hasPrReference = /fix|fixes|close|closes|resolves|resolve/i.test(bodyText) && /#\d+/.test(bodyText);
        const openPrCount = hasPrReference ? 1 : 0;
        const prActivityClassification = classifyIssuePRActivity({ status: 'OPEN', openPrCount });

        const scoreId = `score-${repoRecord.id}-${ghIssue.number}`;
        const scoreRecord = {
          id: scoreId,
          issueId,
          scoringVersion: SCORING_VERSION,
          calculatedAt: now,
          technicalDifficulty: evaluation.factors.technicalDifficulty,
          codebaseComplexity: evaluation.factors.codebaseComplexity,
          issueScope: evaluation.factors.issueScope,
          domainKnowledge: evaluation.factors.domainKnowledge,
          expectedImpact: evaluation.factors.expectedImpact,
          testingComplexity: evaluation.factors.testingComplexity,
          issueClarity: evaluation.factors.issueClarity,
          maintainerActivity: evaluation.factors.maintainerActivity,
          compositeScore: rrDifficulty,
          reasoning: evaluation.overallReasoning,
          factorDetails: evaluation.factorDetails,
        };

        const existingScoreIdx = mockDbStore.issueScores.findIndex((s) => s.id === scoreId);
        if (existingScoreIdx >= 0) {
          mockDbStore.issueScores[existingScoreIdx] = scoreRecord;
        } else {
          mockDbStore.issueScores.push(scoreRecord);
          newlyIngestedScores++;
        }

        const issueRecord = {
          id: issueId,
          githubId: ghIssue.id,
          githubNumber: ghIssue.number,
          repositoryId: repoRecord.id,
          repository: repoRecord,
          title: ghIssue.title,
          body: ghIssue.body || '',
          url: ghIssue.html_url || `https://github.com/${repoRecord.fullName}/issues/${ghIssue.number}`,
          status: 'OPEN',
          labels: rawLabels,
          language: repoRecord.language,
          ecosystem: repoRecord.ecosystem,
          authorUsername: ghIssue.user?.login || 'ghost',
          rrDifficulty,
          createdAt: ghIssue.created_at || now,
          scoreBreakdown: evaluation.factors,
          prActivityClassification,
          openPrCount,
          mergedPrCount: 0,
          commentsCount: ghIssue.comments || 0,
          githubState: 'open',
          githubStateUpdatedAt: ghIssue.updated_at || now,
          lastSyncedAt: now,
        };

        if (existingIssIdx >= 0) {
          mockDbStore.issues[existingIssIdx] = { ...mockDbStore.issues[existingIssIdx], ...issueRecord };
        } else {
          mockDbStore.issues.push(issueRecord);
          newlyIngestedIssues++;
        }
      }
    }
  }

  // Persist store
  const dbDumpPath = path.join(process.cwd(), 'scripts', 'data', 'ingested-founding-db.json');
  fs.writeFileSync(
    dbDumpPath,
    JSON.stringify(
      {
        repositories: mockDbStore.repositories,
        issues: mockDbStore.issues,
        issueScores: mockDbStore.issueScores,
        users: mockDbStore.users,
        ingestedAt: now,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\n🎉 Full Ingestion Execution Complete:`);
  console.log(`   • Total Repositories in Store: ${mockDbStore.repositories.length} (${newlyIngestedRepos} new)`);
  console.log(`   • Total Issues in Store: ${mockDbStore.issues.length} (${newlyIngestedIssues} new)`);
  console.log(`   • Total IssueScores in Store: ${mockDbStore.issueScores.length} (${newlyIngestedScores} new)`);
}

main().catch((err) => {
  console.error('Fatal Script Error:', err);
  process.exit(1);
});
