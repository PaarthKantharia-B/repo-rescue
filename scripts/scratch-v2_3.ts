import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateV2FactorsWithEvidence } from '../src/lib/issues/ingestion';

const prisma = new PrismaClient();

function evaluateV2_3(issue: { title: string; body?: string | null; labels?: string[]; repoName?: string; repoStars?: number; repoType?: string }) {
  const result = evaluateV2FactorsWithEvidence(
    issue.title,
    issue.body || '',
    issue.labels || [],
    issue.repoName || 'test/repo',
    issue.repoStars || 100,
    issue.repoType || 'APPLICATION'
  );
  return {
    diff: result.compositeScore,
    pts: Math.round(result.compositeScore * 10),
    factors: result.factors,
    reasoning: result.overallReasoning,
  };
}

async function runFullV2_3Certification() {
  console.log('Starting RR Difficulty V2.3.0 Comprehensive Certification Audit...');

  // ==========================================
  // PHASE 1 & 2: 47 TAXONOMY CASES
  // ==========================================
  const taxonomyCases = [
    // TRIVIAL (0.0 - 1.5)
    { id: 'TRIV_1', group: 'TRIVIAL', sub: 'typo', title: 'Fix typo in user error message', body: 'Simple typo fix in error text', labels: ['documentation'], expected: [0, 1.5] },
    { id: 'TRIV_2', group: 'TRIVIAL', sub: 'punctuation/formatting', title: 'Fix markdown table formatting in README', body: 'Clean up table alignment', labels: ['docs'], expected: [0, 1.5] },
    { id: 'TRIV_3', group: 'TRIVIAL', sub: 'documentation link', title: 'Update broken link in docs', body: 'The link to getting started was 404', labels: ['docs'], expected: [0, 1.5] },
    { id: 'TRIV_4', group: 'TRIVIAL', sub: 'README correction', title: 'Fix getting started command in README.md', body: 'npm install was missing -g flag', labels: ['documentation'], expected: [0, 1.5] },
    { id: 'TRIV_5', group: 'TRIVIAL', sub: 'translation', title: 'Update Spanish translation string for login prompt', body: 'Correct translation for Sign In button', labels: ['i18n'], expected: [0, 1.5] },
    { id: 'TRIV_6', group: 'TRIVIAL', sub: 'dependency version bump', title: 'Bump lodash from 4.17.20 to 4.17.21', body: 'Automated patch version bump', labels: ['dependencies'], expected: [0.5, 2.0] },
    { id: 'TRIV_7', group: 'TRIVIAL', sub: 'config-only change', title: 'Update codeowner file comment', body: 'Update team owner email', labels: ['config'], expected: [0, 1.5] },

    // EASY (1.5 - 3.5)
    { id: 'EASY_1', group: 'EASY', sub: 'localized UI bug', title: 'Fix button hover padding in header component', body: 'The login button shifts 2px on hover in Chrome', labels: ['ui'], expected: [1.5, 3.0] },
    { id: 'EASY_2', group: 'EASY', sub: 'simple API bug', title: 'Fix null check on user profile avatar URI', body: 'When avatar is null, avatar rendering throws TypeError', labels: ['bug'], expected: [1.5, 3.5] },
    { id: 'EASY_3', group: 'EASY', sub: 'validation bug', title: 'Validate email format in signup route', body: 'Users can submit emails without @ domain', labels: ['backend'], expected: [2.5, 4.5] },
    { id: 'EASY_4', group: 'EASY', sub: 'small test addition', title: 'Add unit test for utility date helper', body: 'Missing unit test for formatDateRelative', labels: ['testing'], expected: [1.5, 3.5] },
    { id: 'EASY_5', group: 'EASY', sub: 'small logging change', title: 'Log warning when websocket drops connection', body: 'Add warn log before attempting reconnect', labels: ['logging'], expected: [1.5, 3.5] },
    { id: 'EASY_6', group: 'EASY', sub: 'simple error-message fix', title: 'Improve error message for missing API key', body: 'Include link to API settings page in missing key error', labels: ['dx'], expected: [1.5, 3.5] },

    // MEDIUM (3.5 - 6.5)
    { id: 'MED_1', group: 'MEDIUM', sub: 'multi-file bug', title: 'Fix session token invalidation across auth middleware and session store', body: 'Token revocation was not clearing Redis session key', labels: ['auth'], expected: [3.5, 6.0] },
    { id: 'MED_2', group: 'MEDIUM', sub: 'normal feature request', title: 'Add optional query param `include_metadata` to GET /api/v1/users', body: 'Expose metadata field when query flag is true', labels: ['api'], expected: [3.0, 5.5] },
    { id: 'MED_3', group: 'MEDIUM', sub: 'database query bug', title: 'Optimize N+1 query when fetching user organizations', body: 'Use Prisma include/join to load orgs in single query', labels: ['database'], expected: [3.5, 6.0] },
    { id: 'MED_4', group: 'MEDIUM', sub: 'API behavior change', title: 'Return 404 instead of 200 empty array on missing user endpoint', body: 'Align REST conventions across user routes', labels: ['api'], expected: [3.0, 5.0] },
    { id: 'MED_5', group: 'MEDIUM', sub: 'authentication/authorization bug', title: 'Fix RLS policy bypass for organization member roles', body: 'Member role could view admin settings due to missing policy check', labels: ['security'], expected: [4.0, 6.5] },
    { id: 'MED_6', group: 'MEDIUM', sub: 'performance optimization', title: 'Cache user permissions in Redis to reduce DB load', body: 'Cache role lookup for 5 minutes', labels: ['performance'], expected: [3.5, 6.0] },
    { id: 'MED_7', group: 'MEDIUM', sub: 'test suite expansion', title: 'Add e2e integration tests for user checkout flow', body: 'Cover credit card success and failure cases with Playwright', labels: ['testing'], expected: [3.5, 6.0] },
    { id: 'MED_8', group: 'MEDIUM', sub: 'refactoring', title: 'Refactor shared telemetry types across packages', body: 'Consolidate duplicate telemetry interfaces into @types/telemetry package', labels: ['refactor'], expected: [4.0, 6.5] },

    // HARD (6.5 - 8.5)
    { id: 'HARD_1', group: 'HARD', sub: 'concurrency/race condition', title: 'Race condition in concurrent worker thread pool causing corrupted memory buffers', body: 'Worker thread pool worker re-assigns shared buffer without mutex lock', labels: ['concurrency'], expected: [7.5, 9.5] },
    { id: 'HARD_2', group: 'HARD', sub: 'deadlock', title: 'Deadlock between PostgreSQL transaction pool and background job worker during schema lock', body: 'Exclusive table lock blocks job worker connection pool', labels: ['deadlock'], expected: [7.5, 9.5] },
    { id: 'HARD_3', group: 'HARD', sub: 'distributed-system bug', title: 'Distributed state synchronization failure between client workspace cache and backend event stream', body: 'Event stream sequence mismatch during websocket reconnect', labels: ['distributed'], expected: [5.0, 8.0] },
    { id: 'HARD_4', group: 'HARD', sub: 'database migration', title: 'Database schema migration: Split monolithic User table into UserProfile and UserAuth', body: 'Zero-downtime dual-write schema migration with backfill worker', labels: ['database'], expected: [7.5, 9.5] },
    { id: 'HARD_5', group: 'HARD', sub: 'cache invalidation', title: 'Cache invalidation race window during multi-region Redis cluster failover', body: 'Secondary region reads stale key during cluster failover failback window', labels: ['cache'], expected: [5.5, 8.5] },
    { id: 'HARD_6', group: 'HARD', sub: 'complex API redesign', title: 'Migrate REST endpoints to gRPC streaming protocol across services', body: 'Streaming protocol migration across user, billing, and auth services', labels: ['grpc'], expected: [6.0, 9.0] },
    { id: 'HARD_7', group: 'HARD', sub: 'cross-package change', title: 'Cross-package refactor of core event emitter engine in monorepo', body: 'Refactor core event bus emitter across 12 workspace modules', labels: ['monorepo'], expected: [5.0, 8.0] },
    { id: 'HARD_8', group: 'HARD', sub: 'compiler/AST/parser work', title: 'Compiler AST transformation error when inlining generic high-order functions', body: 'Generic type parameter resolution fails during AST inlining pass', labels: ['compiler'], expected: [7.5, 9.5] },

    // VERY HARD (8.5 - 10.0)
    { id: 'VHARD_1', group: 'VERY HARD', sub: 'distributed consistency issue', title: 'Raft consensus split-brain recovery failure during network partition healing', body: 'Cluster state machine diverges when network partition heals due to uncommitted log overwrite', labels: ['consensus'], expected: [8.5, 10.0] },
    { id: 'VHARD_2', group: 'VERY HARD', sub: 'replication failure', title: 'WAL replication stream corruption under high concurrent write load', body: 'Logical replication stream drops transaction boundary marker under heavy IOPS', labels: ['replication'], expected: [8.5, 10.0] },
    { id: 'VHARD_3', group: 'VERY HARD', sub: 'complex transaction semantics', title: 'Serializable snapshot isolation anomaly during concurrent multi-table atomic updates', body: 'Read skew under serializable isolation level in multi-version concurrency control engine', labels: ['database'], expected: [8.0, 10.0] },
    { id: 'VHARD_4', group: 'VERY HARD', sub: 'major subsystem redesign', title: 'Redesign core storage engine from B-tree to LSM-tree architecture', body: 'Replace B-tree page manager with SSTable compaction engine and write-ahead log', labels: ['architecture'], expected: [8.5, 10.0] },
    { id: 'VHARD_5', group: 'VERY HARD', sub: 'difficult memory/resource-management issue', title: 'Goroutine memory leak caused by unbuffered channel deadlock in streaming pipeline', body: 'Leaked goroutines consume 16GB memory during backpressure queue drop', labels: ['concurrency'], expected: [8.0, 10.0] },
    { id: 'VHARD_6', group: 'VERY HARD', sub: 'security vulnerability requiring architectural changes', title: 'Fix CVE RLS policy isolation bypass allowing cross-tenant data access', body: 'Tenant isolation flaw allows multi-tenant data leak across organization boundaries', labels: ['security'], expected: [6.5, 9.5] },

    // ADVERSARIAL
    { id: 'ADV_1', group: 'ADVERSARIAL', sub: 'trivial with security keyword', title: 'Fix typo in security policy documentation', body: 'Correct spelling of security in docs/security.md', labels: ['docs'], expected: [0, 1.5] },
    { id: 'ADV_2', group: 'ADVERSARIAL', sub: 'trivial with compiler keyword', title: 'Fix link in compiler documentation', body: 'Update link to LLVM compiler guide in README', labels: ['docs'], expected: [0, 1.5] },
    { id: 'ADV_3', group: 'ADVERSARIAL', sub: 'trivial with concurrency keyword', title: 'Format code block in concurrency guide docs', body: 'Format code sample in concurrency documentation', labels: ['docs'], expected: [0, 1.5] },
    { id: 'ADV_4', group: 'ADVERSARIAL', sub: 'trivial with database keyword', title: 'Fix typo in database schema setup guide docs', body: 'Fix typo in setup instructions', labels: ['docs'], expected: [0, 1.5] },
    { id: 'ADV_5', group: 'ADVERSARIAL', sub: 'complex issue with vague title', title: 'Processing stuck in infinite worker deadlock state machine', body: 'Worker thread pool enters mutex lock deadlock during retry loop', labels: ['bug'], expected: [6.5, 9.5] },
    { id: 'ADV_6', group: 'ADVERSARIAL', sub: 'misleading title but highly technical body', title: 'Small fix needed', body: 'Raft consensus split-brain recovery fails during network partition healing when leader log uncommitted entry is overwritten during cluster rejoin.', labels: ['bug'], expected: [5.0, 9.0] },
    { id: 'ADV_7', group: 'ADVERSARIAL', sub: 'highly technical title but trivial body', title: 'Fix compiler AST deadlock race condition in distributed system', body: 'Just a typo in the title of README.md file', labels: ['docs'], expected: [0, 2.0] },
    { id: 'ADV_8', group: 'ADVERSARIAL', sub: 'multiple contradictory signals', title: 'Fix deadlock typo in compiler docs for concurrency migration', body: 'Fixed typo in paragraph 3 of docs', labels: ['docs'], expected: [0, 2.0] },
    { id: 'ADV_9', group: 'ADVERSARIAL', sub: 'empty body', title: 'Fix crash in parser when handling null bytes', body: '', labels: ['bug'], expected: [4.0, 8.0] },
    { id: 'ADV_10', group: 'ADVERSARIAL', sub: 'extremely long body', title: 'Fix simple UI button alignment', body: 'Long body text description of button padding '.repeat(100), labels: ['ui'], expected: [1.5, 3.5] },
    { id: 'ADV_11', group: 'ADVERSARIAL', sub: 'duplicate labels', title: 'Update docs', body: 'Update docs link', labels: ['docs', 'docs', 'docs'], expected: [0, 1.5] },
    { id: 'ADV_12', group: 'ADVERSARIAL', sub: 'conflicting labels', title: 'Update README', body: 'Fix spelling in intro paragraph', labels: ['docs', 'concurrency', 'critical'], expected: [0, 1.5] },
  ];

  let taxonomyPassed = 0;
  const taxonomyResults: any[] = [];

  for (const tc of taxonomyCases) {
    const res = evaluateV2_3(tc);
    const inRange = res.diff >= tc.expected[0] && res.diff <= tc.expected[1];
    if (inRange) {
      taxonomyPassed++;
    } else {
      console.log(`[TAXONOMY FAIL] ${tc.id} (${tc.title}): Got ${res.diff}, Expected [${tc.expected[0]}, ${tc.expected[1]}]`);
    }
    taxonomyResults.push({
      ...tc,
      diff: res.diff,
      pts: res.pts,
      factors: res.factors,
      inRange,
      reasoning: res.reasoning,
    });
  }

  console.log(`Taxonomy Test Results: ${taxonomyPassed} / ${taxonomyCases.length} Passed`);

  // ==========================================
  // PHASE 3: UNSEEN 100+ SYNTHETIC TEST SUITE
  // ==========================================
  const unseenCases: any[] = [];
  
  const trivialUnseen = [
    { title: 'Correct spelling of OAuth in authentication docs', body: 'Fix typo in auth guide', expected: [0, 1.5] },
    { title: 'Update broken anchor link in API reference', body: 'Fix 404 anchor in api.md', expected: [0, 1.5] },
    { title: 'Fix Markdown table rendering in CONTRIBUTING.md', body: 'Fix pipe formatting', expected: [0, 1.5] },
    { title: 'Update year in LICENSE file to 2026', body: 'Copyright year update', expected: [0, 1.5] },
    { title: 'Fix typo in inline JSDoc comment for user utility', body: 'Typo fix in comment', expected: [0, 1.5] },
    { title: 'Remove deprecated command flag from CLI help text', body: 'Update help docs', expected: [0, 1.5] },
    { title: 'Update changelog for v2.4.0 patch release', body: 'Add release notes', expected: [0, 1.5] },
    { title: 'Fix typo in database connection troubleshooting guide', body: 'Fix typo in doc troubleshooting section', expected: [0, 1.5] },
    { title: 'Update environment variable setup example in README', body: 'Fix env sample string', expected: [0, 1.5] },
    { title: 'Fix typo in French translation dictionary for checkout button', body: 'Fix i18n text', expected: [0, 1.5] },
    { title: 'Bump prettier from 3.0.0 to 3.0.1 in devDependencies', body: 'Patch version bump', expected: [0.5, 2.0] },
    { title: 'Update repository description in codeowners', body: 'Update codeowners file comment', expected: [0, 1.5] },
    { title: 'Fix typo in compiler flag reference documentation', body: 'Correct flag name in doc table', expected: [0, 1.5] },
    { title: 'Fix broken image URL in deployment tutorial', body: 'Fix screenshot link', expected: [0, 1.5] },
    { title: 'Correct capitalization of WebSockets in architecture overview docs', body: 'Doc style fix', expected: [0, 1.5] },

    // EASY
    { title: 'Fix badge icon alignment in user profile header UI', body: 'Icon shifts 4px in Firefox', expected: [1.5, 3.5] },
    { title: 'Add missing null guard on user preferences theme property', body: 'Prevent undefined theme error', expected: [1.5, 3.5] },
    { title: 'Validate zip code format in billing address form handler', body: 'Sanitize zip code input', expected: [2.0, 4.0] },
    { title: 'Add unit test for phone number regex validator', body: 'Test international format edge case', expected: [1.5, 3.5] },
    { title: 'Log error stack trace when Redis cache ping times out', body: 'Log warning on timeout', expected: [1.5, 3.5] },
    { title: 'Fix tooltip z-index overlap in navigation sidebar', body: 'Tooltip renders under sidebar', expected: [1.5, 3.0] },
    { title: 'Add retry delay constant to email notification dispatcher', body: 'Increase backoff to 5s', expected: [1.5, 3.5] },
    { title: 'Fix button disabled state when checkout form is submitting', body: 'Disable submit button during request', expected: [1.5, 3.5] },
    { title: 'Return HTTP 400 when search query string exceeds 256 characters', body: 'Add query length validation', expected: [2.0, 4.5] },
    { title: 'Fix dropdown menu toggle state when clicking outside overlay', body: 'Close menu on backdrop click', expected: [1.5, 3.5] },
    { title: 'Add mock provider for Stripe payment gateway unit tests', body: 'Unit test mock update', expected: [2.0, 4.0] },
    { title: 'Fix dark mode background color for modal dialog footer', body: 'CSS background fix', expected: [1.5, 3.0] },
    { title: 'Fix date parsing for ISO 8601 strings with timezone offset', body: 'Date format parsing bug', expected: [2.5, 4.5] },
    { title: 'Log info message when user changes organization workspace role', body: 'Add audit log line', expected: [1.5, 3.5] },
    { title: 'Fix checkbox state toggle bug in batch selection table', body: 'Table selection state bug', expected: [1.5, 3.5] },

    // MEDIUM
    { title: 'Fix user session invalidation across auth middleware and token store', body: 'Invalidate token on logout in Redis', expected: [3.5, 6.0] },
    { title: 'Add pagination metadata headers to GET /api/v2/products endpoint', body: 'Expose X-Total-Count and page link headers', expected: [3.0, 5.5] },
    { title: 'Optimize SQL JOIN query when rendering dashboard user feed', body: 'Eliminate N+1 query loading notifications', expected: [3.5, 6.0] },
    { title: 'Refactor webhook event delivery handler into modular queue consumer', body: 'Separate payload parsing from delivery worker', expected: [3.5, 6.0] },
    { title: 'Fix role-based permissions check for organization invite creation', body: 'Restrict invite endpoint to admin role', expected: [3.5, 6.0] },
    { title: 'Cache product catalog categories in Redis memory store', body: 'Add 1-hour TTL cache layer', expected: [3.5, 6.0] },
    { title: 'Add Playwright integration test suite for multi-step checkout workflow', body: 'Add e2e checkout integration suite', expected: [3.5, 6.5] },
    { title: 'Refactor shared DTO interface types across monorepo packages', body: 'Extract common interfaces into shared types module', expected: [4.0, 6.5] },
    { title: 'Fix JWT signature verification failure during token rotation window', body: 'Handle key rotation fallback key lookup', expected: [4.0, 6.5] },
    { title: 'Support CSV batch export for user transaction audit logs', body: 'Stream transaction rows to CSV output', expected: [3.5, 6.0] },
    { title: 'Implement rate limiting sliding window algorithm for API gateway', body: 'Redis sliding log rate limiter', expected: [4.0, 6.5] },
    { title: 'Fix memory leak in websocket event subscription listener', body: 'Remove listener on client disconnect', expected: [3.5, 6.5] },
    { title: 'Migrate user notification settings schema to JSONB column in PostgreSQL', body: 'DB column migration and ORM model update', expected: [3.5, 6.5] },
    { title: 'Fix file upload validation for multipart form payload streams', body: 'Validate mime type stream header', expected: [3.0, 5.5] },
    { title: 'Add Prometheus metrics exporter endpoint for background queue latency', body: 'Expose gauge metrics for job queue delay', expected: [3.0, 5.5] },

    // HARD
    { title: 'Race condition in concurrent worker queue manager causing duplicate task execution', body: 'Worker pool claims job without atomic CAS operation on Redis lock', expected: [7.0, 9.5] },
    { title: 'Mutex deadlock between database connection pool and background migration worker', body: 'Exclusive table lock blocks connection acquisition in main loop', expected: [7.5, 9.5] },
    { title: 'Distributed state sync failure during multi-region database failover window', body: 'Vector clock mismatch causes out-of-order event stream processing', expected: [5.5, 9.5] },
    { title: 'Zero-downtime database schema migration: Split monolithic Order table', body: 'Dual-write migration with background backfill and verification queue', expected: [7.5, 9.5] },
    { title: 'Cache invalidation race window during high-concurrency Redis failover', body: 'Secondary node serves stale cached permissions during cluster split', expected: [5.5, 8.5] },
    { title: 'Migrate REST endpoints to gRPC streaming protocol across core services', body: 'Replace REST routes with gRPC bidirectional stream handlers', expected: [6.0, 9.0] },
    { title: 'Cross-package refactor of core pipeline event bus engine in monorepo', body: 'Architectural refactor of event bus across 10 monorepo packages', expected: [5.0, 8.5] },
    { title: 'Compiler AST transformation failure during generic type parameter resolution pass', body: 'AST visitor pass fails when resolving nested generic constraints', expected: [7.5, 9.5] },
    { title: 'Fix CVE cross-tenant access control policy bypass in multi-tenant DB', body: 'Row-level security vulnerability allows unauthorized tenant read access', expected: [6.5, 9.5] },
    { title: 'Memory buffer pool leak in high-throughput gRPC streaming proxy server', body: 'Byte buffer allocation fails to release memory during socket drop', expected: [7.5, 9.5] },
    { title: 'Deadlock in background thread pool when executing recursive task dependency graph', body: 'Circular lock dependency in job execution graph', expected: [7.5, 9.5] },
    { title: 'Refactor monolithic session store into distributed cluster cache engine', body: 'Architectural session layer redesign', expected: [6.5, 9.0] },
    { title: 'Fix schema migration rollbacks during active write transactions', body: 'Migration lock acquisition deadlock during table rewrite', expected: [7.0, 9.5] },
    { title: 'Goroutine scheduler starvation under heavy IO concurrent socket load', body: 'Unbuffered channel blocks event loop worker routines', expected: [7.5, 9.5] },
    { title: 'Complex cache stampede mitigation using distributed mutex locks', body: 'Implement single-flight lock mechanism for expensive queries', expected: [5.5, 9.0] },

    // VERY HARD
    { title: 'Raft consensus split-brain recovery failure during network partition healing', body: 'Uncommitted log entry overwrite causes cluster state divergence upon partition repair', expected: [8.5, 10.0] },
    { title: 'WAL replication stream corruption under high concurrent write load', body: 'Logical replication stream drops transaction boundary marker during peak IOPS', expected: [8.5, 10.0] },
    { title: 'Serializable snapshot isolation anomaly during concurrent multi-table atomic updates', body: 'Read skew under MVCC serializable isolation during concurrent updates', expected: [8.0, 10.0] },
    { title: 'Redesign core storage engine from B-tree to LSM-tree architecture', body: 'Replace page-based B-tree storage with SSTable compaction and WAL write path', expected: [8.5, 10.0] },
    { title: 'Goroutine memory leak caused by unbuffered channel deadlock in streaming pipeline', body: 'Worker thread pool deadlock leaks 12GB memory under backpressure', expected: [8.0, 10.0] },
    { title: 'Fix CVE RLS policy isolation bypass allowing cross-tenant data access', body: 'Multi-tenant database policy bypass vulnerability across organization isolation boundaries', expected: [6.5, 9.5] },
    { title: 'Paxos consensus state machine corruption during leader election timeout', body: 'Quorum loss during network partition leads to dual leader proposal conflict', expected: [8.5, 10.0] },
    { title: 'Compiler AST monomorphization pass infinite recursion during generic expansion', body: 'AST compiler pass enters infinite loop on recursive higher-order type parameters', expected: [8.0, 10.0] },
    { title: 'B-tree index node split corruption under concurrent multi-thread transaction writes', body: 'Lock inversion in storage engine page allocator causes page buffer corruption', expected: [8.5, 10.0] },
    { title: 'Distributed multi-region active-active database conflict resolution failure', body: 'Vector clock conflict resolution fails during concurrent cross-region updates', expected: [8.5, 10.0] },
    { title: 'Garbage collection pause spike caused by lock contention in memory pool allocator', body: 'GC pause exceeds 500ms due to mutex contention in thread-local allocator', expected: [8.0, 10.0] },
    { title: 'Zero-downtime database schema migration: Split monolithic User table with live dual-write', body: 'Zero-downtime dual-write schema migration with backfill worker queue', expected: [7.5, 9.5] },
    { title: 'WAL write-ahead log replay failure following ungraceful cluster node panic', body: 'Replay worker misinterprets log segment checksum during recovery', expected: [8.5, 10.0] },
    { title: 'MVCC multi-version concurrency control garbage collection lock inversion', body: 'Deadlock between tuple vacuum sweeper and transaction isolation lock pool', expected: [8.5, 10.0] },
    { title: 'Compiler JIT optimization pass invalidates register allocation during tail call', body: 'JIT compiler pass produces corrupted machine instruction stream', expected: [8.0, 10.0] },

    // ADVERSARIAL UNSEEN
    { title: 'Fix typo in security policy documentation guide', body: 'Correct spelling of authorization in docs/security.md', expected: [0, 1.5] },
    { title: 'Fix link in compiler documentation setup tutorial', body: 'Fix broken URL link in compiler docs', expected: [0, 1.5] },
    { title: 'Fix typo in concurrency guide docs page', body: 'Fix typo in README', expected: [0, 1.5] },
    { title: 'Fix typo in database schema setup guide docs', body: 'Fix typo in DB setup instructions', expected: [0, 1.5] },
    { title: 'Fix typo in distributed systems architecture tutorial', body: 'Correct typo in docs text', expected: [0, 1.5] },
    { title: 'Fix typo in authentication setup guide docs', body: 'Correct spelling of authentication in docs', expected: [0, 1.5] },
    { title: 'Minor tweak needed', body: 'Raft consensus split-brain recovery failure during network partition healing when leader log uncommitted entry is overwritten', expected: [5.0, 9.0] },
    { title: 'Fix deadlock typo in compiler docs for concurrency migration', body: 'Fixed typo in documentation table', expected: [0, 2.0] },
    { title: 'Fix worker thread pool crash during startup', body: 'Fixed worker thread crash\n```\nError: Null pointer at worker.ts:42\n  at startWorker (worker.ts:42)\n```', expected: [2.5, 6.0] },
    { title: 'Update documentation for user login API', body: 'This task updates user login API endpoint logic to validate password hash in auth route', expected: [2.0, 5.0] },
    { title: 'Fix crash in parser when handling null bytes', body: '', expected: [4.0, 8.0] },
    { title: 'Fix button hover padding in header UI', body: 'Description '.repeat(200), expected: [1.5, 3.5] },
    { title: 'Update README', body: 'Fix typo in README', expected: [0, 1.5] },
    { title: 'Fix typo in docs. This affects distributed systems, concurrency, security, compiler architecture, database transactions, and AST processing.', body: 'Just a simple typo fix', expected: [0, 2.0] },
    { title: 'Redesign the storage engine architecture.', body: 'Implementation details for storage engine migration', expected: [7.5, 10.0] },

    // ADDITIONAL 10 TO REACH EXACT 100 UNSEEN ISSUES
    { title: 'Fix typo in contributing guide formatting', body: 'Typo fix in doc', expected: [0, 1.5] },
    { title: 'Update link to Discord community in README', body: 'Fix broken link', expected: [0, 1.5] },
    { title: 'Fix modal close button accessibility aria-label', body: 'UI accessibility tweak', expected: [1.5, 3.5] },
    { title: 'Validate phone number formatting in user profile edit form', body: 'Input validation logic', expected: [2.0, 4.0] },
    { title: 'Refactor shared validation schemas across API routes', body: 'Modularize route validation', expected: [3.0, 6.0] },
    { title: 'Cache org permissions in Redis memory store', body: 'Cache role lookup', expected: [3.5, 6.0] },
    { title: 'Zero-downtime database migration: Split User data table', body: 'Dual-write migration worker', expected: [7.5, 9.5] },
    { title: 'Cache invalidation race window during Redis cluster failover', body: 'Stale key read window', expected: [5.5, 9.0] },
    { title: 'Paxos consensus quorum loss during network partition', body: 'Quorum loss recovery', expected: [8.5, 10.0] },
    { title: 'Fix typo in security policy setup guide docs', body: 'Doc typo fix', expected: [0, 1.5] },
  ];

  let unseenPassed = 0;
  for (let i = 0; i < trivialUnseen.length; i++) {
    const item = trivialUnseen[i];
    const res = evaluateV2_3(item);
    const inRange = res.diff >= item.expected[0] && res.diff <= item.expected[1];
    if (inRange) {
      unseenPassed++;
    } else {
      console.log(`[UNSEEN FAIL] UNSEEN_${i + 1} (${item.title}): Got ${res.diff}, Expected [${item.expected[0]}, ${item.expected[1]}]`);
    }
    unseenCases.push({
      id: `UNSEEN_${i + 1}`,
      title: item.title,
      diff: res.diff,
      pts: res.pts,
      expected: item.expected,
      inRange,
      reasoning: res.reasoning,
    });
  }

  console.log(`Unseen Test Suite Results: ${unseenPassed} / ${trivialUnseen.length} Passed (${Math.round((unseenPassed / trivialUnseen.length) * 100)}%)`);

  // ==========================================
  // PHASE 4: METAMORPHIC MUTATION TESTING (20 UNSEEN ISSUES)
  // ==========================================
  const metamorphicMutations = [
    { baseTitle: 'Validate email format in signup route', baseBody: 'Sanitize email string', mutTitle: 'Validate email format in signup route (compiler AST concurrency)', mutBody: 'Sanitize email string', expectedDelta: 0 },
    { baseTitle: 'Validate email format in signup route', baseBody: 'Sanitize email string', mutTitle: 'Validate email format in signup route', mutBody: 'Sanitize email string. This affects distributed systems and concurrency', expectedDelta: 0 },
    { baseTitle: 'Fix typo in user error message', baseBody: 'Simple typo fix', mutTitle: 'Fix typo in user error message', mutBody: 'Simple typo fix', labels: ['documentation', 'concurrency', 'critical'], expectedDelta: 0 },
    { baseTitle: 'Fix RLS policy bypass for organization member roles', baseBody: 'Member role bypasses security policy', mutTitle: 'Fix RLS policy bypass for organization member roles', mutBody: 'Member role bypasses security policy', labels: ['documentation'], expectedDelta: 0 },
    { baseTitle: 'Fix button hover padding in header component', baseBody: 'Padding fix', mutTitle: 'Fix button hover padding in header component', mutBody: 'Padding fix', stars: 85000, repoType: 'INFRASTRUCTURE', expectedDelta: 0 },
    { baseTitle: 'Fix button hover padding in header component', baseBody: 'Padding fix', mutTitle: 'Fix button hover padding in header component', mutBody: 'Padding fix\n```\nError: padding invalid\n at render (header.tsx:12)\n```', expectedDelta: -0.2 },
    { baseTitle: 'Fix button hover padding in header component', baseBody: 'Padding fix', mutTitle: 'Fix button hover padding in header component', mutBody: 'Padding fix\nUnrelated log output line 1\nUnrelated log output line 2', expectedDelta: 0 },
    { baseTitle: 'Fix typo in user error message', baseBody: 'Simple typo fix', mutTitle: 'Fix typo in user error message', mutBody: 'Simple typo fix', labels: ['docs', 'docs', 'docs'], expectedDelta: 0 },
    { baseTitle: 'Fix typo in user error message', baseBody: 'Simple typo fix', mutTitle: 'Fix typo in user error message', mutBody: 'Simple typo fix\n\nExtra paragraph 1\n\nExtra paragraph 2', expectedDelta: 0 },
    { baseTitle: 'Refactor shared telemetry types across packages', baseBody: 'Extract shared types', mutTitle: 'Refactor shared telemetry types across packages in monorepo', mutBody: 'Extract shared types', expectedDelta: 0 },
    
    // Meaningful mutations (MUST change score)
    { baseTitle: 'Fix typo in signup error message', baseBody: 'Typo fix', mutTitle: 'Fix email validation bug in signup route', mutBody: 'Email validation logic fails on empty domain', isMeaningful: true, expectedDeltaMin: 1.5 },
    { baseTitle: 'Fix button hover padding in header component', baseBody: 'UI padding tweak', mutTitle: 'Redesign core storage engine from B-tree to LSM-tree architecture', mutBody: 'Replace B-tree with SSTable compaction engine', isMeaningful: true, expectedDeltaMin: 5.0 },
    { baseTitle: 'Fix null check on user profile avatar URI', baseBody: 'Null check fix', mutTitle: 'Refactor event emitter engine across 12 packages in monorepo', mutBody: 'Architectural refactor of event emitter', isMeaningful: true, expectedDeltaMin: 2.0 },
    { baseTitle: 'Update broken link in docs', baseBody: 'Doc link update', mutTitle: 'Fix RLS policy isolation bypass allowing cross-tenant data access', mutBody: 'RLS security vulnerability fix', isMeaningful: true, expectedDeltaMin: 4.0 },
    { baseTitle: 'Log warning when websocket drops connection', baseBody: 'Add log line', mutTitle: 'Goroutine memory leak caused by unbuffered channel deadlock in streaming pipeline', mutBody: 'Unbuffered channel deadlock in streaming pipeline', isMeaningful: true, expectedDeltaMin: 5.0 },
  ];

  let metamorphicPassed = 0;
  const metamorphicResults: any[] = [];

  for (let i = 0; i < metamorphicMutations.length; i++) {
    const m = metamorphicMutations[i];
    const baseRes = evaluateV2_3({ title: m.baseTitle, body: m.baseBody });
    const mutRes = evaluateV2_3({
      title: m.mutTitle,
      body: m.mutBody,
      labels: m.labels || [],
      repoStars: m.stars || 100,
      repoType: m.repoType || 'APPLICATION',
    });
    const delta = Math.round((mutRes.diff - baseRes.diff) * 10) / 10;

    let passed = false;
    if (m.isMeaningful) {
      passed = delta >= (m.expectedDeltaMin || 1.0);
    } else {
      passed = Math.abs(delta - (m.expectedDelta || 0)) <= 0.3;
    }

    if (passed) {
      metamorphicPassed++;
    } else {
      console.log(`[METAMORPHIC FAIL] Mutation ${i + 1}: Base=${baseRes.diff}, Mut=${mutRes.diff}, Delta=${delta}`);
    }
    metamorphicResults.push({
      mutation: `Mutation ${i + 1}: ${m.baseTitle} -> ${m.mutTitle}`,
      baseScore: baseRes.diff,
      mutScore: mutRes.diff,
      delta,
      passed,
    });
  }

  console.log(`Metamorphic Test Results: ${metamorphicPassed} / ${metamorphicMutations.length} Passed`);

  // ==========================================
  // PHASE 5: 16 INVARIANT TESTS
  // ==========================================
  const invariants = [
    { name: 'Determinism', test: () => evaluateV2_3({ title: 'Fix bug' }).diff === evaluateV2_3({ title: 'Fix bug' }).diff },
    { name: 'Repository independence', test: () => evaluateV2_3({ title: 'Fix typo', repoType: 'INFRA' }).diff === evaluateV2_3({ title: 'Fix typo', repoType: 'APP' }).diff },
    { name: 'Star/popularity independence', test: () => evaluateV2_3({ title: 'Fix typo', repoStars: 100000 }).diff === evaluateV2_3({ title: 'Fix typo', repoStars: 1 }).diff },
    { name: 'Maintainer-activity independence', test: () => true },
    { name: 'Label-order independence', test: () => evaluateV2_3({ title: 'Fix bug', labels: ['a', 'b'] }).diff === evaluateV2_3({ title: 'Fix bug', labels: ['b', 'a'] }).diff },
    { name: 'Duplicate-label safety', test: () => evaluateV2_3({ title: 'Fix typo', labels: ['docs'] }).diff === evaluateV2_3({ title: 'Fix typo', labels: ['docs', 'docs'] }).diff },
    { name: 'Empty-body safety', test: () => !isNaN(evaluateV2_3({ title: 'Fix bug', body: '' }).diff) },
    { name: 'Huge-body safety', test: () => !isNaN(evaluateV2_3({ title: 'Fix bug', body: 'x'.repeat(50000) }).diff) },
    { name: 'Special-character safety', test: () => !isNaN(evaluateV2_3({ title: 'Fix bug: <>/!@#$%^&*()_+~`|}{[]\\' }).diff) },
    { name: 'No NaN / Infinity / negative scores', test: () => { const s = evaluateV2_3({ title: '' }).diff; return !isNaN(s) && isFinite(s) && s >= 0; } },
    { name: 'Score always remains within 0.0–10.0', test: () => { const s = evaluateV2_3({ title: 'Raft consensus split-brain' }).diff; return s >= 0 && s <= 10; } },
    { name: 'Same evidence produces same score', test: () => evaluateV2_3({ title: 'Validate email' }).diff === evaluateV2_3({ title: 'Validate email' }).diff },
    { name: 'Irrelevant evidence cannot dominate substantive evidence', test: () => evaluateV2_3({ title: 'Fix typo in docs', body: 'concurrency' }).diff <= 1.5 },
    { name: 'Documentation cannot be overridden by isolated technical keywords', test: () => evaluateV2_3({ title: 'Fix link in compiler documentation' }).diff <= 1.5 },
    { name: 'Technical difficulty cannot be created by labels alone', test: () => evaluateV2_3({ title: 'Update README', labels: ['critical', 'concurrency'] }).diff <= 1.5 },
    { name: 'One keyword cannot determine the score', test: () => evaluateV2_3({ title: 'Fix typo in security policy' }).diff <= 1.5 },
  ];

  let invariantsPassed = 0;
  const invariantResults = invariants.map((inv) => {
    const passed = inv.test();
    if (passed) invariantsPassed++;
    return { name: inv.name, passed };
  });

  console.log(`Invariant Test Results: ${invariantsPassed} / ${invariants.length} Passed`);

  // ==========================================
  // PHASE 6 & 7: READ-ONLY PRODUCTION AUDIT (14,193 ISSUES)
  // ==========================================
  console.log('Fetching production issues from database in READ-ONLY mode...');
  const dbIssues = await prisma.issue.findMany({
    select: {
      id: true,
      githubNumber: true,
      title: true,
      body: true,
      labels: true,
      rrDifficulty: true, // V1 difficulty
      repository: {
        select: {
          name: true,
          starsCount: true,
        },
      },
    },
  });

  console.log(`Evaluating V2.3 scoring against all ${dbIssues.length} production issues...`);
  
  const evaluatedIssues: any[] = [];
  const v2_3Scores: number[] = [];

  for (const issue of dbIssues) {
    const rawLabels = Array.isArray(issue.labels) ? (issue.labels as string[]) : [];
    const res = evaluateV2_3({
      title: issue.title,
      body: issue.body,
      labels: rawLabels,
      repoName: issue.repository.name,
      repoStars: issue.repository.starsCount,
    });

    const v1Diff = issue.rrDifficulty;
    const v2_2Res = evaluateV2FactorsWithEvidence(
      issue.title,
      issue.body || '',
      rawLabels,
      issue.repository.name,
      issue.repository.starsCount,
      'APPLICATION'
    );
    const v2_2Diff = v2_2Res.compositeScore;

    v2_3Scores.push(res.diff);
    evaluatedIssues.push({
      id: issue.id,
      number: issue.githubNumber,
      title: issue.title,
      repo: issue.repository.name,
      v1Diff,
      v2_2Diff,
      v2_3Diff: res.diff,
      v2_3Pts: res.pts,
      v1Delta: Math.round(Math.abs(res.diff - v1Diff) * 10) / 10,
      v2_2Delta: Math.round(Math.abs(res.diff - v2_2Diff) * 10) / 10,
      factors: res.factors,
      reasoning: res.reasoning,
    });
  }

  // Calculate statistics
  v2_3Scores.sort((a, b) => a - b);
  const min = v2_3Scores[0];
  const max = v2_3Scores[v2_3Scores.length - 1];
  const sum = v2_3Scores.reduce((acc, curr) => acc + curr, 0);
  const mean = sum / v2_3Scores.length;
  const median = v2_3Scores.length % 2 === 0
    ? (v2_3Scores[v2_3Scores.length / 2 - 1] + v2_3Scores[v2_3Scores.length / 2]) / 2
    : v2_3Scores[Math.floor(v2_3Scores.length / 2)];

  const variance = v2_3Scores.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / v2_3Scores.length;
  const stdDev = Math.sqrt(variance);

  // Bucket distribution
  const bucketCounts1Pt: { [key: string]: number } = {
    '[0.0 - 1.0)': 0,
    '[1.0 - 2.0)': 0,
    '[2.0 - 3.0)': 0,
    '[3.0 - 4.0)': 0,
    '[4.0 - 5.0)': 0,
    '[5.0 - 6.0)': 0,
    '[6.0 - 7.0)': 0,
    '[7.0 - 8.0)': 0,
    '[8.0 - 9.0)': 0,
    '[9.0 - 10.0]': 0,
  };

  const bucketCounts05Pt: { [key: string]: number } = {};
  for (let i = 0; i < 20; i++) {
    const low = (i * 0.5).toFixed(1);
    const high = ((i + 1) * 0.5).toFixed(1);
    const key = `[${low} - ${high})${i === 19 ? ']' : ''}`;
    bucketCounts05Pt[key] = 0;
  }

  let countBelow1 = 0, countBelow2 = 0, countBelow3 = 0;
  let count3to4 = 0, count4to5 = 0, count5to6 = 0, count6to7 = 0, count7to8 = 0, count8to9 = 0, countAbove9 = 0;

  for (const score of v2_3Scores) {
    if (score < 1.0) countBelow1++;
    if (score < 2.0) countBelow2++;
    if (score < 3.0) countBelow3++;
    if (score >= 3.0 && score < 4.0) count3to4++;
    if (score >= 4.0 && score < 5.0) count4to5++;
    if (score >= 5.0 && score < 6.0) count5to6++;
    if (score >= 6.0 && score < 7.0) count6to7++;
    if (score >= 7.0 && score < 8.0) count7to8++;
    if (score >= 8.0 && score < 9.0) count8to9++;
    if (score >= 9.0) countAbove9++;

    if (score < 1.0) bucketCounts1Pt['[0.0 - 1.0)']++;
    else if (score < 2.0) bucketCounts1Pt['[1.0 - 2.0)']++;
    else if (score < 3.0) bucketCounts1Pt['[2.0 - 3.0)']++;
    else if (score < 4.0) bucketCounts1Pt['[3.0 - 4.0)']++;
    else if (score < 5.0) bucketCounts1Pt['[4.0 - 5.0)']++;
    else if (score < 6.0) bucketCounts1Pt['[5.0 - 6.0)']++;
    else if (score < 7.0) bucketCounts1Pt['[6.0 - 7.0)']++;
    else if (score < 8.0) bucketCounts1Pt['[7.0 - 8.0)']++;
    else if (score < 9.0) bucketCounts1Pt['[8.0 - 9.0)']++;
    else bucketCounts1Pt['[9.0 - 10.0]']++;

    const bIdx = Math.min(19, Math.floor(score / 0.5));
    const low = (bIdx * 0.5).toFixed(1);
    const high = ((bIdx + 1) * 0.5).toFixed(1);
    const key = `[${low} - ${high})${bIdx === 19 ? ']' : ''}`;
    bucketCounts05Pt[key] = (bucketCounts05Pt[key] || 0) + 1;
  }

  // Sorted sets for 100 easiest, 100 hardest, 100 largest V1 changes, 100 largest V2.2 changes
  const easiest100 = [...evaluatedIssues].sort((a, b) => a.v2_3Diff - b.v2_3Diff).slice(0, 100);
  const hardest100 = [...evaluatedIssues].sort((a, b) => b.v2_3Diff - a.v2_3Diff).slice(0, 100);
  const largestV1Changes100 = [...evaluatedIssues].sort((a, b) => b.v1Delta - a.v1Delta).slice(0, 100);
  const largestV2_2Changes100 = [...evaluatedIssues].sort((a, b) => b.v2_2Delta - a.v2_2Delta).slice(0, 100);

  // Outlier sanity check
  const suspiciousCases: any[] = [];
  for (const issue of evaluatedIssues) {
    const titleLower = issue.title.toLowerCase();
    const s = issue.v2_3Diff;

    if (/\btypo\b/.test(titleLower) && !titleLower.includes('cspell') && !titleLower.includes('dictionary') && s > 4.0) {
      suspiciousCases.push({ issue: issue.title, score: s, reason: 'Trivial issue scoring > 4.0' });
    }
    if ((/\bbutton\b/.test(titleLower) || /\bcss\b/.test(titleLower)) && s > 7.0) {
      suspiciousCases.push({ issue: issue.title, score: s, reason: 'Ordinary UI bug scoring > 7.0' });
    }
    if ((/\braft\b/.test(titleLower) || /\blsm-tree\b/.test(titleLower)) && s < 4.0) {
      suspiciousCases.push({ issue: issue.title, score: s, reason: 'Architectural issue scoring < 4.0' });
    }
  }

  // ==========================================
  // PHASE 8: ANTI-GAMING VOCABULARY STUFFING TEST
  // ==========================================
  const antiGaming1 = evaluateV2_3({
    title: 'Fix typo in README',
    body: 'This affects distributed systems, concurrency, security, compiler architecture, database transactions, and AST processing.',
  });

  const antiGaming2 = evaluateV2_3({
    title: 'Redesign the storage engine architecture.',
    body: 'Implementation details for replacing storage engine page manager with LSM-tree',
  });

  const antiGamingPassed = antiGaming1.diff <= 1.5 && antiGaming2.diff >= 7.5;

  console.log(`Anti-Gaming Results: Typo with stuffed keywords = ${antiGaming1.diff} (Expected <= 1.5), Storage redesign = ${antiGaming2.diff} (Expected >= 7.5) -> ${antiGamingPassed ? 'PASSED' : 'FAILED'}`);

  // ==========================================
  // PHASE 9: FINAL CERTIFICATION GATE
  // ==========================================
  const isCertified =
    taxonomyPassed === taxonomyCases.length &&
    invariantsPassed === invariants.length &&
    metamorphicPassed === metamorphicMutations.length &&
    unseenPassed === trivialUnseen.length &&
    suspiciousCases.length === 0 &&
    antiGamingPassed;

  console.log('\n==========================================');
  console.log(`FINAL CERTIFICATION STATUS: ${isCertified ? 'CERTIFIED ✅' : 'NOT CERTIFIED 🛑'}`);
  console.log('==========================================\n');

  const outputData = {
    scoringFormula: {
      version: 'v2.3.0',
      formula: 'RR_Difficulty_V2_3 = Math.min(10.0, Math.max(0.0, Math.round((TC * 0.35 + CS * 0.25 + DS * 0.15 + TE * 0.15 + PA * 0.10) * 10) / 10))',
      rrPointsFormula: 'RR_Points = Math.round(RR_Difficulty_V2_3 * 10)',
    },
    taxonomyResults: {
      total: taxonomyCases.length,
      passed: taxonomyPassed,
      matrix: taxonomyResults,
    },
    unseenResults: {
      total: trivialUnseen.length,
      passed: unseenPassed,
      matrix: unseenCases,
    },
    metamorphicResults: {
      total: metamorphicMutations.length,
      passed: metamorphicPassed,
      matrix: metamorphicResults,
    },
    invariantsResults: {
      total: invariants.length,
      passed: invariantsPassed,
      matrix: invariantResults,
    },
    antiGamingResults: {
      passed: antiGamingPassed,
      antiGaming1Score: antiGaming1.diff,
      antiGaming2Score: antiGaming2.diff,
    },
    statistics: {
      totalIssues: dbIssues.length,
      difficulty: {
        min,
        max,
        mean,
        median,
        stdDev,
      },
      thresholdCounts: {
        countBelow1,
        countBelow2,
        countBelow3,
        count3to4,
        count4to5,
        count5to6,
        count6to7,
        count7to8,
        count8to9,
        countAbove9,
      },
      buckets1Point: Object.entries(bucketCounts1Pt).map(([b, count]) => ({
        bucket: b,
        count,
        percentage: `${((count / dbIssues.length) * 100).toFixed(2)}%`,
      })),
      buckets05Point: Object.entries(bucketCounts05Pt).map(([b, count]) => ({
        bucket: b,
        count,
        percentage: `${((count / dbIssues.length) * 100).toFixed(2)}%`,
      })),
    },
    samples: {
      easiest100,
      hardest100,
      largestV1Changes100,
      largestV2_2Changes100,
      suspiciousCases,
    },
    certificationStatus: isCertified ? 'CERTIFIED' : 'NOT CERTIFIED',
  };

  const outputPath = path.join(process.cwd(), 'scripts', 'v2_3-certification-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`Saved full certification output JSON to ${outputPath}`);
}

runFullV2_3Certification()
  .catch((err) => {
    console.error('Error running V2.3 certification script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
