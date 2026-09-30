import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Compass,
  Trophy,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Cpu,
  Layers,
  Target,
  Brain,
  Sparkles,
  CheckSquare,
  FileText,
  Activity,
  GitPullRequest,
  Search,
  Award,
  AlertTriangle,
  Info,
  Sliders,
  Scale,
  Code2,
  Lock,
  Database,
  Terminal,
} from 'lucide-react';

export const metadata = {
  title: 'Guidance & Scoring System • Repo Rescue',
  description: 'Understand how Repo Rescue evaluates issues using the V2.3.0 Evidence Accumulation Engine, awards RR Points, and builds verified contributor reputation.',
};

export default function GuidancePage() {
  const v2Factors = [
    {
      id: 1,
      name: 'TECHNICAL COMPLEXITY',
      code: 'TC',
      desc: 'Algorithmic depth, system execution complexity, memory structures, and architectural logic suggested by the issue text.',
      icon: Cpu,
      color: 'text-blue-400',
      bgColor: 'bg-blue-950/40 border-blue-800/40',
    },
    {
      id: 2,
      name: 'SCOPE OF CHANGE',
      code: 'CS',
      desc: 'The expected breadth of the change, inferred from the issue evidence — such as localized changes, multiple files/modules, packages, or architectural boundaries.',
      icon: Layers,
      color: 'text-purple-400',
      bgColor: 'bg-purple-950/40 border-purple-800/40',
    },
    {
      id: 3,
      name: 'DOMAIN SPECIALIZATION',
      code: 'DS',
      desc: 'Specialized technical background inferred from issue evidence (e.g. compilers, distributed consensus, MVCC, async streams, RLS policies).',
      icon: Brain,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-800/40',
    },
    {
      id: 4,
      name: 'TESTING & VERIFICATION EFFORT',
      code: 'TE',
      desc: 'Inferred testing and validation requirement suggested by the issue description, labels, and system area.',
      icon: CheckSquare,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/40 border-amber-800/40',
    },
    {
      id: 5,
      name: 'PROBLEM AMBIGUITY',
      code: 'PA',
      desc: 'How much additional triage and investigation the issue appears to require based on the available description and evidence.',
      icon: Target,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40 border-emerald-800/40',
    },
  ];

  const difficultyRanges = [
    {
      range: '0.0 – 1.0',
      tier: 'Trivial',
      color: 'text-slate-300 border-slate-700 bg-slate-900/60',
      desc: 'Trivial documentation fixes, typos, README corrections, broken links, i18n translation strings, code formatting.',
      example: 'Fix typo in user error message (0.4)',
    },
    {
      range: '1.0 – 2.0',
      tier: 'Very Easy',
      color: 'text-emerald-400 border-emerald-900/60 bg-emerald-950/20',
      desc: 'Very small localized changes, dependency version bumps, straightforward config adjustments, minor style tweaks.',
      example: 'Bump lodash patch version or update config comment (1.2)',
    },
    {
      range: '2.0 – 3.0',
      tier: 'Easy',
      color: 'text-emerald-300 border-emerald-800/60 bg-emerald-950/30',
      desc: 'Simple localized bugs, small UI component padding fixes, null-check validations, simple date/string helper updates.',
      example: 'Fix button hover alignment or null check on avatar URI (2.5)',
    },
    {
      range: '3.0 – 4.0',
      tier: 'Moderate',
      color: 'text-blue-400 border-blue-900/60 bg-blue-950/20',
      desc: 'Standard bug fixes and feature work requiring meaningful code changes, route validation, or API response field updates.',
      example: 'Validate email format in signup route (3.5)',
    },
    {
      range: '4.0 – 5.0',
      tier: 'Substantial',
      color: 'text-blue-300 border-blue-800/60 bg-blue-950/30',
      desc: 'Multi-file bug fixes, moderate refactoring across components, non-trivial unit/e2e testing setup.',
      example: 'Refactor shared telemetry types across workspace packages (4.7)',
    },
    {
      range: '5.0 – 6.0',
      tier: 'Hard',
      color: 'text-purple-400 border-purple-900/60 bg-purple-950/20',
      desc: 'Substantial subsystem work, security/RLS access policy enforcement, multi-file auth token invalidation, parser edge-case crash handling.',
      example: 'Fix RLS policy bypass for organization member roles (5.2)',
    },
    {
      range: '6.0 – 7.0',
      tier: 'Very Hard',
      color: 'text-purple-300 border-purple-800/60 bg-purple-950/30',
      desc: 'Significant architectural refactoring, cross-package event bus changes, complex subsystem interactions.',
      example: 'Cross-package refactor of core event emitter engine in monorepo (6.4)',
    },
    {
      range: '7.0 – 8.0',
      tier: 'Complex Systems',
      color: 'text-amber-400 border-amber-900/60 bg-amber-950/20',
      desc: 'Highly complex issues involving worker thread pool concurrency, mutex race windows, database schema migrations, or compiler AST passes.',
      example: 'Worker thread pool mutex race condition or AST transformation bug (7.8)',
    },
    {
      range: '8.0 – 9.0',
      tier: 'Extreme Engineering',
      color: 'text-rose-400 border-rose-900/60 bg-rose-950/20',
      desc: 'Very high-complexity engineering: distributed systems consensus, Raft split-brain recovery, storage engine compaction, MVCC serializable isolation.',
      example: 'Raft consensus partition recovery or LSM-tree storage engine redesign (8.6)',
    },
    {
      range: '9.0 – 10.0',
      tier: 'Core Architecture',
      color: 'text-rose-300 border-rose-800/60 bg-rose-950/40',
      desc: 'Exceptional core-system engineering requiring major architectural rewrites or fundamental low-level engine overhauls.',
      example: 'Core memory model or garbage collector pass redesign (9.5)',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* 1. HERO SECTION */}
      <section className="relative pt-6 pb-8 border-b border-slate-900 text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[220px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-[10px] sm:text-xs font-mono max-w-full flex-wrap">
            <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-center">V2.3.0 Evidence Accumulation Engine • Platform Guidance</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono text-slate-100 tracking-tight">
            GUIDANCE & SCORING
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed max-w-2xl mx-auto">
            Understand how Repo Rescue evaluates open-source issues, awards RR Points, and measures contributor engineering effort.
          </p>
        </div>

        {/* CORE OPERATING LOOP DIAGRAM */}
        <div className="mt-12 p-4 sm:p-6 rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur-xl shadow-2xl">
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6">
            Repo Rescue Core Operating Loop
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { step: '01', name: 'DISCOVER', desc: 'Find open issue', icon: Search, color: 'text-blue-400' },
              { step: '02', name: 'EVALUATE', desc: 'V2.3 Evidence Engine', icon: Shield, color: 'text-purple-400' },
              { step: '03', name: 'SOLVE', desc: 'Implement fix', icon: Cpu, color: 'text-cyan-400' },
              { step: '04', name: 'MERGE', desc: 'Maintainer PR merge', icon: GitPullRequest, color: 'text-emerald-400' },
              { step: '05', name: 'VERIFY', desc: 'Idempotent audit', icon: CheckCircle2, color: 'text-amber-400' },
              { step: '06', name: 'EARN', desc: 'Ledger RR Points', icon: Award, color: 'text-rose-400' },
            ].map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.step} className="relative group min-w-0">
                  <div className="p-3 sm:p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all flex flex-col items-center text-center space-y-2 h-full">
                    <span className="text-[10px] font-mono text-slate-500 font-bold">{item.step}</span>
                    <IconComponent className={`w-5 h-5 ${item.color}`} />
                    <span className="text-xs font-mono font-bold text-slate-100">{item.name}</span>
                    <span className="text-[11px] font-sans text-slate-400 leading-tight">{item.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. SECTION 01 — HOW IS AN ISSUE GRADED? (V2.3 EVIDENCE ENGINE) */}
      <section className="space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
            <span>Section 01</span>
            <span>•</span>
            <span>V2.3.0 Evidence Accumulation Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            HOW IS AN ISSUE GRADED?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            Every scored issue receives an <strong className="text-slate-100 font-mono">RR Difficulty score</strong> on a deterministic <strong className="text-blue-400 font-mono">0.0 to 10.0 scale</strong>. Under Repo Rescue V2.3.0, difficulty estimates <strong className="text-slate-100">contributor engineering effort suggested by issue evidence</strong> rather than single keywords, repository popularity, or maintainer reputation.
          </p>
        </div>

        {/* EVIDENCE ACCUMULATION EXPLANATION CARD */}
        <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-purple-400 uppercase tracking-wider">
            <Sliders className="w-5 h-5 text-purple-400" />
            <span>Multi-Signal Evidence Accumulation</span>
          </div>
          <p className="text-xs sm:text-sm font-sans text-slate-300 leading-relaxed">
            Unlike simple keyword matching systems, the V2.3.0 engine accumulates signals across multiple implementation dimensions inferred from the issue text, body structure, code blocks, stack traces, and labels:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs text-slate-300">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Technical Complexity & Logic Depth</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Inferred Scope of Change</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Domain Specialization Signals</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Testing & Verification Requirements</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Problem Ambiguity & Triage Effort</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Security, Concurrency & Storage Signals</span>
            </div>
          </div>
          <p className="text-xs font-sans text-slate-400 italic">
            Note: A single keyword never forces an extreme score. Scores are derived by weighing all available evidence together.
          </p>
        </div>

        {/* PROMINENT EVIDENCE LIMITATION NOTE */}
        <div className="p-5 rounded-xl border border-purple-900/50 bg-purple-950/20 text-purple-200 space-y-1.5 text-xs font-sans">
          <div className="flex items-center gap-2 font-mono font-bold text-purple-400 uppercase tracking-wider">
            <Info className="w-4 h-4 shrink-0 text-purple-400" />
            <span>Evidence-Based Pre-Implementation Estimation</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            The 5 core factors are inferred strictly from evidence available within the GitHub issue — primarily title, body description, code snippets, and labels. RR Difficulty estimates the implementation effort suggested by the evidence available in an issue. It does not inspect the eventual PR diff, source files, AST, or actual implementation effort.
          </p>
        </div>

        {/* 5 CORE EFFORT FACTORS GRID */}
        <div className="space-y-4">
          <h3 className="text-lg font-mono font-bold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>The 5 Core RR Difficulty Factors</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {v2Factors.map((factor) => {
              const IconComponent = factor.icon;
              return (
                <div
                  key={factor.id}
                  className={`p-5 rounded-xl border ${factor.bgColor} space-y-2 flex flex-col justify-between`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <IconComponent className={`w-5 h-5 ${factor.color}`} />
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{factor.code}</span>
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-100">{factor.name}</div>
                    <p className="text-xs font-sans text-slate-300 leading-relaxed">{factor.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. SECTION 02 — THE 0.0 – 10.0 DIFFICULTY SCALE RANGE GUIDE */}
      <section className="space-y-8 pt-6 border-t border-slate-900">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
            <span>Section 02</span>
            <span>•</span>
            <span>Full Difficulty Scale Reference</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            THE 0.0 – 10.0 DIFFICULTY RANGE GUIDE
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            The table below serves as general <strong className="text-slate-100">guidance</strong> to help you understand how engineering tasks map across the difficulty spectrum. These bands describe typical issue types, not guaranteed score ranges. The final score is determined by accumulated evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
          {difficultyRanges.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${item.color} space-y-2 transition-all hover:border-slate-600`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm font-mono text-slate-100">{item.range}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">{item.tier}</span>
              </div>
              <p className="font-sans text-xs text-slate-300 leading-relaxed">{item.desc}</p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="text-slate-500">Example:</span> {item.example}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SECTION 03 — CONTEXT PRECEDENCE & ANTI-GAMING */}
      <section className="space-y-8 pt-6 border-t border-slate-900">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
            <span>Section 03</span>
            <span>•</span>
            <span>Context Precedence & Anti-Gaming</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            CONTEXTUAL PRECEDENCE & ANTI-GAMING
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            Repo Rescue evaluates the intent and execution context of an issue as a whole, preventing keyword collisions and artificial inflation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CONTEXT & EVIDENCE PRECEDENCE */}
          <div className="p-4 sm:p-6 rounded-2xl border border-blue-900/50 bg-blue-950/20 backdrop-blur-md space-y-4 min-w-0">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-blue-400 uppercase tracking-wider">
              <Scale className="w-5 h-5 text-blue-400 shrink-0" />
              <span>1. Contextual Evidence Precedence</span>
            </div>
            <p className="text-xs font-sans text-slate-300 leading-relaxed">
              Words must be interpreted within their technical context. The engine prioritizes explicit action markers over isolated domain words:
            </p>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 space-y-1">
                <div className="text-blue-300 font-bold break-words">&quot;Validate email format in signup route&quot;</div>
                <div className="text-slate-400 text-[11px] font-sans">
                  Graded as a <strong className="text-slate-200">code bug (~3.5)</strong> despite containing the word &quot;format&quot;, because it represents route input validation logic.
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 space-y-1">
                <div className="text-blue-300 font-bold break-words">&quot;Fix typo in DB schema setup guide&quot;</div>
                <div className="text-slate-400 text-[11px] font-sans">
                  Graded as a <strong className="text-slate-200">documentation task (~0.4)</strong> despite technical terms &quot;DB&quot; and &quot;schema&quot;, because the action is correcting documentation text.
                </div>
              </div>
            </div>
          </div>

          {/* ANTI-GAMING PROTECTION */}
          <div className="p-4 sm:p-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 backdrop-blur-md space-y-4 min-w-0">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-amber-400 uppercase tracking-wider">
              <Shield className="w-5 h-5 text-amber-400 shrink-0" />
              <span>2. Anti-Gaming Vocabulary Protection</span>
            </div>
            <p className="text-xs font-sans text-slate-300 leading-relaxed">
              Stuffing an issue body with advanced technical terms does not artificially increase its difficulty score:
            </p>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2 text-xs">
              <div className="font-mono text-amber-300 font-bold">Keyword Stuffing Safeguard</div>
              <p className="font-sans text-slate-300 text-[11px] leading-relaxed">
                If an issue title specifies a typo/README fix, inserting body text containing <code className="text-amber-400">compiler</code>, <code className="text-amber-400">AST</code>, <code className="text-amber-400">deadlock</code>, <code className="text-amber-400">concurrency</code>, or <code className="text-amber-400">distributed consensus</code> without code blocks or stack traces will remain locked to doc-tier difficulty (<strong className="text-emerald-400 font-mono">0.4 – 0.7</strong>).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION 04 — WHAT DOES NOT AFFECT DIFFICULTY? */}
      <section className="p-4 sm:p-8 rounded-2xl border border-slate-800 bg-slate-950 backdrop-blur-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
          <Info className="w-5 h-5 text-blue-400 shrink-0" />
          <h3 className="text-lg font-mono font-bold text-slate-100 uppercase tracking-wider">
            WHAT DOES NOT AFFECT RR DIFFICULTY
          </h3>
        </div>

        <p className="text-xs sm:text-sm font-sans text-slate-300 leading-relaxed">
          RR Difficulty measures <strong className="text-slate-100 font-mono">implementation effort suggested by issue evidence</strong>, not repository popularity or prestige. The following factors explicitly do NOT increase difficulty:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
          {[
            { title: 'Repository Stars', desc: 'A typo fix in a 75k star repository scores 0.4, identical to a 100 star repository.' },
            { title: 'Repository Popularity', desc: 'High traffic or popular status does not inflate engineering difficulty.' },
            { title: 'Maintainer Activity', desc: 'Maintainer responsiveness does not alter code complexity.' },
            { title: 'Famous Framework', desc: 'Framework prestige does not turn a 2-line UI tweak into a hard task.' },
            { title: 'Perceived Impact', desc: 'High urgency or issue severity does not change implementation effort.' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-1.5 min-w-0">
              <span className="font-bold text-slate-200 block text-xs">{item.title}</span>
              <p className="font-sans text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. SECTION 05 — HOW DO I EARN RR POINTS? */}
      <section className="space-y-8 pt-6 border-t border-slate-900">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
            <span>Section 05</span>
            <span>•</span>
            <span>Points Ledger Formula</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            HOW DO I EARN RR POINTS?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            Points are calculated strictly and deterministically from the evaluated RR Difficulty score upon maintainer merge verification.
          </p>
        </div>

        {/* FORMULA HIGHLIGHT BOX */}
        <div className="p-4 sm:p-8 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl min-w-0">
          <div className="space-y-2 text-center md:text-left min-w-0">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Authoritative V2.3.0 Formula
            </div>
            <div className="text-xl sm:text-3xl lg:text-4xl font-mono font-black text-slate-100 tracking-tight break-words">
              RR Difficulty × 10 = <span className="text-amber-400">RR Points</span>
            </div>
            <p className="text-xs text-slate-400 font-sans max-w-md">
              Points are awarded strictly after Repo Rescue verifies a qualifying maintainer-merged contribution.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0 font-mono text-xs">
            {[
              { score: '0.4', points: '4 RR Points' },
              { score: '2.8', points: '28 RR Points' },
              { score: '4.7', points: '47 RR Points' },
              { score: '8.6', points: '86 RR Points' },
            ].map((example) => (
              <div key={example.score} className="p-3 rounded-lg border border-slate-800 bg-slate-950/90 text-center">
                <div className="text-slate-400 text-[10px]">Difficulty {example.score}</div>
                <div className="font-bold text-amber-400 text-sm mt-0.5">{example.points}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CONCRETE REAL-WORLD SCENARIO EXAMPLES */}
        <div className="space-y-4">
          <h3 className="text-lg font-mono font-bold text-slate-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Explanatory Implementation Examples</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
            {[
              { title: 'Typo / Docs Fix', range: '~0.4 – 0.7', pts: '4–7 RR', desc: 'Fix spelling in intro paragraph or broken link in README.md' },
              { title: 'Localized Bug Fix', range: '~2.0 – 4.0', pts: '20–40 RR', desc: 'Fix button hover padding or add null check on avatar URI' },
              { title: 'Multi-File Refactor', range: '~4.0 – 6.0', pts: '40–60 RR', desc: 'Refactor shared telemetry types across workspace packages' },
              { title: 'Complex Parser / Concurrency', range: '~6.0 – 8.0', pts: '60–80 RR', desc: 'Fix crash in parser on null bytes or worker thread mutex race' },
              { title: 'Distributed Consensus / MVCC', range: '~8.0 – 10.0', pts: '80–100 RR', desc: 'Raft consensus split-brain recovery or LSM-tree engine redesign' },
            ].map((ex, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2 min-w-0">
                <div className="font-bold text-slate-100 text-xs break-words">{ex.title}</div>
                <div className="text-emerald-400 font-bold text-[11px]">{ex.range}</div>
                <div className="text-amber-400 text-[10px] font-bold">{ex.pts}</div>
                <p className="font-sans text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-900">{ex.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. SECTION 06 — WHAT COUNTS AS A VERIFIED CONTRIBUTION? */}
      <section className="space-y-8 pt-6 border-t border-slate-900">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
            <span>Section 06</span>
            <span>•</span>
            <span>Audit Criteria</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            WHAT COUNTS AS A VERIFIED CONTRIBUTION?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            To protect competitive integrity, Repo Rescue enforces strict automated audit rules before posting transactions to the authoritative Points Ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QUALIFYING CONDITIONS */}
          <div className="p-4 sm:p-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 backdrop-blur-md space-y-4 min-w-0">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Qualifying Conditions</span>
            </div>

            <ul className="space-y-3 font-mono text-xs text-slate-200">
              {[
                'Qualifying PR is merged (merged == true)',
                'Correct repository ID match',
                'Correct issue association in PR title/body (#number)',
                'Contributor identity verified via GitHub OAuth',
                'Maintainer-authorized merge (prevents self-merge farming)',
                'Repo Rescue HMAC signature verification succeeds',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-lg border border-emerald-900/30 min-w-0">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* NOT DIRECTLY REWARDED */}
          <div className="p-4 sm:p-6 rounded-2xl border border-rose-900/50 bg-rose-950/20 backdrop-blur-md space-y-4 min-w-0">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-rose-400 uppercase tracking-wider">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Not Directly Rewarded</span>
            </div>

            <ul className="space-y-3 font-mono text-xs text-slate-300">
              {[
                'Opening an unmerged PR',
                'Commenting on an issue',
                'Claiming an issue in comments',
                'Filing/Opening a new issue',
                'Starting local work on an issue',
                'A closed but unmerged PR',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-lg border border-rose-900/30 min-w-0">
                  <span className="text-rose-400 font-bold shrink-0">×</span>
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 8. SECTION 07 — YOUR REPO RESCUE REPUTATION */}
      <section className="space-y-8 pt-6 border-t border-slate-900">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
            <span>Section 07</span>
            <span>•</span>
            <span>Contributor Profile</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">
            YOUR REPO RESCUE REPUTATION
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed max-w-3xl">
            Your public profile accumulates verified contributions, language expertise, and difficulty achievements into a permanent engineer profile.
          </p>
        </div>

        {/* PROGRESSION DIAGRAM */}
        <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur-md min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center font-mono text-xs">
            {[
              { stage: '1. VERIFIED WORK', label: 'Merged Pull Requests', color: 'border-blue-800 text-blue-300' },
              { stage: '2. AUDITED POINTS', label: 'Immutable Ledger Entries', color: 'border-amber-800 text-amber-300' },
              { stage: '3. GLOBAL RANKING', label: 'Leaderboard Standing', color: 'border-purple-800 text-purple-300' },
              { stage: '4. PUBLIC REPUTATION', label: 'Verified Contributor Profile', color: 'border-emerald-800 text-emerald-300' },
            ].map((stage) => (
              <div key={stage.stage} className={`p-4 rounded-xl border bg-slate-900/60 ${stage.color} space-y-1 min-w-0`}>
                <div className="font-bold text-[11px] uppercase">{stage.stage}</div>
                <div className="text-slate-400 font-sans text-xs">{stage.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CTA SECTION */}
      <section className="p-6 sm:p-10 rounded-2xl border border-blue-900/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 text-center space-y-6 shadow-2xl">
        <div className="space-y-2">
          <h3 className="text-2xl sm:text-3xl font-mono font-black text-slate-100 tracking-tight">
            READY TO RESCUE SOMETHING?
          </h3>
          <p className="text-sm text-slate-300 font-sans">
            Browse open-source issues and find your next challenge.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/issues"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-sm shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all group"
          >
            <Compass className="w-4 h-4" />
            <span>EXPLORE ISSUES</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/leaderboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-mono font-semibold text-sm transition-all"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>VIEW LEADERBOARD</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
