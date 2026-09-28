import fs from 'fs';
import path from 'path';
import { PrismaClient, Role, IssueStatus, PRStatus, ContributionStatus, LedgerTransactionType } from '@prisma/client';
import { calculateRRDifficulty, calculateRRPointsFromScore, SCORING_VERSION } from '../src/lib/scoring';
import { runDatabaseIntegrityTests } from '../src/lib/tests/integrity';
import { loadAndScoreFounding30, REPOSITORY_SEED_DATA } from '../src/lib/issues/ingestion';
import { TARGET_ORGANIZATIONS_CONFIG } from '../src/lib/organizations/config';

// Memory DB store for runtime application & verification suite
class InMemoryDbStore {
  organizations: any[] = [];
  repositories: any[] = [];
  users: any[] = [];
  issues: any[] = [];
  issueScores: any[] = [];
  pullRequests: any[] = [];
  contributions: any[] = [];
  pointsLedger: any[] = [];
  syncAuditLogs: any[] = [];
  isHydrated: boolean = false;

  constructor() {
    this.ensureHydratedSync();
  }

  async clean() {
    this.organizations = [];
    this.repositories = [];
    this.users = [];
    this.issues = [];
    this.issueScores = [];
    this.pullRequests = [];
    this.contributions = [];
    this.pointsLedger = [];
    this.syncAuditLogs = [];
    this.isHydrated = false;
  }

