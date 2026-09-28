import { TARGET_ORGANIZATIONS_CONFIG, getOrganizationConfig, getTargetOrganizationLogins } from '../organizations/config';
import { mockDbStore } from '../../../scripts/db-runner';

/**
 * Phase 1 Organization Configuration & Data Model Verification Test Suite.
 */
export async function runOrganizationTests() {
  console.log('\n🏛️ Running Phase 1 Organization Configuration & Model Test Suite...\n');

  let passed = 0;
  const total = 5;

  // TEST 1: Exactly 10 target organizations configured
  try {
    if (TARGET_ORGANIZATIONS_CONFIG.length === 10) {
      console.log('  ✅ [TEST 1 PASSED] Exactly 10 target organizations configured in registry');
      passed++;
    } else {
      console.error('  ❌ [TEST 1 FAILED] Count:', TARGET_ORGANIZATIONS_CONFIG.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 1 ERROR]', err);
  }

  // TEST 2: All 10 requested organization logins present
  try {
    const requiredLogins = [
      'supabase',
      'grafana',
      'cloudflare',
      'appwrite',
      'vercel',
      'temporalio',
      'PostHog',
      'n8n-io',
      'directus',
      'calcom',
    ];

    const currentLogins = getTargetOrganizationLogins();
    const allFound = requiredLogins.every((req) =>
      currentLogins.some((curr) => curr.toLowerCase() === req.toLowerCase())
    );

    if (allFound) {
      console.log('  ✅ [TEST 2 PASSED] All 10 requested organization logins verified (supabase, grafana, cloudflare, appwrite, vercel, temporalio, PostHog, n8n-io, directus, calcom)');
      passed++;
    } else {
      console.error('  ❌ [TEST 2 FAILED] Current logins:', currentLogins);
    }
  } catch (err) {
    console.error('  ❌ [TEST 2 ERROR]', err);
  }

  // TEST 3: Sync capability toggles correctly initialized for all organizations
  try {
    const allValid = TARGET_ORGANIZATIONS_CONFIG.every(
      (org) =>
        org.autoDiscoverRepos === true &&
        org.syncIssues === true &&
        org.syncComments === true &&
        org.syncLabels === true &&
        org.syncPrActivity === true &&
        org.reconciliationEnabled === true
    );

    if (allValid) {
      console.log('  ✅ [TEST 3 PASSED] All sync capability flags (autoDiscoverRepos, syncIssues, syncComments, syncLabels, syncPrActivity, reconciliationEnabled) default to true');
      passed++;
    } else {
      console.error('  ❌ [TEST 3 FAILED] Invalid org flags');
    }
  } catch (err) {
    console.error('  ❌ [TEST 3 ERROR]', err);
  }

  // TEST 4: Organization config lookup function (case-insensitive)
  try {
    const supa = getOrganizationConfig('Supabase');
    const posthog = getOrganizationConfig('posthog');

    if (supa && supa.login === 'supabase' && posthog && posthog.login === 'PostHog') {
      console.log('  ✅ [TEST 4 PASSED] Case-insensitive getOrganizationConfig lookup verified');
      passed++;
    } else {
      console.error('  ❌ [TEST 4 FAILED]', { supa, posthog });
    }
  } catch (err) {
    console.error('  ❌ [TEST 4 ERROR]', err);
  }

  // TEST 5: Mock DB store auto-hydrates organization entities
  try {
    mockDbStore.ensureHydratedSync();
    if (mockDbStore.organizations.length === 10) {
      console.log('  ✅ [TEST 5 PASSED] mockDbStore auto-hydrated 10 organization entities');
      passed++;
    } else {
      console.error('  ❌ [TEST 5 FAILED] mockDbStore org count:', mockDbStore.organizations.length);
    }
  } catch (err) {
    console.error('  ❌ [TEST 5 ERROR]', err);
  }

  console.log(`\n📊 Organization Suite Results: ${passed}/${total} Passed\n`);

  if (passed === total) {
    console.log('🎉 All Phase 1 Organization Tests Passed Successfully!');
    return true;
  } else {
    throw new Error(`Organization tests failed (${passed}/${total} passed)`);
  }
}

if (require.main === module) {
  runOrganizationTests().catch((err) => {
    console.error('Organization test suite error:', err);
    process.exit(1);
  });
}
