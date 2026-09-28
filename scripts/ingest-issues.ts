import fs from 'fs';
import path from 'path';
import { loadAndScoreFounding30 } from '../src/lib/issues/ingestion';
import { mockDbStore } from './db-runner';
import { calculateRRPointsFromScore } from '../src/lib/scoring';

async function main() {
  console.log('\n🚀 Starting Repo Rescue V1 Founding 30 Issue Ingestion Pipeline...\n');

  const foundingSet = loadAndScoreFounding30();
  console.log(`Loaded and scored ${foundingSet.length} founding issues from verified live GitHub candidate dataset.`);

  // 1. Ingest Repositories idempotently
  let reposAdded = 0;
  foundingSet.forEach((item) => {
    const existing = mockDbStore.repositories.find((r) => r.id === item.repository.id);
    if (!existing) {
      mockDbStore.repositories.push(item.repository);
      reposAdded++;
    }
  });

  // 2. Ingest Issues & Scores idempotently
  let issuesAdded = 0;
  let scoresAdded = 0;

  foundingSet.forEach((item) => {
    const existingIssIdx = mockDbStore.issues.findIndex((i) => i.id === item.issue.id);
    if (existingIssIdx >= 0) {
      mockDbStore.issues[existingIssIdx] = { ...mockDbStore.issues[existingIssIdx], ...item.issue };
    } else {
      mockDbStore.issues.push(item.issue);
      issuesAdded++;
    }

    const existingScoreIdx = mockDbStore.issueScores.findIndex((s) => s.id === item.score.id);
    if (existingScoreIdx >= 0) {
      mockDbStore.issueScores[existingScoreIdx] = { ...mockDbStore.issueScores[existingScoreIdx], ...item.score };
    } else {
      mockDbStore.issueScores.push(item.score);
      scoresAdded++;
    }
  });

  // Persist to scripts/data/ingested-founding-db.json so all processes (including Next.js server) auto-hydrate the exact same records
  const dbDumpPath = path.join(process.cwd(), 'scripts', 'data', 'ingested-founding-db.json');
  const dir = path.dirname(dbDumpPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dbDump = {
    repositories: mockDbStore.repositories,
    issues: mockDbStore.issues,
    issueScores: mockDbStore.issueScores,
    users: mockDbStore.users,
    ingestedAt: new Date().toISOString(),
  };

  fs.writeFileSync(dbDumpPath, JSON.stringify(dbDump, null, 2), 'utf-8');

  console.log(`\n✅ Database Ingestion Complete & Persisted:`);
  console.log(`   - Repositories: ${mockDbStore.repositories.length} total (${reposAdded} new)`);
  console.log(`   - Issues: ${mockDbStore.issues.length} total (${issuesAdded} new)`);
  console.log(`   - IssueScores: ${mockDbStore.issueScores.length} total (${scoresAdded} new)`);
  console.log(`   - Persisted Store: ${dbDumpPath}\n`);

  console.log('================================================================================================================================');
  console.log('                                        REPO RESCUE V1 FOUNDING 30 SCORED ISSUES                                         ');
  console.log('================================================================================================================================\n');

  console.log(
    'Repository'.padEnd(25) +
      ' | Issue #'.padEnd(9) +
      ' | Title'.padEnd(46) +
      ' | RR Difficulty'.padEnd(16) +
      ' | RR Points'.padEnd(12) +
      ' | Classification'.padEnd(21) +
      ' | Open PRs'
  );
  console.log('-'.repeat(150));

  foundingSet.forEach((item) => {
    const iss = item.issue;
    const truncTitle = iss.title.length > 43 ? iss.title.slice(0, 40) + '...' : iss.title;
    const points = calculateRRPointsFromScore(iss.rrDifficulty);

    console.log(
      item.repository.fullName.padEnd(25) +
        ' | #' +
        iss.githubNumber.toString().padEnd(6) +
        ' | ' +
        truncTitle.padEnd(44) +
        ' | ' +
        iss.rrDifficulty.toFixed(1).padEnd(14) +
        ' | ' +
        ('+' + points + ' pts').padEnd(10) +
        ' | ' +
        iss.prActivityClassification.padEnd(19) +
        ' | ' +
        iss.openPrCount
    );
  });

  const totalPointsPool = foundingSet.reduce((sum, item) => sum + calculateRRPointsFromScore(item.issue.rrDifficulty), 0);

  console.log('\n================================================================================================================================');
  console.log(`🎉 Ingestion Pipeline Finished! Total Problem Set: 30 Issues | Total RR Points Pool: ${totalPointsPool} Points\n`);
}

main().catch((err) => {
  console.error('❌ Error executing founding issue ingestion script:', err);
  process.exit(1);
});
