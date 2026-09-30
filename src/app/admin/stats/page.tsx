'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  Calendar,
  Award,
  GitPullRequest,
  Database,
  RefreshCw,
  Search,
  Building2,
  GitFork,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  DatabaseZap,
  Eye,
  Globe,
  Compass,
  ArrowUpRight,
} from 'lucide-react';

interface StatsData {
  totalUsers: number;
  realUsersCount: number;
  seededUsersCount: number;
  users24h: number;
  users7d: number;
  users30d: number;
  activeSessions: number;
  totalContributions: number;
  totalPullRequests: number;
  totalPointsAwarded: number;
  totalOrganizations: number;
  totalRepositories: number;
  totalIssues: number;

  // Traffic
  totalPageViews: number;
  pageViews24h: number;
  uniqueVisitors: number;
  uniqueVisitors24h: number;
}

interface UserItem {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  githubUsername?: string | null;
  role: string;
  totalPoints: number;
  rrRating: number;
  createdAt: string;
  hasOAuthAccount?: boolean;
}

interface TopPage {
  path: string;
  count: number;
}

interface RecentPageView {
  id: string;
  path: string;
  visitorId?: string | null;
  userId?: string | null;
  createdAt: string;
}

interface DailyTraffic {
  date: string;
  signups: number;
  pageViews: number;
  uniqueVisitors: number;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserItem[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [recentPageViews, setRecentPageViews] = useState<RecentPageView[]>([]);
  const [dailyTraffic, setDailyTraffic] = useState<DailyTraffic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'seeded'>('all');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load analytics statistics');
      }

      setStats(data.stats);
      setRecentUsers(data.recentUsers || []);
      setTopPages(data.topPages || []);
      setRecentPageViews(data.recentPageViews || []);
      setDailyTraffic(data.dailyTraffic || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const filteredUsers = recentUsers.filter((user) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (user.name && user.name.toLowerCase().includes(term)) ||
      (user.githubUsername && user.githubUsername.toLowerCase().includes(term)) ||
      (user.email && user.email.toLowerCase().includes(term)) ||
      user.role.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (filterType === 'real') return user.hasOAuthAccount;
    if (filterType === 'seeded') return !user.hasOAuthAccount;

    return true;
  });

