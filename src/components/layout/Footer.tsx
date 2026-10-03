import React from 'react';
import { Github, Terminal, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/90 py-12 text-slate-400 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src="/panther-logo.png" alt="Repo Rescue Logo" className="w-8 h-8 object-contain" />
          <div>
            <div className="font-mono font-bold text-slate-200 text-sm">Repo Rescue V1</div>
            <p className="text-xs text-slate-500">The Competitive Open-Source Platform</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span>Auditable Points Ledger Active</span>
          </span>
          <span>•</span>
          <a href="/talk-to-the-founder" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            <span>💬 Talk to the Founder</span>
          </a>
        </div>

        <div className="text-xs font-mono text-slate-400">
          © {new Date().getFullYear()} Repo Rescue Inc.
        </div>
      </div>
    </footer>
  );
};
