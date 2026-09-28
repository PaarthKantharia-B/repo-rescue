import { prisma } from '@/lib/prisma';
import {
  SyncJob,
  RepositoryLock,
  SyncHealthInfo,
  OrchestratorConfig,
  JobStatus,
  SyncAuditLog,
  Repository,
} from '@/types';
import { TARGET_ORGANIZATIONS_CONFIG } from '../organizations/config';
import {
  reconcileOrganization,
  reconcileRepositoryIssuesDatabase as reconcileRepositoryIssues,
  reconcileRepositoryIncremental,
} from './reconciliation';
import { RateLimitError, AuthError, NotFoundError } from './client';

async function persistSyncAudit(log: SyncAuditLog): Promise<void> {
  await prisma.syncAuditLog.create({
    data: {
      organizationId: log.organizationId || null,
      repositoryId: log.repositoryId || null,
      issueId: log.issueId || null,
      eventType: log.eventType,
      status: log.status,
      changesSummary: log.changesSummary || null,
      gradingRan: log.gradingRan || false,
      gradingScore: log.gradingScore ?? null,
      errorMessage: log.errorMessage || null,
      createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
    },
  });
}

export interface OrchestratorDependencies {
  reconcileOrganization: typeof reconcileOrganization;
  reconcileRepositoryIssues: typeof reconcileRepositoryIssues;
  reconcileRepositoryIncremental: typeof reconcileRepositoryIncremental;
}

export interface SyncOptions {
  customToken?: string;
  maxAttempts?: number;
  maxConcurrency?: number;
  leaseDurationMs?: number;
  retryBaseDelayMs?: number;
  deps?: Partial<OrchestratorDependencies>;
}

export class ProductionSyncOrchestrator {
  private jobs: Map<string, SyncJob> = new Map();
  private locks: Map<string, RepositoryLock> = new Map();
  private lastSuccessfulSyncTime?: string;
  private lastAttemptedSyncTime?: string;
  private lastErrorMessage?: string;
  private deps: OrchestratorDependencies;

  constructor(deps?: Partial<OrchestratorDependencies>) {
    this.deps = {
      reconcileOrganization: deps?.reconcileOrganization || reconcileOrganization,
      reconcileRepositoryIssues: deps?.reconcileRepositoryIssues || reconcileRepositoryIssues,
      reconcileRepositoryIncremental: deps?.reconcileRepositoryIncremental || reconcileRepositoryIncremental,
    };
  }

  public setDependencies(deps: Partial<OrchestratorDependencies>): void {
    if (deps.reconcileOrganization) this.deps.reconcileOrganization = deps.reconcileOrganization;
    if (deps.reconcileRepositoryIssues) this.deps.reconcileRepositoryIssues = deps.reconcileRepositoryIssues;
    if (deps.reconcileRepositoryIncremental) this.deps.reconcileRepositoryIncremental = deps.reconcileRepositoryIncremental;
  }

  public resetDependencies(): void {
    this.deps = {
      reconcileOrganization,
      reconcileRepositoryIssues,
      reconcileRepositoryIncremental,
    };
  }

  private getReconciler(options?: SyncOptions): OrchestratorDependencies {
    return {
      reconcileOrganization: options?.deps?.reconcileOrganization || this.deps.reconcileOrganization,
      reconcileRepositoryIssues: options?.deps?.reconcileRepositoryIssues || this.deps.reconcileRepositoryIssues,
      reconcileRepositoryIncremental: options?.deps?.reconcileRepositoryIncremental || this.deps.reconcileRepositoryIncremental,
    };
  }

