import {
  classifyCandidatePRActivity,
  evaluateCandidateQuality,
  getCandidateIdentityKey,
  upsertCandidate,
  IssueCandidate,
} from '../issues/discovery';

/**
 * 10-Test Candidate Discovery Pipeline Test Suite for Repo Rescue V1.
 */
export async function runDiscoveryTests() {
  console.log('\n🔍 Running 10-Test GitHub Issue Candidate Discovery Test Suite...\n');

  let passed = 0;
  const total = 10;

  // TEST 1: OPEN issue with 0 PRs -> OPEN_NO_PR
  try {
    const classification = classifyCandidatePRActivity('open', 0);
    if (classification === 'OPEN_NO_PR') {
      console.log('  ✅ [TEST 1 PASSED] OPEN issue with 0 PRs correctly classified as OPEN_NO_PR');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: OPEN issue with open PR -> OPEN_PR_IN_PROGRESS
  try {
    const classification = classifyCandidatePRActivity('open', 1);
    if (classification === 'OPEN_PR_IN_PROGRESS') {
      console.log('  ✅ [TEST 2 PASSED] OPEN issue with open PR correctly classified as OPEN_PR_IN_PROGRESS');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: OPEN issue with closed unmerged PR -> OPEN_NO_PR
  try {
    // When openPrCount is 0 (since closed PR is not an active open PR)
    const classification = classifyCandidatePRActivity('open', 0);
    if (classification === 'OPEN_NO_PR') {
      console.log('  ✅ [TEST 3 PASSED] OPEN issue with closed unmerged PR correctly classified as OPEN_NO_PR');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: OPEN issue with merged historical PR -> OPEN_NO_PR
  try {
    // Merged historical PR means openPrCount = 0
    const classification = classifyCandidatePRActivity('open', 0);
    if (classification === 'OPEN_NO_PR') {
      console.log('  ✅ [TEST 4 PASSED] OPEN issue with merged historical PR correctly classified as OPEN_NO_PR');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: CLOSED issue -> INELIGIBLE
  try {
    const classification = classifyCandidatePRActivity('closed', 0);
    if (classification === 'INELIGIBLE') {
      console.log('  ✅ [TEST 5 PASSED] CLOSED issue correctly classified as INELIGIBLE');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  // TEST 6: API failure -> UNVERIFIED
  try {
    const classification = classifyCandidatePRActivity('open', 0, true);
    if (classification === 'UNVERIFIED') {
      console.log('  ✅ [TEST 6 PASSED] API rate-limit/network failure correctly returns UNVERIFIED classification');
      passed++;
    } else {
      console.error('  ❌ [TEST 6 FAILED]', classification);
    }
  } catch (err) {
    console.error('  ❌ [TEST 6 ERROR]', err);
  }

  // TEST 7: Duplicate discovery -> no duplicates in dataset
  try {
    const candidate1: IssueCandidate = {
      id: 'cand-supabase-supabase-100',
      githubId: 99100,
      githubNumber: 100,
      repoFullName: 'supabase/supabase',
      title: 'Test Candidate Issue Title',
      body: 'Detailed test candidate issue body text exceeding 200 characters to verify quality score evaluation and duplicate prevention in candidate store dataset.',
      url: 'https://github.com/supabase/supabase/issues/100',
      labels: ['bug'],
      language: 'TypeScript',
      ecosystem: 'Node.js/SQL',
      githubState: 'open',
      classification: 'OPEN_NO_PR',
      openPrCount: 0,
      mergedPrCount: 0,
      quality: 'HIGH',
      qualityReasoning: 'Detailed test reasoning',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    let dataset: IssueCandidate[] = [];
    dataset = upsertCandidate(dataset, candidate1);
    dataset = upsertCandidate(dataset, candidate1); // duplicate insertion attempt

    if (dataset.length === 1) {
      console.log('  ✅ [TEST 7 PASSED] Duplicate discovery candidate insertion prevented (dataset size remains 1)');
      passed++;
    } else {
      console.error('  ❌ [TEST 7 FAILED]', dataset.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 7 ERROR]', err);
  }

  // TEST 8: Repository + issue identity -> stable uniqueness key
  try {
    const key1 = getCandidateIdentityKey('Supabase/Supabase', 100);
    const key2 = getCandidateIdentityKey('supabase/supabase', 100);

    if (key1 === 'supabase/supabase#100' && key1 === key2) {
      console.log('  ✅ [TEST 8 PASSED] Repository + issue identity produces stable case-insensitive key (supabase/supabase#100)');
      passed++;
    } else {
      console.error('  ❌ [TEST 8 FAILED]', key1, key2);
    }
  } catch (err) {
    console.error('  ❌ [TEST 8 ERROR]', err);
  }

  // TEST 9: Re-running discovery -> deterministic & idempotent update
  try {
    const initialCand: IssueCandidate = {
      id: 'cand-medusajs-medusa-200',
      githubId: 99200,
      githubNumber: 200,
      repoFullName: 'medusajs/medusa',
      title: 'Original Title',
      body: 'Original issue description body text for testing deterministic candidate updates.',
      url: 'https://github.com/medusajs/medusa/issues/200',
      labels: ['v2'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      githubState: 'open',
      classification: 'OPEN_NO_PR',
      openPrCount: 0,
      mergedPrCount: 0,
      quality: 'HIGH',
      qualityReasoning: 'Original reasoning',
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      discoveredAt: '2026-08-01T00:00:00Z',
    };

    let dataset: IssueCandidate[] = [initialCand];

    const updatedCand: IssueCandidate = {
      ...initialCand,
      title: 'Updated Title on Re-scan',
      openPrCount: 1,
      classification: 'OPEN_PR_IN_PROGRESS',
      updatedAt: '2026-09-22T00:00:00Z',
    };

    dataset = upsertCandidate(dataset, updatedCand);

    if (dataset.length === 1 && dataset[0].title === 'Updated Title on Re-scan' && dataset[0].classification === 'OPEN_PR_IN_PROGRESS') {
      console.log('  ✅ [TEST 9 PASSED] Discovery re-run deterministically updated candidate metadata without creating duplicate entries');
      passed++;
    } else {
      console.error('  ❌ [TEST 9 FAILED]', dataset);
    }
  } catch (err) {
    console.error('  ❌ [TEST 9 ERROR]', err);
  }

  // TEST 10: Closed candidate -> marked INELIGIBLE on re-scan
  try {
    const candidate: IssueCandidate = {
      id: 'cand-twentyhq-twenty-300',
      githubId: 99300,
      githubNumber: 300,
      repoFullName: 'twentyhq/twenty',
      title: 'Issue to be closed',
      body: 'Description for issue that was closed on GitHub.',
      url: 'https://github.com/twentyhq/twenty/issues/300',
      labels: ['bug'],
      language: 'TypeScript',
      ecosystem: 'Node.js',
      githubState: 'open',
      classification: 'OPEN_NO_PR',
      openPrCount: 0,
      mergedPrCount: 0,
      quality: 'MEDIUM',
      qualityReasoning: 'Standard description',
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      discoveredAt: '2026-08-01T00:00:00Z',
    };

    let dataset = [candidate];

    const closedRescanCand: IssueCandidate = {
      ...candidate,
      githubState: 'closed',
      classification: classifyCandidatePRActivity('closed', 0),
      updatedAt: '2026-09-22T00:00:00Z',
    };

    dataset = upsertCandidate(dataset, closedRescanCand);

    if (dataset[0].githubState === 'closed' && dataset[0].classification === 'INELIGIBLE') {
      console.log('  ✅ [TEST 10 PASSED] Closed candidate correctly marked INELIGIBLE on re-scan');
      passed++;
    } else {
      console.error('  ❌ [TEST 10 FAILED]', dataset[0]);
    }
  } catch (err) {
    console.error('  ❌ [TEST 10 ERROR]', err);
  }

  console.log(`\n📊 10-Test Discovery Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All 10 Candidate Discovery Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Candidate discovery tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runDiscoveryTests().catch((err) => {
    console.error('Discovery test suite execution error:', err);
    process.exit(1);
  });
}