  ensureHydratedSync() {
    // 0. Hydrate Target Organizations Config
    if (this.organizations.length === 0) {
      this.organizations = TARGET_ORGANIZATIONS_CONFIG.map((orgConf, index) => ({
        id: `org-cfg-${index + 1}`,
        githubId: orgConf.githubId || (10000 + index + 1),
        login: orgConf.login,
        name: orgConf.name,
        description: orgConf.description || null,
        avatarUrl: orgConf.avatarUrl || null,
        htmlUrl: orgConf.htmlUrl,
        autoDiscoverRepos: orgConf.autoDiscoverRepos,
        syncIssues: orgConf.syncIssues,
        syncComments: orgConf.syncComments,
        syncLabels: orgConf.syncLabels,
        syncPrActivity: orgConf.syncPrActivity,
        reconciliationEnabled: orgConf.reconciliationEnabled,
        lastDiscoveredAt: null,
        lastSyncedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    if (this.isHydrated && this.issues.length >= 30) return;

    try {
      const dbDumpPath = path.join(process.cwd(), 'scripts', 'data', 'ingested-founding-db.json');
      if (fs.existsSync(dbDumpPath)) {
        const raw = fs.readFileSync(dbDumpPath, 'utf-8');
        const dump = JSON.parse(raw);
        this.repositories = dump.repositories || [];
        this.issues = dump.issues || [];
        this.issueScores = dump.issueScores || [];
        this.users = dump.users && dump.users.length > 0 ? dump.users : [
          { id: 'usr-1', name: 'Alex Chen', githubUsername: 'alexchen-dev', email: 'alex.chen@example.com', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', bio: 'Systems software engineer. Rust & C++ enthusiast.', location: 'San Francisco, CA', company: 'Distributed Systems Inc.', role: Role.CONTRIBUTOR, rrRating: 2420, totalPoints: 0 },
          { id: 'usr-2', name: 'Sarah Jenkins', githubUsername: 'sjenkins-codes', email: 'sarah.j@example.com', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', bio: 'Fullstack TypeScript core contributor.', location: 'London, UK', role: Role.CONTRIBUTOR, rrRating: 2180, totalPoints: 0 },
          { id: 'usr-3', name: 'Devon Vance', githubUsername: 'dvance', email: 'devon.vance@example.com', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', bio: 'AI Infrastructure & PyTorch performance tuning.', location: 'Seattle, WA', role: Role.CONTRIBUTOR, rrRating: 1950, totalPoints: 0 },
          { id: 'usr-4', name: 'Elena Rostova', githubUsername: 'erostova', email: 'elena.r@example.com', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', bio: 'Compiler engineer working on AST optimizations.', location: 'Berlin, DE', role: Role.CONTRIBUTOR, rrRating: 1820, totalPoints: 0 },
          { id: 'usr-5', name: 'Marcus Vance', githubUsername: 'mvance-k8s', email: 'marcus.v@example.com', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', bio: 'Kubernetes SIG-Node contributor.', location: 'Austin, TX', role: Role.CONTRIBUTOR, rrRating: 1680, totalPoints: 0 },
          { id: 'usr-6', name: 'Octocat Contributor', githubUsername: 'octocat', email: 'octocat@github.com', image: 'https://avatars.githubusercontent.com/u/583231?v=4', bio: 'Open-source contributor account.', role: Role.CONTRIBUTOR, rrRating: 1500, totalPoints: 0 },
        ];
        this.isHydrated = true;
        return;
      }

      const foundingSet = loadAndScoreFounding30();

      // 1. Repositories
      const repoMap = new Map<string, any>();
      REPOSITORY_SEED_DATA.forEach((r) => repoMap.set(r.id, r));
      foundingSet.forEach((item) => repoMap.set(item.repository.id, item.repository));
      this.repositories = Array.from(repoMap.values());

      // 2. Users (~6 users)
      if (this.users.length === 0) {
        this.users = [
          { id: 'usr-1', name: 'Alex Chen', githubUsername: 'alexchen-dev', email: 'alex.chen@example.com', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', bio: 'Systems software engineer. Rust & C++ enthusiast.', location: 'San Francisco, CA', company: 'Distributed Systems Inc.', role: Role.CONTRIBUTOR, rrRating: 2420, totalPoints: 0 },
          { id: 'usr-2', name: 'Sarah Jenkins', githubUsername: 'sjenkins-codes', email: 'sarah.j@example.com', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', bio: 'Fullstack TypeScript core contributor.', location: 'London, UK', role: Role.CONTRIBUTOR, rrRating: 2180, totalPoints: 0 },
          { id: 'usr-3', name: 'Devon Vance', githubUsername: 'dvance', email: 'devon.vance@example.com', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', bio: 'AI Infrastructure & PyTorch performance tuning.', location: 'Seattle, WA', role: Role.CONTRIBUTOR, rrRating: 1950, totalPoints: 0 },
          { id: 'usr-4', name: 'Elena Rostova', githubUsername: 'erostova', email: 'elena.r@example.com', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', bio: 'Compiler engineer working on AST optimizations.', location: 'Berlin, DE', role: Role.CONTRIBUTOR, rrRating: 1820, totalPoints: 0 },
          { id: 'usr-5', name: 'Marcus Vance', githubUsername: 'mvance-k8s', email: 'marcus.v@example.com', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', bio: 'Kubernetes SIG-Node contributor.', location: 'Austin, TX', role: Role.CONTRIBUTOR, rrRating: 1680, totalPoints: 0 },
          { id: 'usr-6', name: 'Octocat Contributor', githubUsername: 'octocat', email: 'octocat@github.com', image: 'https://avatars.githubusercontent.com/u/583231?v=4', bio: 'Open-source contributor account.', role: Role.CONTRIBUTOR, rrRating: 1500, totalPoints: 0 },
        ];
      }

      // 3. Founding Issues & Scores
      const issueMap = new Map<string, any>();
      const scoreMap = new Map<string, any>();

      foundingSet.forEach((item) => {
        issueMap.set(item.issue.id, item.issue);
        scoreMap.set(item.score.id, item.score);
      });

      this.issues = Array.from(issueMap.values());
      this.issueScores = Array.from(scoreMap.values());
      this.isHydrated = true;
    } catch (e) {
      console.warn('[db-runner] Warning: Could not auto-hydrate founding dataset:', e);
    }
  }
}

export const mockDbStore = new InMemoryDbStore();

export async function seedTestFixtures() {
  await mockDbStore.clean();
  mockDbStore.ensureHydratedSync();

  // Seed sample pull requests & verified contributions for resolved/tested items
  if (mockDbStore.issues.length > 0 && mockDbStore.pullRequests.length === 0) {
    const targetRepo = mockDbStore.repositories[0];
    const targetUser = mockDbStore.users[1]; // sjenkins-codes
    const firstIssue = mockDbStore.issues[0];

    const prCounter = 9500;
    const prId = `pr-${prCounter}`;
    const contribId = `contrib-1`;
    const rrPoints = calculateRRPointsFromScore(firstIssue.rrDifficulty);

    const pr = {
      id: prId,
      githubId: prCounter,
      githubNumber: 9500,
      repositoryId: targetRepo.id,
      userId: targetUser.id,
      issueId: firstIssue.id,
      title: `Fixes #${firstIssue.githubNumber} ${firstIssue.title}`,
      url: `https://github.com/${targetRepo.fullName}/pull/9500`,
      status: PRStatus.MERGED,
      githubState: 'closed',
      isMerged: true,
      mergedAt: new Date().toISOString(),
      mergedBy: 'maintainer-bot',
      openedAt: new Date().toISOString(),
      latestActivityAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };

    const contribution = {
      id: contribId,
      userId: targetUser.id,
      issueId: firstIssue.id,
      pullRequestId: pr.id,
      status: ContributionStatus.MERGED_AND_AUDITED,
      rrPoints: rrPoints,
      verifiedAt: new Date().toISOString(),
    };

    const ledgerEntry = {
      id: `ledger-1`,
      userId: targetUser.id,
      type: LedgerTransactionType.ISSUE_SOLVED,
      amount: rrPoints,
      balanceAfter: rrPoints,
      reason: `Rescued ${targetRepo.fullName}#${firstIssue.githubNumber} (${firstIssue.rrDifficulty.toFixed(1)} RR Difficulty × 10)`,
      contributionId: contribId,
      createdAt: new Date().toISOString(),
    };

    mockDbStore.pullRequests.push(pr);
    mockDbStore.contributions.push(contribution);
    mockDbStore.pointsLedger.push(ledgerEntry);
    targetUser.totalPoints = rrPoints;
  }
}

export async function seedAndTestDb() {
  await seedTestFixtures();
  await runDatabaseIntegrityTests();
}

if (require.main === module) {
  seedAndTestDb()
    .then(() => console.log('🎉 Database Verification Complete!'))
    .catch((err) => {
      console.error('❌ Error during execution:', err);
      process.exit(1);
    });
}
