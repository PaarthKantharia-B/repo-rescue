import { NextRequest } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  reason?: string;
  source?: 'vercel-cron' | 'bearer-token' | 'header-secret' | 'query-secret';
}

/**
 * Validates whether an incoming request to the synchronization endpoint is authorized.
 * 
 * Authorization is granted if ANY of the following conditions are met:
 * 1. Request contains the Vercel internal header 'x-vercel-cron' (Vercel Cron Service)
 * 2. Request header 'Authorization' matches 'Bearer <SYNC_CRON_SECRET>' (or CRON_SECRET / ADMIN_SYNC_SECRET)
 * 3. Request header 'x-cron-secret' or 'x-admin-secret' matches the secret
 * 4. Request query parameter 'secret' or 'cron_secret' matches the secret
 */
export function validateCronAuth(
  req: NextRequest | { headers: { get(name: string): string | null }; url: string }
): CronAuthResult {
  // 1. Internal Vercel Cron header
  if (req.headers.get('x-vercel-cron') !== null) {
    return { authorized: true, source: 'vercel-cron' };
  }

  // 2. Fetch expected secret from environment variables
  const expectedSecret =
    process.env.SYNC_CRON_SECRET || process.env.CRON_SECRET || process.env.ADMIN_SYNC_SECRET;

  // If no secret is configured in environment, reject external non-Vercel requests for safety
  if (!expectedSecret) {
    return {
      authorized: false,
      reason: 'Unauthorized: SYNC_CRON_SECRET is not configured on server.',
    };
  }

  // 3. Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    if (authHeader === `Bearer ${expectedSecret}` || authHeader === expectedSecret) {
      return { authorized: true, source: 'bearer-token' };
    }
  }

  // 4. Check custom secret headers
  const customHeader = req.headers.get('x-cron-secret') || req.headers.get('x-admin-secret');
  if (customHeader === expectedSecret) {
    return { authorized: true, source: 'header-secret' };
  }

  // 5. Check URL query parameters
  try {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret') || url.searchParams.get('cron_secret');
    if (querySecret === expectedSecret) {
      return { authorized: true, source: 'query-secret' };
    }
  } catch {
    // Ignore URL parsing error
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Invalid or missing synchronization authorization secret.',
  };
}
