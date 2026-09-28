import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/injector/orchestrator';
import { validateCronAuth } from '@/lib/auth/cron-auth';

export async function POST(req: NextRequest) {
  try {
    const auth = validateCronAuth(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.reason || 'Unauthorized: Invalid or missing authorization secret.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'incremental';
    const target = body.target || undefined;

    if (action === 'repo') {
      if (!target) {
        return NextResponse.json(
          { error: "Missing required 'target' repository fullName (e.g. 'supabase/supabase')." },
          { status: 400 }
        );
      }
      const mode = body.mode || 'incremental';
      const job = mode === 'full'
        ? await orchestrator.runRepositorySync(target)
        : await orchestrator.runIncrementalRepoSync(target);
      const health = orchestrator.getSyncHealth();
      return NextResponse.json({ message: `Repository ${mode} sync trigger completed for '${target}'.`, job, health }, { status: 200 });
    }

    if (action === 'org') {
      if (!target) {
        return NextResponse.json(
          { error: "Missing required 'target' organization login (e.g. 'supabase')." },
          { status: 400 }
        );
      }
      const job = await orchestrator.runOrganizationSync(target);
      const health = orchestrator.getSyncHealth();
      return NextResponse.json({ message: `Organization sync trigger completed for '${target}'.`, job, health }, { status: 200 });
    }

    if (action === 'incremental') {
      const job = await orchestrator.runIncrementalSync();
      const health = orchestrator.getSyncHealth();
      return NextResponse.json({ message: 'Incremental multi-organization REST sync trigger completed.', job, health }, { status: 200 });
    }

    if (action === 'full') {
      const job = await orchestrator.runFullSync();
      const health = orchestrator.getSyncHealth();
      return NextResponse.json({ message: 'Full multi-organization reconciliation trigger completed.', job, health }, { status: 200 });
    }

    return NextResponse.json(
      { error: `Invalid action '${action}'. Supported actions: 'incremental', 'full', 'repo', 'org'.` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('❌ Admin Sync Route Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error triggering manual sync.', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isCron = searchParams.get('cron') === 'true' || req.headers.get('x-vercel-cron') !== null;

    if (isCron) {
      const auth = validateCronAuth(req);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.reason || 'Unauthorized: Invalid or missing cron synchronization secret.' },
          { status: 401 }
        );
      }

      const mode = searchParams.get('mode') || searchParams.get('action') || 'incremental';
      const target = searchParams.get('target') || undefined;

      if (target) {
        const job = await orchestrator.runIncrementalRepoSync(target);
        const health = orchestrator.getSyncHealth();
        return NextResponse.json({ message: `Cron incremental sync completed for '${target}'.`, job, health }, { status: 200 });
      }

      if (mode === 'full') {
        const job = await orchestrator.runFullSync();
        const health = orchestrator.getSyncHealth();
        return NextResponse.json({ message: 'Cron full safety-net reconciliation completed.', job, health }, { status: 200 });
      }

      const job = await orchestrator.runIncrementalSync();
      const health = orchestrator.getSyncHealth();
      return NextResponse.json({ message: 'Cron incremental REST sync completed.', job, health }, { status: 200 });
    }

    const health = orchestrator.getSyncHealth();
    return NextResponse.json({ health }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed retrieving sync health.', details: err.message }, { status: 500 });
  }
}
