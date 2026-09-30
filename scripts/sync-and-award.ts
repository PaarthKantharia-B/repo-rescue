import { prisma } from '../src/lib/prisma';
import { getLeaderboard } from '../src/lib/leaderboard/service';
import { extractLinkedIssueNumbers } from '../src/lib/contributions/verify';
import { GithubApiClient } from '../src/lib/injector/client';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';

export interface SyncAwardOptions {
  targetUsernames?: string[];
  forceAll?: boolean;
}

export async function runRescueSync(options: SyncAwardOptions = {}) {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('  ⚡ REPO RESCUE HIGH-SPEED SCORING & LEADERBOARD SYNC SYSTEM ⚡ ');
  console.log('================================================================\n');

  const client = new GithubApiClient();

  // 1. Fetch target users
  const userFilter = options.targetUsernames?.length
    ? { githubUsername: { in: options.targetUsernames, mode: 'insensitive' as const } }
    : { githubUsername: { not: null } };

  const users = await prisma.user.findMany({
    where: userFilter,
    select: { id: true, githubUsername: true, name: true, totalPoints: true },
  });

  if (users.length === 0) {
    console.log('⚠️ No matching registered users found in system.');
    return;
  }

  console.log(`📋 Target Users Loaded: ${users.length}`);

  let newlyAwardedCount = 0;
  let totalNewlyAwardedPoints = 0;
  const processedPRsSummary: { username: string; prNum: number; repo: string; issueNum: number; points: number; difficulty: number }[] = [];

  // 2. Discover GitHub PRs for target users
  for (const user of users) {
    if (!user.githubUsername || user.githubUsername === 'ghost') continue;

    console.log(`\n🔍 Searching GitHub API for merged PRs by @${user.githubUsername}...`);
    let searchItems: any[] = [];
    try {
      const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(`type:pr author:${user.githubUsername}`)}&per_page=50`;
      const res = await client.fetchPage<{ total_count: number; items: any[] }>(searchUrl);
      searchItems = res.data?.items || [];
    } catch (e: any) {
      console.warn(`Warning searching PRs for @${user.githubUsername}: ${e.message}`);
    }

    for (const item of searchItems) {
      const repoParts = item.repository_url?.replace('https://api.github.com/repos/', '').split('/');
      if (!repoParts || repoParts.length !== 2) continue;
      const [ownerLogin, repoName] = repoParts;
      const repoFullName = `${ownerLogin}/${repoName}`;

      // Fetch full PR details
      let fullPR: any;
      try {
        const prRes = await client.fetchPage<any>(`https://api.github.com/repos/${repoFullName}/pulls/${item.number}`);
        fullPR = prRes.data;
      } catch (e) {
        fullPR = item;
      }

      const isMerged = Boolean(fullPR.merged || fullPR.merged_at || item.pull_request?.merged_at);
      if (!isMerged) continue;

      // Index repository if missing
      const dbRepo = await prisma.repository.upsert({
        where: { fullName: repoFullName },
        create: {
          githubId: BigInt(fullPR.base?.repo?.id || Date.now() + Math.floor(Math.random() * 1000000)),
          name: repoName,
          fullName: repoFullName,
          owner: ownerLogin,
          description: fullPR.base?.repo?.description || '',
          url: `https://github.com/${repoFullName}`,
          language: fullPR.base?.repo?.language || 'TypeScript',
          starsCount: fullPR.base?.repo?.stargazers_count || 0,
          forksCount: fullPR.base?.repo?.forks_count || 0,
          openIssuesCount: fullPR.base?.repo?.open_issues_count || 0,
          eligibilityStatus: 'ELIGIBLE',
          ecosystem: fullPR.base?.repo?.language || 'TypeScript',
          repoType: 'OPEN_SOURCE',
          maintainerActivityScore: 8.5,
        },
        update: {},
      });

      // Resolve linked issue or score issue using V2.3.0 formula
      const linkedNums = extractLinkedIssueNumbers(fullPR.title || '', fullPR.body || '');
      let matchedIssue: any = null;

      if (linkedNums.length > 0) {
        matchedIssue = await prisma.issue.findFirst({
          where: { repositoryId: dbRepo.id, githubNumber: { in: linkedNums } },
        });
      }

      if (!matchedIssue) {
        const issueNum = linkedNums.length > 0 ? linkedNums[0] : fullPR.number;
        const issueTitle = linkedNums.length > 0 ? `Resolved Issue #${issueNum}: ${fullPR.title}` : fullPR.title;
        const issueBody = fullPR.body || fullPR.title;

        const evaluation = evaluateV2FactorsWithEvidence({
          title: issueTitle,
          body: issueBody,
          labels: Array.isArray(fullPR.labels) ? fullPR.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) : [],
          repoName: dbRepo.name,
          repoStars: dbRepo.starsCount,
          repoType: dbRepo.repoType,
        });

        const rrDifficulty = evaluation.compositeScore;

        matchedIssue = await prisma.issue.upsert({
          where: { repositoryId_githubNumber: { repositoryId: dbRepo.id, githubNumber: issueNum } },
          create: {
            githubId: BigInt(fullPR.id || Date.now() + Math.floor(Math.random() * 1000000)),
            githubNumber: issueNum,
            repositoryId: dbRepo.id,
            title: issueTitle,
            body: issueBody,
            url: `https://github.com/${dbRepo.fullName}/issues/${issueNum}`,
            status: 'RESOLVED',
            language: dbRepo.language,
            ecosystem: dbRepo.ecosystem,
            authorUsername: fullPR.user?.login || user.githubUsername,
            rrDifficulty,
            githubState: 'closed',
            lastSyncedAt: new Date(),
          },
          update: { rrDifficulty, status: 'RESOLVED' },
        });

        await prisma.issueScore.upsert({
          where: { issueId: matchedIssue.id },
          create: {
            issueId: matchedIssue.id,
            scoringVersion: 'v2.3.0',
            calculatedAt: new Date(),
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
          update: { compositeScore: rrDifficulty },
        });
      }

      const rrPoints = Math.round(matchedIssue.rrDifficulty * 10);
      const now = new Date();

      // Upsert PullRequest
      const dbPR = await prisma.pullRequest.upsert({
        where: { githubId: BigInt(fullPR.id || item.id) },
        create: {
          id: `pr-${fullPR.id || item.id}`,
          githubId: BigInt(fullPR.id || item.id),
          githubNumber: fullPR.number,
          repositoryId: dbRepo.id,
          userId: user.id,
          issueId: matchedIssue.id,
          title: fullPR.title,
          url: fullPR.html_url || `https://github.com/${dbRepo.fullName}/pull/${fullPR.number}`,
          status: 'MERGED',
          githubState: 'closed',
          isMerged: true,
          openedAt: fullPR.created_at ? new Date(fullPR.created_at) : now,
          closedAt: fullPR.closed_at ? new Date(fullPR.closed_at) : now,
          mergedAt: fullPR.merged_at ? new Date(fullPR.merged_at) : now,
          mergedBy: fullPR.merged_by?.login || ownerLogin,
          lastSyncedAt: now,
        },
        update: { status: 'MERGED', isMerged: true, issueId: matchedIssue.id },
      });

      // Award Points if not already audited
      const existingContrib = await prisma.contribution.findFirst({
        where: { userId: user.id, issueId: matchedIssue.id },
      });

      if (existingContrib && existingContrib.status === 'MERGED_AND_AUDITED') {
        continue;
      }

      const contribution = await prisma.contribution.upsert({
        where: { userId_issueId: { userId: user.id, issueId: matchedIssue.id } },
        create: {
          userId: user.id,
          issueId: matchedIssue.id,
          pullRequestId: dbPR.id,
          status: 'MERGED_AND_AUDITED',
          rrPoints,
          verifiedAt: now,
        },
        update: {
          pullRequestId: dbPR.id,
          status: 'MERGED_AND_AUDITED',
          rrPoints,
          verifiedAt: now,
        },
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { totalPoints: { increment: rrPoints } },
      });

      await prisma.pointsLedger.create({
        data: {
          userId: user.id,
          type: 'ISSUE_SOLVED',
          amount: rrPoints,
          balanceAfter: updatedUser.totalPoints,
          reason: `Rescued ${dbRepo.fullName}#${matchedIssue.githubNumber} via PR #${fullPR.number} (${matchedIssue.rrDifficulty.toFixed(1)} RR Difficulty × 10)`,
          contributionId: contribution.id,
          createdAt: now,
        },
      });

      newlyAwardedCount++;
      totalNewlyAwardedPoints += rrPoints;
      processedPRsSummary.push({
        username: user.githubUsername,
        prNum: fullPR.number,
        repo: dbRepo.fullName,
        issueNum: matchedIssue.githubNumber,
        points: rrPoints,
        difficulty: matchedIssue.rrDifficulty,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  // Output Summary Report
  console.log('\n================================================================');
  console.log('                  NEWLY AWARDED CONTRIBUTIONS                   ');
  console.log('================================================================\n');

  if (processedPRsSummary.length === 0) {
    console.log('✨ All merged PRs for target users were already verified and awarded points!');
  } else {
    console.table(
      processedPRsSummary.map((p) => ({
        User: `@${p.username}`,
        'PR #': `#${p.prNum}`,
        Repository: p.repo,
        'Issue #': `#${p.issueNum}`,
        'RR Difficulty': p.difficulty.toFixed(1),
        'Points Awarded': `+${p.points} pts`,
      }))
    );
  }

  // Official Live Global Leaderboard
  console.log('\n================================================================');
  console.log('                 OFFICIAL UPDATED GLOBAL LEADERBOARD            ');
  console.log('================================================================\n');

  const lb = await getLeaderboard({ page: 1, pageSize: 50 });
  console.log(`Total Contributors Ranked: ${lb.totalContributors}\n`);

  console.table(
    lb.entries.map((e) => ({
      Rank: `#${e.rank}`,
      Contributor: e.name,
      Username: `@${e.githubUsername}`,
      Points: `${e.totalPoints} pts`,
      Rescued: e.rescuedCount,
      'Avg Difficulty': e.avgDifficulty,
      'Peak Difficulty': e.peakDifficulty,
      Language: e.primaryLanguage,
    }))
  );

  console.log('\n================================================================');
  console.log(` ⚡ SPEED SYNC COMPLETED IN ${durationMs}ms`);
  console.log(` • Newly Verified PRs: ${newlyAwardedCount}`);
  console.log(` • Total Points Awarded: ${totalNewlyAwardedPoints} RR Points`);
  console.log('================================================================\n');
}

// CLI Execution Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  let targetUsernames: string[] | undefined;

  const usersArgIdx = args.findIndex((a) => a === '--users' || a === '-u');
  if (usersArgIdx !== -1 && args[usersArgIdx + 1]) {
    targetUsernames = args[usersArgIdx + 1].split(',').map((u) => u.trim()).filter(Boolean);
  }

  runRescueSync({ targetUsernames })
    .catch((err) => {
      console.error('Fatal Sync Error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
