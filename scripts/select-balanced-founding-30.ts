import fs from 'fs';
import path from 'path';
import { VerifiedLiveCandidate } from './discover-live-issues';

const liveFilePath = path.join(process.cwd(), 'scripts', 'data', 'issue-candidates-live.json');
if (!fs.existsSync(liveFilePath)) {
  console.error('❌ issue-candidates-live.json does not exist. Please run discovery first.');
  process.exit(1);
}

const rawData = fs.readFileSync(liveFilePath, 'utf-8');
const candidates: VerifiedLiveCandidate[] = JSON.parse(rawData);

const REPOS = [
  'supabase/supabase',
  'medusajs/medusa',
  'makeplane/plane',
  'twentyhq/twenty',
  'triggerdotdev/trigger.dev',
  'novuhq/novu',
];

const selected30: VerifiedLiveCandidate[] = [];

// For each of the 6 repos, select 5 candidates from the 182 verified live candidates
// Target ~2 to 3 OPEN_PR_IN_PROGRESS per repo and 2 to 3 OPEN_NO_PR per repo to achieve ~15/15 split
REPOS.forEach((repo) => {
  const repoCands = candidates.filter(
    (c) => c.repoFullName.toLowerCase() === repo.toLowerCase() && c.githubState === 'open'
  );

  const prInProgress = repoCands.filter((c) => c.classification === 'OPEN_PR_IN_PROGRESS' || c.openPrCount > 0);
  const noPr = repoCands.filter((c) => c.classification === 'OPEN_NO_PR' && c.openPrCount === 0);

  // Pick up to 2 or 3 PR_IN_PROGRESS
  const pickedPR = prInProgress.slice(0, 3);
  const neededNoPR = 5 - pickedPR.length;
  const pickedNoPR = noPr.slice(0, neededNoPR);

  const combined = [...pickedPR, ...pickedNoPR];
  if (combined.length < 5) {
    const remaining = repoCands.filter((c) => !combined.includes(c));
    combined.push(...remaining.slice(0, 5 - combined.length));
  }

  selected30.push(...combined);
});

console.log('================================================================================================================================================');
console.log('                                                  VERIFIED LIVE GITHUB ISSUE SELECTION (BALANCED 30)                                             ');
console.log('================================================================================================================================================\n');

console.log(
  'Repository'.padEnd(25) +
    ' | Issue #'.padEnd(9) +
    ' | Title'.padEnd(50) +
    ' | GitHub URL'.padEnd(60) +
    ' | State'.padEnd(7) +
    ' | Open PRs'.padEnd(9) +
    ' | Classification'.padEnd(21) +
    ' | Quality'
);
console.log('-'.repeat(190));

selected30.forEach((c) => {
  const truncTitle = c.title.length > 47 ? c.title.slice(0, 44) + '...' : c.title;
  console.log(
    c.repoFullName.padEnd(25) +
      ' | #' +
      c.githubNumber.toString().padEnd(6) +
      ' | ' +
      truncTitle.padEnd(48) +
      ' | ' +
      c.url.padEnd(58) +
      ' | ' +
      c.githubState.padEnd(5) +
      ' | ' +
      c.openPrCount.toString().padEnd(7) +
      ' | ' +
      c.classification.padEnd(19) +
      ' | ' +
      c.quality
  );
});

const totalPrInProg = selected30.filter((c) => c.classification === 'OPEN_PR_IN_PROGRESS' || c.openPrCount > 0).length;
const totalNoPr = selected30.filter((c) => c.classification === 'OPEN_NO_PR' && c.openPrCount === 0).length;

console.log('\n================================================================================================================================================');
console.log(`Total Selected: ${selected30.length} (Exactly 5 per repository across 6 repos)`);
console.log(`Classification Breakdown: OPEN_NO_PR = ${totalNoPr} | OPEN_PR_IN_PROGRESS = ${totalPrInProg}\n`);
