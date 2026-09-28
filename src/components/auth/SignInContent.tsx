'use client';

import React, { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Shield, Github, ArrowLeft, Lock } from 'lucide-react';

function sanitizeCallbackUrl(urlStr: string | null | undefined): string {
  if (!urlStr) return '/issues';
  // Open redirect prevention: strictly allow relative path starting with '/' (and not '//' or containing protocol)
  if (urlStr.startsWith('/') && !urlStr.startsWith('//') && !urlStr.includes('://')) {
    return urlStr;
  }
  return '/issues';
}

export function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = useMemo(() => sanitizeCallbackUrl(rawCallbackUrl), [rawCallbackUrl]);

  // If user is already authenticated, redirect straight to requested destination
  React.useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push(callbackUrl);
    }
  }, [status, session, callbackUrl, router]);

  const handleSignIn = () => {
    signIn('github', { callbackUrl });
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-2xl border border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center space-y-6 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />

        {/* Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <Lock className="w-7 h-7" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-2xl font-mono font-extrabold text-slate-100 tracking-tight">
            Sign in required
          </h1>
          <p className="text-sm font-sans text-slate-400 leading-relaxed">
            Please sign in with GitHub to continue.
          </p>
        </div>

        {/* Target route indicator */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Protected Route: <strong className="text-slate-200">{callbackUrl}</strong></span>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <button
            onClick={handleSignIn}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-sm shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all group active:scale-[0.98]"
          >
            <Github className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span>Sign in with GitHub</span>
          </button>
        </div>

        {/* Return Home Link */}
        <div className="pt-2 border-t border-slate-900">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Homepage</span>
          </a>
        </div>
      </div>
    </div>
  );
}
