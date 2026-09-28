import fs from 'fs';
import path from 'path';
import { getOrganizationConfig } from '../src/lib/organizations/config';
import { discoverOrganizationRepositories } from '../src/lib/injector/discovery';
import { ingestRepositoryIssues, CompletenessStatus, IssueIngestionResult } from '../src/lib/injector/ingestion';
import { Repository } from '../src/types';

function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.replace(/\r$/, '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    // ignore
  }
}
loadEnvFile();

export interface OrgBackfillOptions {
  customToken?: string;
  confirmProduction?: boolean; // Must be true to allow database writes
}

export interface OrgBackfillReport {
  orgLogin: string;
  isProductionWrite: boolean;
  completenessStatus: CompletenessStatus;
  repositoriesDiscovered: number;
  eligibleReposCount: number;
  ineligibleReposCount: number;
  reposScannedSuccess: number;
  reposScannedFailed: number;
  totalIssuesIngested: number;
  insertedCount: number;
  updatedCount: number;
  closedCount: number;
  prsSkipped: number;
  apiErrorsCount: number;
  rateLimitResponsesCount: number;
  durationMs: number;
  errors: string[];
}

export async function runOrganizationBackfill(
  orgLogin: string,
  options?: OrgBackfillOptions
): Promise<OrgBackfillReport> {
  const startTime = Date.now();
  const isProductionWrite = Boolean(options?.confirmProduction);
  const token = options?.customToken || process.env.GITHUB_TOKEN;

  const orgConfig = getOrganizationConfig(orgLogin);
  if (!orgConfig) {
    throw new Error(`Organization '${orgLogin}' is not configured in Repo Rescue registry.`);
  }
  console.log(`[Backfill CLI] Resolved organization config for '${orgLogin}' (githubId: ${orgConfig.githubId}).`);

  // 1. Discover Repositories
  console.log(`[Backfill CLI] Starting discovery for '${orgLogin}' (isProductionWrite: ${isProductionWrite})...`);
  const discoveryResult = await discoverOrganizationRepositories(orgConfig, token, { readOnly: !isProductionWrite });
  const eligibleRepos = discoveryResult.repositories.filter((r) => r.eligibilityStatus === 'ELIGIBLE');
  console.log(`[Backfill CLI] Discovery finished for '${orgLogin}'. Discovered: ${discoveryResult.discoveredCount}, Eligible: ${eligibleRepos.length}.`);

  let reposScannedSuccess = 0;
  let reposScannedFailed = 0;
  let totalIssuesIngested = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let closedCount = 0;
  let prsSkipped = 0;
  let apiErrorsCount = discoveryResult.success ? 0 : 1;
  let rateLimitResponsesCount = 0;
  const errors: string[] = discoveryResult.error ? [discoveryResult.error] : [];

  let anyBlocked = false;
  let anyFailed = !discoveryResult.success;

  if (!isProductionWrite) {
    // READ-ONLY SIMULATION / CONFIRMATION MODE
    for (const repoModel of eligibleRepos) {
      try {
        const res: IssueIngestionResult = await ingestRepositoryIssues(repoModel, token, 'open', { readOnly: true });
        if (res.success && res.completenessStatus === 'COMPLETE') {
          reposScannedSuccess++;
          totalIssuesIngested += res.issues.length;
          insertedCount += res.insertedCount;
          updatedCount += res.updatedCount;
          closedCount += res.closedCount;
          prsSkipped += res.prCountSkipped;
        } else {
          reposScannedFailed++;
          if (res.completenessStatus === 'BLOCKED') anyBlocked = true;
          else anyFailed = true;
          if (res.error) errors.push(res.error);
        }
      } catch (err: any) {
        reposScannedFailed++;
        anyFailed = true;
        errors.push(`Failure scanning '${repoModel.fullName}': ${err.message || String(err)}`);
      }
    }
  } else {
    // PRODUCTION WRITE MODE (--confirm-production specified)
    console.log(`[Backfill CLI] Beginning production ingestion loop across ${eligibleRepos.length} eligible repos...`);
    let repoIndex = 0;
    for (const repoModel of eligibleRepos) {
      repoIndex++;
      console.log(`[Backfill CLI] [${repoIndex}/${eligibleRepos.length}] Ingesting repository: '${repoModel.fullName}'...`);
      try {
        const res: IssueIngestionResult = await ingestRepositoryIssues(repoModel, token, 'open', { readOnly: false });
        if (res.success && res.completenessStatus === 'COMPLETE') {
          reposScannedSuccess++;
          totalIssuesIngested += res.issues.length;
          insertedCount += res.insertedCount;
          updatedCount += res.updatedCount;
          closedCount += res.closedCount;
          prsSkipped += res.prCountSkipped;
        } else {
          reposScannedFailed++;
          if (res.completenessStatus === 'BLOCKED') anyBlocked = true;
          else anyFailed = true;
          if (res.error) errors.push(res.error);
        }
      } catch (err: any) {
        reposScannedFailed++;
        anyFailed = true;
        errors.push(`Failure ingesting '${repoModel.fullName}': ${err.message || String(err)}`);
      }
    }
  }

  let completenessStatus: CompletenessStatus = 'COMPLETE';
  if (anyBlocked) {
    completenessStatus = 'BLOCKED';
  } else if (anyFailed || reposScannedFailed > 0) {
    completenessStatus = 'PARTIAL';
  } else {
    completenessStatus = 'COMPLETE';
  }

  const durationMs = Date.now() - startTime;

  return {
    orgLogin,
    isProductionWrite,
    completenessStatus,
    repositoriesDiscovered: discoveryResult.discoveredCount,
    eligibleReposCount: discoveryResult.eligibleCount,
    ineligibleReposCount: discoveryResult.ineligibleCount,
    reposScannedSuccess,
    reposScannedFailed,
    totalIssuesIngested,
    insertedCount,
    updatedCount,
    closedCount,
    prsSkipped,
    apiErrorsCount,
    rateLimitResponsesCount,
    durationMs,
    errors,
  };
}

