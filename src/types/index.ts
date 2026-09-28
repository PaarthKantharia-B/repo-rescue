export type RRTier = 'easy' | 'medium' | 'hard' | 'expert' | 'grandmaster';

export type IssuePRClassification = 'OPEN_NO_PR' | 'OPEN_PR_IN_PROGRESS';

export interface IssueScoreFactors {
  technicalDifficulty: number; // 0.0 - 10.0
  codebaseComplexity: number;
  issueScope: number;
  domainKnowledge: number;
  expectedImpact: number;
  testingComplexity: number;
  issueClarity: number;
  maintainerActivity: number;
}

export interface IssueScoreFactorsV2 {
  technicalComplexity: number;       // 0.0 - 10.0 (weight 0.35)
  changeScope: number;                // 0.0 - 10.0 (weight 0.25)
  domainSpecialization: number;       // 0.0 - 10.0 (weight 0.15)
  testingVerificationEffort: number; // 0.0 - 10.0 (weight 0.15)
  problemAmbiguity: number;           // 0.0 - 10.0 (weight 0.10)
}

export type EvidenceType = 'observed' | 'inferred';
export type EvidenceConfidence = 'high' | 'medium' | 'low';

export interface FactorEvidenceDetail {
  score: number;
  reasoning: string;
  signals?: Record<string, any>;
  evidenceType: EvidenceType;
  confidence: EvidenceConfidence;
}

export type IssueFactorDetails = Record<keyof IssueScoreFactors, FactorEvidenceDetail>;

export interface IssueScore {
  id: string;
  issueId: string;
  scoringVersion: string;
  calculatedAt: string;
  compositeScore: number;
  factors: IssueScoreFactors;
  factorDetails?: IssueFactorDetails;
  reasoning?: string;

  // Historical audit comparison
  previousScore?: number;
  previousFactors?: IssueScoreFactors;
  previousScoringVersion?: string;
}

export type RepositoryEligibilityStatus = 
  | 'ELIGIBLE'
  | 'INELIGIBLE_FORK'
  | 'INELIGIBLE_ARCHIVED'
  | 'INELIGIBLE_NO_ISSUES'
  | 'INELIGIBLE_PRIVATE'
  | 'INELIGIBLE_INACCESSIBLE';

export interface OrganizationConfig {
  githubId?: number;
  login: string; // e.g. "supabase", "grafana", "cloudflare"
  name: string;
  description?: string;
  avatarUrl?: string;
  htmlUrl: string;
  
  // Organization Sync Capability Toggles
  autoDiscoverRepos: boolean;
  syncIssues: boolean;
  syncComments: boolean;
  syncLabels: boolean;
  syncPrActivity: boolean;
  reconciliationEnabled: boolean;
}

export interface Organization extends OrganizationConfig {
  id: string;
  githubId: number;
  lastDiscoveredAt?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SyncAuditLog {
  id: string;
  organizationId?: string;
  repositoryId?: string;
  issueId?: string;
  eventType: string; // "ORG_DISCOVERED", "REPO_DISCOVERED", "BACKFILL_ISSUE", "WEBHOOK_ISSUE", "RECONCILIATION"
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'COMPLETE' | 'PARTIAL' | 'BLOCKED';
  completenessStatus?: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'FAILED';
  changesSummary?: string;
  gradingRan?: boolean;
  gradingScore?: number;
  errorMessage?: string;
  createdAt: string;
}

export interface Repository {
  id: string;
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  description: string;
  url: string;
  language: string;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  ecosystem: string;
  repoType: string;
  maintainerActivityScore: number; // 0.0 - 10.0

  // Injector Organization & Eligibility metadata
  organizationId?: string;
  isPrivate?: boolean;
  isArchived?: boolean;
  isFork?: boolean;
  hasIssues?: boolean;
  eligibilityStatus?: RepositoryEligibilityStatus;
  eligibilityReason?: string;
  lastSyncedAt?: string;
  syncState?: SyncSyncStatus;
}

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RETRYING' | 'CANCELLED';
export type SyncSyncStatus = 'SYNCED' | 'SYNCING' | 'STALE' | 'FAILED' | 'NEVER_SYNCED';

export interface SyncJob {
  id: string;
  jobType: 'ORG_SYNC' | 'REPO_SYNC' | 'FULL_SYNC';
  organizationLogin?: string;
  repositoryFullName?: string;
  repositoryId?: string;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  lastHeartbeatAt?: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  recordsExamined: number;
  recordsChanged: number;
  durationMs?: number;
  createdAt: string;
}

export interface RepositoryLock {
  repositoryFullName: string;
  jobId: string;
  acquiredAt: string;
  expiresAt: string;
  heartbeatAt: string;
}

export interface SyncHealthInfo {
  lastSuccessfulSync?: string;
  lastAttemptedSync?: string;
  runningJobsCount: number;
  failedJobsCount: number;
  retryingJobsCount: number;
  lockedRepositoriesCount: number;
  lockedRepositories: string[];
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  lastError?: string;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

export interface OrchestratorConfig {
  syncIntervalMinutes: number;
  reconciliationIntervalMinutes: number;
  maxConcurrentRepositories: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  leaseDurationMs: number;
  customToken?: string;
}

export interface Issue {
  id: string;
  githubId: number;
  githubNumber: number;
  repository: Repository;
  title: string;
  body: string;
  url: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  labels: string[];
  language: string;
  ecosystem: string;
  authorUsername: string;
  rrDifficulty: number; // 0.0 - 10.0
  createdAt: string;
  scoreBreakdown?: IssueScoreFactors;

  // PR Synchronization & Activity Classification
  prActivityClassification?: IssuePRClassification;
  openPrCount?: number;
  mergedPrCount?: number;
  latestPrActivityAt?: string;
  githubStateUpdatedAt?: string;
  lastSyncedAt?: string;
  isDeleted?: boolean;
}

export interface Contributor {
  id: string;
  name: string;
  githubUsername: string;
  image: string;
  bio?: string;
  totalPoints: number;
  rrRating: number;
  rank: number;
  rankTitle: string; // e.g. "Grandmaster", "Master", "Candidate Master", "Specialist"
  issuesRescued: number;
  primaryLanguage: string;
}

export interface Contribution {
  id: string;
  userId: string;
  issueId: string;
  issue: Issue;
  pullRequestUrl: string;
  rrPoints: number;
  verifiedAt: string;
  status: 'CLAIMED' | 'IN_REVIEW' | 'MERGED_AND_AUDITED' | 'REJECTED';
}

export interface PointsLedgerEntry {
  id: string;
  userId: string;
  type: 'ISSUE_SOLVED' | 'BONUS' | 'PENALTY' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  issueTitle?: string;
  repositoryFullName?: string;
}

export interface FilterOptions {
  search: string;
  language: string;
  ecosystem: string;
  minDifficulty: number;
  maxDifficulty: number;
  minMaintainerActivity: number;
  repoType: string;
  sortBy: 'difficulty_desc' | 'difficulty_asc' | 'points_desc' | 'recent' | 'activity_desc';
}
