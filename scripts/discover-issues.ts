import {
  TARGET_REPOSITORIES,
  discoverIssuesFromGithub,
  loadCandidatesFromFile,
  saveCandidatesToFile,
  upsertCandidate,
  IssueCandidate,
  getCandidateFilePath,
} from '../src/lib/issues/discovery';

async function main() {
  console.log('\n🔍 Starting GitHub Issue Candidate Discovery Pipeline for Repo Rescue V1...\n');
  console.log(`Target Repositories (${TARGET_REPOSITORIES.length}):`);
  TARGET_REPOSITORIES.forEach((r) => console.log(`  - ${r.fullName} (${r.language}, ${r.ecosystem})`));
  console.log('');

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('ℹ️ GITHUB_TOKEN not detected in process.env. Running discovery engine with rate-limit safe fallback pool.\n');
  }

  let candidates = loadCandidatesFromFile();
  const initialCount = candidates.length;
  console.log(`Loaded ${initialCount} existing candidates from ${getCandidateFilePath()}`);

  let newlyDiscovered = 0;

  for (const repoConfig of TARGET_REPOSITORIES) {
    console.log(`📡 Discovering candidate issues for '${repoConfig.fullName}'...`);
    const repoCandidates = await discoverIssuesFromGithub(repoConfig, token);
    console.log(`   Found ${repoCandidates.length} open candidates in '${repoConfig.fullName}'.`);

    for (const cand of repoCandidates) {
      const prevLen = candidates.length;
      candidates = upsertCandidate(candidates, cand);
      if (candidates.length > prevLen) {
        newlyDiscovered++;
      }
    }
  }

  // Save candidates dataset
  saveCandidatesToFile(candidates);
  console.log(`\n💾 Saved ${candidates.length} total candidates to ${getCandidateFilePath()}\n`);

  // Print Summary Table
  console.log('========================================================================');
  console.log('                 REPO RESCUE ISSUE CANDIDATE SUMMARY                    ');
  console.log('========================================================================');

  // Breakdown by Repo
  console.log('\n📌 Candidates by Repository:');
  TARGET_REPOSITORIES.forEach((r) => {
    const repoCands = candidates.filter((c) => c.repoFullName.toLowerCase() === r.fullName.toLowerCase());
    const openNoPr = repoCands.filter((c) => c.classification === 'OPEN_NO_PR').length;
    const openPrProg = repoCands.filter((c) => c.classification === 'OPEN_PR_IN_PROGRESS').length;
    const unverified = repoCands.filter((c) => c.classification === 'UNVERIFIED').length;
    const highQual = repoCands.filter((c) => c.quality === 'HIGH').length;

    console.log(
      `  • ${r.fullName.padEnd(28)} | Total: ${repoCands.length.toString().padStart(2)} | NO_PR: ${openNoPr.toString().padStart(2)} | PR_IN_PROGRESS: ${openPrProg.toString().padStart(2)} | UNVERIFIED: ${unverified.toString().padStart(2)} | HIGH Quality: ${highQual.toString().padStart(2)}`
    );
  });

  // Breakdown by Classification
  const totalNoPr = candidates.filter((c) => c.classification === 'OPEN_NO_PR').length;
  const totalPrProg = candidates.filter((c) => c.classification === 'OPEN_PR_IN_PROGRESS').length;
  const totalUnverified = candidates.filter((c) => c.classification === 'UNVERIFIED').length;
  const totalIneligible = candidates.filter((c) => c.classification === 'INELIGIBLE').length;

  console.log('\n📊 Candidates by Classification:');
  console.log(`  • OPEN • NO PR         : ${totalNoPr}`);
  console.log(`  • OPEN • PR IN PROGRESS: ${totalPrProg}`);
  console.log(`  • UNVERIFIED            : ${totalUnverified}`);
  console.log(`  • INELIGIBLE            : ${totalIneligible}`);

  // Breakdown by Quality
  const totalHigh = candidates.filter((c) => c.quality === 'HIGH').length;
  const totalMed = candidates.filter((c) => c.quality === 'MEDIUM').length;
  const totalLow = candidates.filter((c) => c.quality === 'LOW').length;

  console.log('\n⭐ Candidates by Internal Quality Rating:');
  console.log(`  • HIGH Quality   : ${totalHigh}`);
  console.log(`  • MEDIUM Quality : ${totalMed}`);
  console.log(`  • LOW Quality    : ${totalLow}`);

  console.log('========================================================================');
  console.log(`🎉 Candidate Discovery Pipeline Finished! Total Candidates: ${candidates.length}\n`);
}

main().catch((err) => {
  console.error('❌ Error executing candidate discovery pipeline:', err);
  process.exit(1);
});
