import { NextRequest, NextResponse } from 'next/server';
import { verifyGitHubWebhookSignature } from '@/lib/contributions/verify';
import {
  processLiveIssueEvent,
  processLivePREvent,
  processLiveCommentEvent,
} from '@/lib/injector/sync-service';
import { prisma, withPrismaRetry } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const eventType = req.headers.get('x-github-event') || 'unknown';
  const deliveryId = req.headers.get('x-github-delivery') || undefined;

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'repo-rescue-v1-webhook-secret-2026';

    // 1. HMAC SHA-256 Signature Verification
    if (process.env.NODE_ENV === 'production' || signature) {
      const isValidSig = verifyGitHubWebhookSignature(rawBody, signature, secret);
      if (!isValidSig) {
        await withPrismaRetry(() =>
          prisma.syncAuditLog.create({
            data: {
              eventType: `webhook.${eventType}`,
              status: 'FAILED',
              errorMessage: 'Unauthorized: Invalid or missing GitHub webhook signature.',
            },
          })
        );

        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing GitHub webhook signature.' },
          { status: 401 }
        );
      }
    }

    // 2. Event Type Dispatching
    const payload = JSON.parse(rawBody);

    if (eventType === 'issues') {
      const syncResult = await processLiveIssueEvent(payload, deliveryId);
      return NextResponse.json(syncResult, { status: 200 });
    }

    if (eventType === 'pull_request') {
      const prResult = await processLivePREvent(payload, deliveryId);
      return NextResponse.json(prResult, { status: 200 });
    }

    if (eventType === 'issue_comment') {
      const commentResult = await processLiveCommentEvent(payload, deliveryId);
      return NextResponse.json(commentResult, { status: 200 });
    }

    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          organizationId: payload?.repository?.owner?.login,
          repositoryId: payload?.repository?.full_name,
          eventType: `webhook.${eventType}`,
          status: 'SKIPPED',
          changesSummary: `Event type '${eventType}' ignored. Supported: 'issues', 'pull_request', 'issue_comment'.`,
        },
      })
    );

    return NextResponse.json(
      { message: `Event type '${eventType}' ignored. Supported events: 'issues', 'pull_request', 'issue_comment'.` },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('❌ GitHub Webhook Error:', err);
    await withPrismaRetry(() =>
      prisma.syncAuditLog.create({
        data: {
          eventType: `webhook.${eventType}`,
          status: 'FAILED',
          errorMessage: err.message || String(err),
        },
      })
    );

    return NextResponse.json(
      { error: 'Internal Server Error processing GitHub webhook.', details: err.message },
      { status: 500 }
    );
  }
}
