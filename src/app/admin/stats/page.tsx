import React from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkIsAdmin } from '@/lib/auth/admin-auth';
import { AdminStatsClientView } from '@/components/admin/AdminStatsClientView';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin Analytics | Repo Rescue',
  description: 'Internal administrator product analytics dashboard.',
};

export const dynamic = 'force-dynamic';

export default async function AdminStatsPage() {
  // 1. Server-Side Session Verification (Logged out -> Redirect to Sign In)
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin?callbackUrl=/admin/stats');
  }

  // 2. Server-Side Admin Authorization (Logged-in non-admin -> HTTP 403 Access Denied)
  const isAdmin = await checkIsAdmin(session);

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 font-mono">
        <div className="max-w-md w-full p-8 rounded-2xl border border-rose-900/50 bg-slate-950 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.2)]">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-[11px] font-bold text-rose-400">
              HTTP 403 — FORBIDDEN
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Access Denied</h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              This metrics dashboard is strictly restricted to authorized Repo Rescue administrators.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-900 flex justify-center">
            <Link
              href="/issues"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Issues</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render Dashboard Component for Authorized Admins Only
  return <AdminStatsClientView />;
}