  const maxPageViewCount = Math.max(...dailyTraffic.map((d) => d.pageViews), 1);
  const conversionRate = stats
    ? ((stats.realUsersCount / Math.max(stats.uniqueVisitors, 1)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-blue-400 mb-1">
              <Shield className="w-4 h-4" />
              <span>ADMIN ANALYTICS DASHBOARD</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              User & Visitor Analytics
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live insights on web traffic, page visits, unique visitors, and authenticated GitHub users.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-200 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-800/50 bg-rose-950/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchStats} className="underline text-xs">
              Retry
            </button>
          </div>
        )}

        {/* SECTION 1: WEB TRAFFIC & VISITOR ANALYTICS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
              <Globe className="w-5 h-5 text-cyan-400" />
              WEB TRAFFIC & VISITORS
            </h2>
            <span className="text-xs font-mono text-slate-400">Live Visit Tracking Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Page Views */}
            <div className="p-5 rounded-xl border border-cyan-800/50 bg-cyan-950/20 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">Total Page Views</span>
                <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-cyan-300">
                {loading ? <span className="animate-pulse">...</span> : stats?.totalPageViews.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-400 font-bold">+{stats?.pageViews24h || 0}</span> in past 24 hours
              </div>
            </div>

            {/* Unique Visitors */}
            <div className="p-5 rounded-xl border border-indigo-800/50 bg-indigo-950/20 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-300">Unique Web Visitors</span>
                <div className="p-2 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                  <Globe className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-indigo-300">
                {loading ? <span className="animate-pulse">...</span> : stats?.uniqueVisitors.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-300 font-bold">+{stats?.uniqueVisitors24h || 0}</span> unique today
              </div>
            </div>

            {/* Real Signed-In OAuth Users */}
            <div className="p-5 rounded-xl border border-emerald-800/50 bg-emerald-950/20 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-300">OAuth Logged-In Users</span>
                <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-emerald-300">
                {loading ? <span className="animate-pulse">...</span> : stats?.realUsersCount}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified GitHub accounts</span>
              </div>
            </div>

            {/* Visitor to Sign-up Conversion */}
            <div className="p-5 rounded-xl border border-purple-800/50 bg-purple-950/20 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono uppercase tracking-wider text-purple-300">Visitor Conversion Rate</span>
                <div className="p-2 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/60">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-purple-300">
                {loading ? <span className="animate-pulse">...</span> : `${conversionRate}%`}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <span>Unique Visitors → Logged-In Users</span>
              </div>
            </div>
          </div>
        </div>

        {/* Traffic Chart & Top Pages Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Traffic Chart (Past 14 Days) */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800/90 bg-slate-950/60 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Visitor Traffic & Sign-ups (Past 14 Days)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily comparison of total page views and unique visitors.
                </p>
              </div>
            </div>

            <div className="h-48 flex items-end justify-between gap-2 pt-6 border-b border-slate-800/80 pb-2">
              {dailyTraffic.map((day) => {
                const heightPercent = Math.max((day.pageViews / maxPageViewCount) * 100, 6);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center">
                      <span className="text-cyan-300">{day.pageViews} views</span>
                      <span className="text-indigo-300">{day.uniqueVisitors} visitors</span>
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[28px] bg-gradient-to-t from-cyan-600 to-indigo-400 rounded-t-md group-hover:from-cyan-500 group-hover:to-indigo-300 transition-all shadow-sm"
                    />
                    <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Visited Routes */}
          <div className="p-6 rounded-xl border border-slate-800/90 bg-slate-950/60 backdrop-blur-xl space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <Compass className="w-4 h-4 text-blue-400" />
                Top Visited Pages
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Most popular routes viewed by site visitors.
              </p>
            </div>

            <div className="space-y-3 my-auto">
              {topPages.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">No visits logged yet.</p>
              ) : (
                topPages.map((page) => (
                  <div key={page.path} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs font-mono">
                    <span className="font-semibold text-slate-200">{page.path}</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50 font-bold">
                      {page.count} views
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono text-center border-t border-slate-800/60 pt-3">
              Automated visitor tracking active
            </div>
          </div>
        </div>

        {/* SECTION 2: USER DIRECTORY & SEEDED PROFILES */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
              <Users className="w-5 h-5 text-emerald-400" />
              USER DATABASE & PROFILES
            </h2>
          </div>

          {/* Highlight Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 backdrop-blur-xl flex items-center gap-5">
              <div className="p-3.5 rounded-xl bg-emerald-900/50 text-emerald-400 border border-emerald-700/50">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  AUTHENTICATED OAUTH USERS
                </div>
                <div className="text-3xl font-black font-mono text-white mt-0.5">
                  {loading ? '...' : stats?.realUsersCount} <span className="text-xs font-normal text-emerald-300">signed in via GitHub</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl flex items-center gap-5">
              <div className="p-3.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                <DatabaseZap className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                  SEEDED PROFILES
                </div>
                <div className="text-3xl font-black font-mono text-slate-200 mt-0.5">
                  {loading ? '...' : stats?.seededUsersCount} <span className="text-xs font-normal text-slate-400">indexed open-source devs</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Directory Table */}
          <div className="p-6 rounded-xl border border-slate-800/90 bg-slate-950/60 backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <Users className="w-4 h-4 text-emerald-400" />
                  User Directory ({filteredUsers.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  List of registered users with OAuth verification status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({recentUsers.length})
                  </button>
                  <button
                    onClick={() => setFilterType('real')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'real' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    OAuth Real Only
                  </button>
                  <button
                    onClick={() => setFilterType('seeded')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'seeded' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Seeded
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search username/email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">OAuth Status</th>
                    <th className="py-3 px-4">GitHub</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">RR Points</th>
                    <th className="py-3 px-4">Signed Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <img
                            src={user.image || 'https://avatars.githubusercontent.com/u/583231?v=4'}
                            alt={user.githubUsername || 'User'}
                            className="w-7 h-7 rounded-full border border-slate-700"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-100">{user.name || 'Unnamed User'}</span>
                            <span className="text-[10px] text-slate-500">{user.email || 'No public email'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {user.hasOAuthAccount ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              YES (GitHub OAuth)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px]">
                              Seeded Profile
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {user.githubUsername ? (
                            <a
                              href={`https://github.com/${user.githubUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                            >
                              <span>@{user.githubUsername}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </a>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              user.role === 'ADMIN'
                                ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                                : user.role === 'MAINTAINER'
                                ? 'bg-purple-950/80 text-purple-400 border border-purple-800/50'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-400">
                          {user.totalPoints.toLocaleString()} RR
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(user.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