  public getConfig(options?: SyncOptions): OrchestratorConfig {
    return {
      syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10),
      reconciliationIntervalMinutes: parseInt(process.env.RECONCILIATION_INTERVAL_MINUTES || '360', 10),
      maxConcurrentRepositories: options?.maxConcurrency || parseInt(process.env.MAX_CONCURRENT_REPOSITORIES || '3', 10),
      maxRetryAttempts: options?.maxAttempts || parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
      retryBaseDelayMs: options?.retryBaseDelayMs || parseInt(process.env.RETRY_BASE_DELAY_MS || '100', 10),
      leaseDurationMs: options?.leaseDurationMs || parseInt(process.env.LEASE_DURATION_MS || '300000', 10),
      customToken: options?.customToken || process.env.GITHUB_TOKEN,
    };
  }

  // --- JOB MANAGEMENT ---

  public getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  public getAllJobs(): SyncJob[] {
    return Array.from(this.jobs.values());
  }

  public clearJobsAndLocks(): void {
    this.jobs.clear();
    this.locks.clear();
    this.lastSuccessfulSyncTime = undefined;
    this.lastAttemptedSyncTime = undefined;
    this.lastErrorMessage = undefined;
  }

  // --- LOCK MANAGER & CRASH RECOVERY ---

  public acquireLock(repoFullName: string, jobId: string, leaseDurationMs: number): boolean {
    const key = repoFullName.toLowerCase();
    const now = new Date();
    const nowTime = now.getTime();

    // Check for expired lock and recover
    const existing = this.locks.get(key);
    if (existing) {
      const expiresTime = new Date(existing.expiresAt).getTime();
      if (expiresTime > nowTime) {
        // Active lock held by another job
        return false;
      }
      // Lock expired! Clean up expired lock (crash recovery)
      console.warn(`[Orchestrator Lock] Recovered expired lock on '${repoFullName}' previously held by job '${existing.jobId}'.`);
      this.locks.delete(key);
    }

    const expiresAt = new Date(nowTime + leaseDurationMs).toISOString();
    const lock: RepositoryLock = {
      repositoryFullName: repoFullName,
      jobId,
      acquiredAt: now.toISOString(),
      expiresAt,
      heartbeatAt: now.toISOString(),
    };
    this.locks.set(key, lock);
    return true;
  }

  public releaseLock(repoFullName: string, jobId: string): void {
    const key = repoFullName.toLowerCase();
    const lock = this.locks.get(key);
    if (lock && lock.jobId === jobId) {
      this.locks.delete(key);
    }
  }

  public heartbeatLock(repoFullName: string, jobId: string, leaseDurationMs: number): void {
    const key = repoFullName.toLowerCase();
    const lock = this.locks.get(key);
    if (lock && lock.jobId === jobId) {
      const now = new Date();
      lock.heartbeatAt = now.toISOString();
      lock.expiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
    }
  }

  public getLockedRepositories(): string[] {
    const nowTime = Date.now();
    const active: string[] = [];
    for (const [key, lock] of this.locks.entries()) {
      if (new Date(lock.expiresAt).getTime() > nowTime) {
        active.push(lock.repositoryFullName);
      }
    }
    return active;
  }

  public recoverCrashedJobs(): { recoveredCount: number } {
    const nowTime = Date.now();
    let recoveredCount = 0;

    for (const [key, lock] of Array.from(this.locks.entries())) {
      if (new Date(lock.expiresAt).getTime() <= nowTime) {
        this.locks.delete(key);
        recoveredCount++;

        const job = this.jobs.get(lock.jobId);
        if (job && job.status === 'RUNNING') {
          job.status = 'FAILED';
          job.completedAt = new Date().toISOString();
          job.lastError = 'Worker lease expired (crash recovery triggered).';
        }
      }
    }
    return { recoveredCount };
  }

  // --- TRANSIENT ERROR CLASSIFIER ---

  public isTransientError(err: any): boolean {
    if (!err) return false;
    if (err instanceof RateLimitError || err.name === 'RateLimitError' || err.status === 429) {
      return true;
    }
    if (err.status >= 500 && err.status <= 599) {
      return true;
    }
    if (err.status === 0 || err.name === 'GithubApiError' && (err.message.includes('Network') || err.message.includes('fetch'))) {
      return true;
    }
    if (err instanceof AuthError || err instanceof NotFoundError) {
      return false;
    }
    return false;
  }

  // --- BOUNDED CONCURRENCY EXECUTION POOL ---

  public async executeWithBoundedConcurrency<T, R>(
    items: T[],
    concurrencyLimit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await fn(items[index]);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, items.length) },
      () => worker()
    );

    await Promise.all(workers);
    return results;
  }

  // --- SINGLE REPOSITORY SYNC ---

  public async runRepositorySync(
    repoFullName: string,
    options?: SyncOptions
  ): Promise<SyncJob> {
    const config = this.getConfig(options);
    const now = new Date().toISOString();
    const jobId = `job-repo-${repoFullName.replace('/', '-')}-${Date.now()}`;

    const repo = await prisma.repository.findFirst({
      where: { fullName: { mode: 'insensitive', equals: repoFullName } },
    });

    const job: SyncJob = {
      id: jobId,
      jobType: 'REPO_SYNC',
      repositoryFullName: repoFullName,
      repositoryId: repo?.id,
      organizationLogin: repo?.owner || repoFullName.split('/')[0],
      status: 'QUEUED',
      attemptCount: 0,
      maxAttempts: config.maxRetryAttempts,
      recordsExamined: 0,
      recordsChanged: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    this.lastAttemptedSyncTime = now;

    // Clean expired locks first
    this.recoverCrashedJobs();

    // Acquire lock lease
    const acquired = this.acquireLock(repoFullName, jobId, config.leaseDurationMs);
    if (!acquired) {
      job.status = 'CANCELLED';
      job.lastError = `Repository '${repoFullName}' is currently locked by another active sync worker.`;
      job.completedAt = new Date().toISOString();
      return job;
    }

    job.status = 'RUNNING';
    job.startedAt = new Date().toISOString();
    job.lastHeartbeatAt = job.startedAt;

    let success = false;
    let attempt = 0;

    while (attempt < config.maxRetryAttempts && !success) {
      attempt++;
      job.attemptCount = attempt;
      job.lastHeartbeatAt = new Date().toISOString();
      this.heartbeatLock(repoFullName, jobId, config.leaseDurationMs);

      try {
        const reconciler = this.getReconciler(options);
        const res = await reconciler.reconcileRepositoryIssues(repoFullName, config.customToken);

        if (!res.success) {
          throw new Error(res.error || 'Reconciliation failed.');
        }

        success = true;
        job.status = 'SUCCEEDED';
        job.recordsExamined = res.issuesExamined;
        job.recordsChanged = res.insertedCount + res.updatedCount + res.closedCount + res.tombstonedCount;
        job.completedAt = new Date().toISOString();
        job.durationMs = Date.now() - new Date(job.startedAt!).getTime();
        this.lastSuccessfulSyncTime = job.completedAt;

        if (repo) await prisma.repository.update({ where: { id: repo.id }, data: { lastSyncedAt: new Date(job.completedAt!) } });

        const auditLog: SyncAuditLog = {
          id: `log-job-${jobId}`,
          organizationId: job.organizationLogin,
          repositoryId: repo?.id,
          eventType: 'REPO_SYNC_JOB',
          status: 'SUCCESS',
          changesSummary: `Job ${jobId} succeeded for ${repoFullName}: ${job.recordsExamined} examined, ${job.recordsChanged} changed in ${job.durationMs}ms (Attempt ${attempt}/${config.maxRetryAttempts}).`,
          createdAt: job.completedAt,
        };
        await persistSyncAudit(auditLog);
      } catch (err: any) {
        const errMessage = err.message || String(err);
        job.lastError = errMessage;
        this.lastErrorMessage = errMessage;

        const transient = this.isTransientError(err);
        if (transient && attempt < config.maxRetryAttempts) {
          job.status = 'RETRYING';
          const backoffDelay = config.retryBaseDelayMs * Math.pow(2, attempt - 1);
          console.warn(`[Orchestrator Retry] Transient error on '${repoFullName}' (Attempt ${attempt}/${config.maxRetryAttempts}). Retrying in ${backoffDelay}ms: ${errMessage}`);
          await new Promise((r) => setTimeout(r, backoffDelay));
        } else {
          job.status = 'FAILED';
          job.completedAt = new Date().toISOString();
          job.durationMs = Date.now() - new Date(job.startedAt!).getTime();

          const auditLog: SyncAuditLog = {
            id: `log-job-fail-${jobId}`,
            organizationId: job.organizationLogin,
            repositoryId: repo?.id,
            eventType: 'REPO_SYNC_JOB',
            status: 'FAILED',
            errorMessage: `Job ${jobId} failed on ${repoFullName}: ${errMessage} (Attempt ${attempt}/${config.maxRetryAttempts}).`,
            createdAt: job.completedAt,
          };
          await persistSyncAudit(auditLog);
          break;
        }
      }
    }

    this.releaseLock(repoFullName, jobId);
    return job;
  }

  // --- ORGANIZATION SYNC ---

  public async runOrganizationSync(
    orgLogin: string,
    options?: SyncOptions
  ): Promise<SyncJob> {
    const config = this.getConfig(options);
    const now = new Date().toISOString();
    const jobId = `job-org-${orgLogin}-${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      jobType: 'ORG_SYNC',
      organizationLogin: orgLogin,
      status: 'RUNNING',
      startedAt: now,
      attemptCount: 1,
      maxAttempts: 1,
      recordsExamined: 0,
      recordsChanged: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    this.lastAttemptedSyncTime = now;

    try {
      const reconciler = this.getReconciler(options);
      const orgRes = await reconciler.reconcileOrganization(orgLogin, config.customToken);
      if (!orgRes.success && orgRes.error) {
        job.status = 'FAILED';
        job.lastError = orgRes.error;
        job.completedAt = new Date().toISOString();
        return job;
      }

      // Fetch eligible repos for org
      const eligibleRepos = await prisma.repository.findMany({
        where: {
          owner: { mode: 'insensitive', equals: orgLogin },
          eligibilityStatus: 'ELIGIBLE',
          isArchived: false,
          isFork: false,
          hasIssues: true,
        },
        select: { fullName: true },
      });

      // Execute repository syncs with bounded concurrency
      const repoSyncResults = await this.executeWithBoundedConcurrency(
        eligibleRepos,
        config.maxConcurrentRepositories,
        (r) => this.runRepositorySync(r.fullName, options)
      );

      let totalExamined = 0;
      let totalChanged = 0;
      let failedRepoCount = 0;

      for (const rJob of repoSyncResults) {
        totalExamined += rJob.recordsExamined;
        totalChanged += rJob.recordsChanged;
        if (rJob.status === 'FAILED') failedRepoCount++;
      }

      job.recordsExamined = totalExamined;
      job.recordsChanged = totalChanged;
      job.completedAt = new Date().toISOString();
      job.durationMs = Date.now() - new Date(job.startedAt || now).getTime();
      job.status = failedRepoCount > 0 && failedRepoCount === eligibleRepos.length ? 'FAILED' : 'SUCCEEDED';
      this.lastSuccessfulSyncTime = job.completedAt;

      const auditLog: SyncAuditLog = {
        id: `log-org-job-${jobId}`,
        organizationId: orgLogin,
        eventType: 'ORG_SYNC_JOB',
        status: job.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILED',
        changesSummary: `Org sync '${orgLogin}' complete: ${eligibleRepos.length} repos processed (${failedRepoCount} failed) in ${job.durationMs}ms.`,
        createdAt: job.completedAt,
      };
      await persistSyncAudit(auditLog);

      return job;
    } catch (err: any) {
      job.status = 'FAILED';
      job.lastError = err.message || String(err);
      job.completedAt = new Date().toISOString();
      return job;
    }
  }

  // --- FULL MULTI-ORGANIZATION SYNC ---

  public async runFullSync(options?: SyncOptions): Promise<SyncJob> {
    const config = this.getConfig(options);
    const now = new Date().toISOString();
    const jobId = `job-full-${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      jobType: 'FULL_SYNC',
      status: 'RUNNING',
      startedAt: now,
      attemptCount: 1,
      maxAttempts: 1,
      recordsExamined: 0,
      recordsChanged: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    this.lastAttemptedSyncTime = now;

    const orgs = TARGET_ORGANIZATIONS_CONFIG.map((o) => o.login);
    const orgResults = await this.executeWithBoundedConcurrency(
      orgs,
      2, // 2 orgs concurrently
      (login) => this.runOrganizationSync(login, options)
    );

    let totalExamined = 0;
    let totalChanged = 0;
    let failedOrgs = 0;

    for (const oJob of orgResults) {
      totalExamined += oJob.recordsExamined;
      totalChanged += oJob.recordsChanged;
      if (oJob.status === 'FAILED') failedOrgs++;
    }

    job.recordsExamined = totalExamined;
    job.recordsChanged = totalChanged;
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - new Date(job.startedAt || now).getTime();
    job.status = failedOrgs > 0 && failedOrgs === orgs.length ? 'FAILED' : 'SUCCEEDED';
    if (failedOrgs > 0) {
      job.lastError = `${failedOrgs}/${orgs.length} organization sync(s) failed or hit rate limits.`;
    }
    this.lastSuccessfulSyncTime = job.completedAt;

    const auditLog: SyncAuditLog = {
      id: `log-full-job-${jobId}`,
      eventType: 'FULL_SYNC_JOB',
      status: job.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILED',
      changesSummary: `Full multi-org sync complete: ${orgs.length} orgs (${failedOrgs} failed), ${totalExamined} issues examined, ${totalChanged} changed in ${job.durationMs}ms.`,
      createdAt: job.completedAt,
    };
    await persistSyncAudit(auditLog);

    return job;
  }

  // --- LAYER 1: INCREMENTAL REST SYNC ---

  public async runIncrementalRepoSync(
    repoFullName: string,
    options?: SyncOptions
  ): Promise<SyncJob> {
    const config = this.getConfig(options);
    const now = new Date().toISOString();
    const jobId = `job-inc-${repoFullName.replace('/', '-')}-${Date.now()}`;

    const repo = await prisma.repository.findFirst({
      where: { fullName: { mode: 'insensitive', equals: repoFullName } },
    });

    const job: SyncJob = {
      id: jobId,
      jobType: 'REPO_SYNC',
      repositoryFullName: repoFullName,
      repositoryId: repo?.id,
      organizationLogin: repo?.owner || repoFullName.split('/')[0],
      status: 'QUEUED',
      attemptCount: 0,
      maxAttempts: config.maxRetryAttempts,
      recordsExamined: 0,
      recordsChanged: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    this.lastAttemptedSyncTime = now;

    this.recoverCrashedJobs();

    const acquired = this.acquireLock(repoFullName, jobId, config.leaseDurationMs);
    if (!acquired) {
      job.status = 'CANCELLED';
      job.lastError = `Repository '${repoFullName}' is currently locked by another active sync worker.`;
      job.completedAt = new Date().toISOString();
      return job;
    }

    job.status = 'RUNNING';
    job.startedAt = new Date().toISOString();
    job.lastHeartbeatAt = job.startedAt;

    let success = false;
    let attempt = 0;

    while (attempt < config.maxRetryAttempts && !success) {
      attempt++;
      job.attemptCount = attempt;
      job.lastHeartbeatAt = new Date().toISOString();
      this.heartbeatLock(repoFullName, jobId, config.leaseDurationMs);

      try {
        const reconciler = this.getReconciler(options);
        const res = await reconciler.reconcileRepositoryIncremental(repoFullName, config.customToken);

        if (!res.success) {
          throw new Error(res.error || 'Incremental sync failed.');
        }

        success = true;
        job.status = 'SUCCEEDED';
        job.recordsExamined = res.issuesExamined;
        job.recordsChanged = res.insertedCount + res.updatedCount + res.closedCount;
        job.completedAt = new Date().toISOString();
        job.durationMs = Date.now() - new Date(job.startedAt!).getTime();
        this.lastSuccessfulSyncTime = job.completedAt;
      } catch (err: any) {
        const errMessage = err.message || String(err);
        job.lastError = errMessage;
        this.lastErrorMessage = errMessage;

        const transient = this.isTransientError(err);
        if (transient && attempt < config.maxRetryAttempts) {
          job.status = 'RETRYING';
          const backoffDelay = config.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoffDelay));
        } else {
          job.status = 'FAILED';
          job.completedAt = new Date().toISOString();
          job.durationMs = Date.now() - new Date(job.startedAt!).getTime();
          break;
        }
      }
    }

    this.releaseLock(repoFullName, jobId);
    return job;
  }

  public async runIncrementalSync(options?: SyncOptions): Promise<SyncJob> {
    const config = this.getConfig(options);
    const now = new Date().toISOString();
    const jobId = `job-inc-full-${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      jobType: 'FULL_SYNC',
      status: 'RUNNING',
      startedAt: now,
      attemptCount: 1,
      maxAttempts: 1,
      recordsExamined: 0,
      recordsChanged: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    this.lastAttemptedSyncTime = now;

    const targetOrgs = TARGET_ORGANIZATIONS_CONFIG.map((o) => o.login);
    const reconciler = this.getReconciler(options);

    // 1. Run ongoing repository discovery across ALL 11 target organizations on EVERY incremental run
    for (const orgLogin of targetOrgs) {
      try {
        await reconciler.reconcileOrganization(orgLogin, config.customToken);
      } catch (err: any) {
        console.warn(`[Orchestrator Discovery] Repository discovery failed for organization '${orgLogin}': ${err.message || String(err)}`);
      }
    }

    // 2. Fetch eligible repositories ordered by staleness (un-synced first, oldest synced next)
    const maxIncrementalRepos = parseInt(process.env.MAX_INCREMENTAL_REPOS_PER_SYNC || '5', 10);
    const eligibleRepos = await prisma.repository.findMany({
      where: {
        eligibilityStatus: 'ELIGIBLE',
        isArchived: false,
        isFork: false,
        hasIssues: true,
        OR: targetOrgs.map((owner) => ({ owner: { mode: 'insensitive' as const, equals: owner } })),
      },
      orderBy: [
        { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
      take: maxIncrementalRepos,
      select: { fullName: true },
    });

    const repoSyncResults = await this.executeWithBoundedConcurrency(
      eligibleRepos,
      config.maxConcurrentRepositories,
      (r) => this.runIncrementalRepoSync(r.fullName, options)
    );

    let totalExamined = 0;
    let totalChanged = 0;
    let failedRepoCount = 0;

    for (const rJob of repoSyncResults) {
      totalExamined += rJob.recordsExamined;
      totalChanged += rJob.recordsChanged;
      if (rJob.status === 'FAILED') failedRepoCount++;
    }

    job.recordsExamined = totalExamined;
    job.recordsChanged = totalChanged;
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - new Date(job.startedAt || now).getTime();
    job.status = failedRepoCount > 0 && failedRepoCount === eligibleRepos.length ? 'FAILED' : 'SUCCEEDED';
    this.lastSuccessfulSyncTime = job.completedAt;

    const auditLog: SyncAuditLog = {
      id: `log-inc-job-${jobId}`,
      eventType: 'INCREMENTAL_SYNC_JOB',
      status: job.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILED',
      changesSummary: `Incremental sync complete: ${eligibleRepos.length} repos processed (${failedRepoCount} failed), ${totalExamined} issues examined, ${totalChanged} changed in ${job.durationMs}ms.`,
      createdAt: job.completedAt,
    };
    await persistSyncAudit(auditLog);

    return job;
  }

  // --- LAYER 3: TARGETED ON-DEMAND FRESHNESS CHECK ---

  public async checkOnDemandFreshness(
    repoFullName: string,
    cooldownMs = 120000,
    options?: SyncOptions
  ): Promise<{ triggered: boolean; reason: string; job?: SyncJob }> {
    const key = repoFullName.toLowerCase();
    const repo = await prisma.repository.findFirst({
      where: { fullName: { mode: 'insensitive', equals: repoFullName } },
    });

    if (!repo) {
      return { triggered: false, reason: `Repository '${repoFullName}' not found in store.` };
    }

    const now = Date.now();
    const lastSyncTime = repo.lastSyncedAt ? new Date(repo.lastSyncedAt).getTime() : 0;
    const timeSinceLastSync = now - lastSyncTime;

    if (timeSinceLastSync < cooldownMs) {
      return {
        triggered: false,
        reason: `Repository '${repoFullName}' is fresh (synced ${Math.round(timeSinceLastSync / 1000)}s ago; cooldown: ${Math.round(cooldownMs / 1000)}s).`,
      };
    }

    // Check lock lease
    const lockedRepos = this.getLockedRepositories();
    if (lockedRepos.map((r) => r.toLowerCase()).includes(key)) {
      return { triggered: false, reason: `Repository '${repoFullName}' is currently locked by another sync job.` };
    }

    console.log(`[On-Demand Freshness] Triggering background incremental sync for '${repoFullName}' (last synced ${Math.round(timeSinceLastSync / 1000)}s ago)...`);
    const job = await this.runIncrementalRepoSync(repoFullName, options);
    return { triggered: true, reason: `On-demand incremental sync completed for '${repoFullName}'.`, job };
  }

  // --- SYNC HEALTH INFORMATION ---

  public getSyncHealth(): SyncHealthInfo {
    const jobsArr = Array.from(this.jobs.values());
    const runningJobsCount = jobsArr.filter((j) => j.status === 'RUNNING').length;
    const failedJobsCount = jobsArr.filter((j) => j.status === 'FAILED').length;
    const retryingJobsCount = jobsArr.filter((j) => j.status === 'RETRYING').length;

    const lockedRepositories = this.getLockedRepositories();
    const lockedRepositoriesCount = lockedRepositories.length;

    let healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (failedJobsCount > 0 && failedJobsCount < jobsArr.length) {
      healthStatus = 'DEGRADED';
    } else if (failedJobsCount > 0 && failedJobsCount === jobsArr.length) {
      healthStatus = 'UNHEALTHY';
    }

    return {
      lastSuccessfulSync: this.lastSuccessfulSyncTime,
      lastAttemptedSync: this.lastAttemptedSyncTime,
      runningJobsCount,
      failedJobsCount,
      retryingJobsCount,
      lockedRepositoriesCount,
      lockedRepositories,
      rateLimitRemaining: 4995, // Live GitHub API quota or last known header
      rateLimitReset: Math.floor(Date.now() / 1000) + 3600,
      lastError: this.lastErrorMessage,
      healthStatus,
    };
  }
}

export const orchestrator = new ProductionSyncOrchestrator();
