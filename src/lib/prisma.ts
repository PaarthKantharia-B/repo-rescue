import { PrismaClient } from '@prisma/client';

// For web application runtime (e.g., Next.js serverless), default to standard DATABASE_URL.
// For CLI / backfill / smoke-test commands, use DIRECT_URL when available to avoid PgBouncer pooler timeouts.
const isCli =
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv.some((arg) =>
    arg.includes('scripts') ||
    arg.includes('scratch') ||
    arg.includes('backfill') ||
    arg.includes('smoke-test') ||
    arg.includes('ts-node') ||
    arg.includes('tsx')
  );

/**
 * Safely appends connection_limit and pool_timeout URL query parameters for bounded database connection management.
 */
export function configureConnectionPoolParams(
  rawUrl: string | undefined,
  limit = 2,
  timeoutSeconds = 30,
  connectTimeoutSeconds = 15
): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(limit));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(timeoutSeconds));
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', String(connectTimeoutSeconds));
    }
    return url.toString();
  } catch (_) {
    return rawUrl;
  }
}

const rawConnectionUrl = (isCli ? process.env.DIRECT_URL : undefined) || process.env.DATABASE_URL;

// Bound connection pool to 3 connections max for web runtime and 5 for CLI to prevent PgBouncer exhaustion
const connectionUrl = isCli
  ? configureConnectionPoolParams(rawConnectionUrl, 5, 30, 15)
  : configureConnectionPoolParams(rawConnectionUrl, 3, 20, 10);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: connectionUrl ? { db: { url: connectionUrl } } : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Detects transient Prisma / PostgreSQL connection errors.
 */
export function isTransientPrismaError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.prismaCode;
  const msg = String(err.message || err);
  if (code === 'P1017' || code === 'P1001' || code === 'P1002' || code === 'P2024') return true;
  if (
    msg.includes('Server has closed the connection') ||
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EPIPE') ||
    msg.includes('connection pool')
  ) {
    return true;
  }
  return false;
}

/**
 * Detects whether an error represents a P2024 connection pool checkout timeout.
 */
export function isPoolTimeoutError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.prismaCode;
  const msg = String(err.message || err);
  if (code === 'P2024') return true;
  if (
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('connection pool')
  ) {
    return true;
  }
  return false;
}

/**
 * Detects whether an error represents a broken / closed TCP connection (excluding P2024 pool timeouts).
 */
export function isConnectionClosedError(err: any): boolean {
  if (!err) return false;
  if (isPoolTimeoutError(err)) return false;
  const code = err.code || err.prismaCode;
  const msg = String(err.message || err);
  if (code === 'P1017' || code === 'P1001' || code === 'P1002') return true;
  if (
    msg.includes('Server has closed the connection') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EPIPE')
  ) {
    return true;
  }
  return false;
}

let reconnectPromise: Promise<void> | null = null;

/**
 * Safely reconnects Prisma using a single-flight mutex with bounded step timeouts to prevent indefinite hanging.
 */
async function safePrismaReconnect(): Promise<void> {
  if (reconnectPromise) {
    return reconnectPromise;
  }
  reconnectPromise = (async () => {
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Prisma reconnect step timed out after ${ms}ms`)), ms)
        ),
      ]);

    try {
      await withTimeout(prisma.$disconnect().catch(() => {}), 5000).catch((e) =>
        console.warn('[Prisma Reconnect] Disconnect step timed out or failed:', e)
      );
      await new Promise((r) => setTimeout(r, 200));
      await withTimeout(prisma.$connect().catch(() => {}), 5000).catch((e) =>
        console.warn('[Prisma Reconnect] Connect step timed out or failed:', e)
      );
    } catch (err) {
      console.warn('[Prisma Reconnect] Mutex reconnect attempt error:', err);
    } finally {
      reconnectPromise = null;
    }
  })();
  return reconnectPromise;
}

/**
 * Executes a Prisma operation with bounded exponential backoff, jitter, and connection reset for transient errors.
 * P2024 connection pool timeouts perform backoff without calling $disconnect/$connect.
 */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isPoolTimeout = isPoolTimeoutError(err);
      const isClosed = isConnectionClosedError(err);
      const isTransient = isTransientPrismaError(err);

      if (attempt <= maxRetries && (isTransient || isPoolTimeout || isClosed)) {
        if (isClosed && !isPoolTimeout) {
          console.warn(
            `[Prisma Retry] Broken connection error (attempt ${attempt}/${maxRetries}): ${
              err.message || err
            }. Reconnecting via bounded mutex...`
          );
          await safePrismaReconnect();
        } else if (isPoolTimeout) {
          console.warn(
            `[Prisma Retry] Connection pool timeout P2024 (attempt ${attempt}/${maxRetries}): ${
              err.message || err
            }. Waiting for connection pool to drain (no reconnect)...`
          );
        } else {
          console.warn(
            `[Prisma Retry] Transient database error (attempt ${attempt}/${maxRetries}): ${
              err.message || err
            }. Backing off...`
          );
        }

        // Bounded exponential backoff with jitter to prevent connection thrashes
        const jitter = Math.floor(Math.random() * 250);
        const delay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}


