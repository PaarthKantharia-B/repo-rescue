'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Shield, Sparkles, Trophy, Compass, Github, Terminal, User, LogOut, ChevronDown, BookOpen, Menu, X, MessageSquare, BarChart2, GitPullRequest } from 'lucide-react';
import { PointsDisplay } from '../ui/PointsDisplay';

export const Navbar: React.FC = () => {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const currentUser = session?.user;
  const username = currentUser?.githubUsername || currentUser?.name || 'contributor';
  const totalPoints = currentUser?.totalPoints ?? 0;

  const navItems = [
    { href: '/issues', label: 'Issues', icon: Compass, activeColor: 'text-blue-400' },
    { href: '/contributions', label: 'Contributions', icon: GitPullRequest, activeColor: 'text-emerald-400' },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, activeColor: 'text-amber-400' },
    { href: '/guidance', label: 'Guidance', icon: BookOpen, activeColor: 'text-purple-400' },
    { href: '/talk-to-the-founder', label: 'Talk to Founder', icon: MessageSquare, activeColor: 'text-emerald-400' },
    { href: '/admin/stats', label: 'Analytics', icon: BarChart2, activeColor: 'text-cyan-400' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-blue-950 border border-blue-600/50 text-blue-400 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
              <Shield className="w-5 h-5 fill-blue-500/20" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-extrabold text-lg text-slate-100 tracking-tight flex items-center gap-1">
                REPO<span className="text-blue-500">RESCUE</span>
              </span>
              <span className="text-[9px] font-mono text-slate-400 tracking-widest uppercase -mt-1">
                Codeforces for Open Source
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 font-mono text-xs">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 font-semibold ${
                    isActive
                      ? 'text-white bg-slate-900 border border-slate-800 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.activeColor}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Auth Action Header + Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            /* Authenticated Contributor State */
            <div className="flex items-center gap-3">
              <PointsDisplay points={totalPoints} highlight size="sm" />

              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-all font-mono text-xs"
                >
                  <img
                    src={currentUser.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
                    alt={username}
                    className="w-6 h-6 rounded-full border border-slate-700"
                  />
                  <span className="font-bold text-slate-200 hidden sm:inline">@{username}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl space-y-1 font-mono text-xs z-50">
                    <Link
                      href={`/profile/${username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      <User className="w-4 h-4 text-blue-400" />
                      <span>Contributor Profile</span>
                    </Link>

                    <Link
                      href="/contributions"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      <GitPullRequest className="w-4 h-4 text-emerald-400" />
                      <span>My Contributions</span>
                    </Link>

                    <Link
                      href="/admin/stats"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      <BarChart2 className="w-4 h-4 text-cyan-400" />
                      <span>Admin Analytics</span>
                    </Link>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Unauthenticated Contributor State */
            <button
              onClick={() => {
                const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const callbackUrl = searchParams?.get('callbackUrl') || undefined;
                signIn('github', callbackUrl ? { callbackUrl } : undefined);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all font-mono"
            >
              <Github className="w-4 h-4 text-slate-300" />
              <span>Sign In with GitHub</span>
            </button>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 pt-3 pb-4 space-y-2 backdrop-blur-xl font-mono text-xs">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-semibold transition-colors ${
                  isActive
                    ? 'text-white bg-slate-900 border border-slate-800 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.activeColor}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