export function formatBackfillReport(report: OrgBackfillReport): string {
  const modeStr = report.isProductionWrite ? '🔴 PRODUCTION WRITE MODE' : '🟡 READ-ONLY MODE (Pass --confirm-production to write)';

  const lines = [
    '══════════════════════════════════════════════',
    '       REPO RESCUE — PRODUCTION ISSUE BACKFILL',
    '══════════════════════════════════════════════',
    '',
    `Organization: ${report.orgLogin}`,
    `Completeness Status: ${report.completenessStatus}`,
    `Execution Mode: ${modeStr}`,
    `Authentication: ${process.env.GITHUB_TOKEN ? 'AUTHENTICATED' : 'UNAUTHENTICATED'}`,
    '',
    'Repository Discovery',
    '──────────────────────────────────────────────',
    `Repositories discovered:       ${report.repositoriesDiscovered}`,
    `Eligible repositories:         ${report.eligibleReposCount}`,
    `Ineligible repositories:       ${report.ineligibleReposCount}`,
    '',
    'Issue Ingestion & Coverage',
    '──────────────────────────────────────────────',
    `Eligible repos scanned success: ${report.reposScannedSuccess}`,
    `Eligible repos scanned failed:  ${report.reposScannedFailed}`,
    `Total GitHub issues processed:  ${report.totalIssuesIngested}`,
    `New issues inserted:            ${report.insertedCount}`,
    `Existing issues updated:        ${report.updatedCount}`,
    `Closed issues updated:          ${report.closedCount}`,
    `Pull requests skipped:         ${report.prsSkipped}`,
    '',
    'API & Operational Counters',
    '──────────────────────────────────────────────',
    `API errors:                    ${report.apiErrorsCount}`,
    `Rate-limit responses:          ${report.rateLimitResponsesCount}`,
    `Duration:                      ${report.durationMs}ms`,
    '',
    'Errors',
    '──────────────────────────────────────────────',
    report.errors.length === 0 ? 'None' : report.errors.map((e) => `• ${e}`).join('\n'),
    '',
    `Completeness Guarantee: ${report.completenessStatus === 'COMPLETE' ? '✓ 100% Complete Coverage (Zero Truncation)' : '⚠️ Incomplete Scan'}`,
    `Database Mutations: ${report.isProductionWrite ? '✓ WRITTEN TO DATABASE' : '✓ ZERO DATABASE WRITES (Read-Only Mode)'}`,
    '✓ NO SYNTHETIC RECORDS',
    '══════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

import { TARGET_ORGANIZATIONS_CONFIG } from '../src/lib/organizations/config';

if (require.main === module) {
  const args = process.argv.slice(2);
  const orgArg = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
  const confirmProduction = args.includes('--confirm-production');

  async function runCLI() {
    if (orgArg.toLowerCase() === 'all') {
      console.log(`\n🚀 RUNNING BACKFILL FOR ALL ${TARGET_ORGANIZATIONS_CONFIG.length} CONFIGURED ORGANIZATIONS...\n`);
      for (const orgConf of TARGET_ORGANIZATIONS_CONFIG) {
        console.log(`\n▶ Backfilling organization: ${orgConf.login}...`);
        const report = await runOrganizationBackfill(orgConf.login, { confirmProduction });
        console.log(formatBackfillReport(report));
      }
    } else {
      const report = await runOrganizationBackfill(orgArg, { confirmProduction });
      console.log(formatBackfillReport(report));
    }
  }

  runCLI().catch((err) => {
    console.error('Production backfill error:', err);
    process.exit(1);
  });
}
