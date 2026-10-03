/**
 * Server-Side GitHub Deep-Diff Retrieval & Pure Evidence-Based Engineering Intelligence Engine v3.2.0
 */

export interface GitHubFileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  sha?: string;
  previous_filename?: string;
}

export interface GitHubCheckRunItem {
  name: string;
  status: string;
  conclusion?: string | null;
  verified: boolean;
  url?: string;
}

export interface GitHubChecksSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  pendingChecks: number;
  checkList: GitHubCheckRunItem[];
  statusText: string;
}

export interface GitHubPullRequestDiffData {
  files: GitHubFileDiff[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  coverage: 'FULL_DIFF' | 'PARTIAL_DIFF' | 'METADATA_ONLY';
  checksSummary: GitHubChecksSummary;
  headSha?: string;
}

export interface AtomicChange {
  filename: string;
  meaning: string;
  technique?: string;
  evidenceFiles: string[];
  oldText?: string;
  newText?: string;
  source: 'VERIFIED_DIFF' | 'VERIFIED_METADATA';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface FileAnalysisItem {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  summary: string;
  techniques: string[];
  evidence: string[];
  patch?: string;
}

export interface DiffAnalysisResult {
  engineeringThesis: string;
  howItWorks: string | null;
  whatChanged: Array<{
    statement: string;
    source: 'VERIFIED_DIFF' | 'VERIFIED_METADATA';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidenceFiles: string[];
  }>;
  fileAnalyses: FileAnalysisItem[];
  approach: string;
  techniques: Array<{ name: string; evidenceFiles: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  techniqueNames: string[];
  checks: GitHubCheckRunItem[];
  checksSummary: GitHubChecksSummary;
  diffPatch: { before: string; after: string; filename: string } | null;
  coverage: 'FULL_DIFF' | 'PARTIAL_DIFF' | 'METADATA_ONLY';
}

/**
 * Server-side helper to fetch GitHub Check Runs & Statuses for a given commit/PR.
 */
export async function fetchGithubPullRequestChecks(
  owner: string,
  repoName: string,
  headSha?: string
): Promise<GitHubChecksSummary> {
  const emptySummary: GitHubChecksSummary = {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    pendingChecks: 0,
    checkList: [],
    statusText: 'No GitHub checks reported for this pull request.',
  };

  if (!owner || !repoName || !headSha) {
    return emptySummary;
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Diff-Analyzer',
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const checkRunsUrl = `https://api.github.com/repos/${owner}/${repoName}/commits/${headSha}/check-runs`;
    const checkRunsRes = await fetch(checkRunsUrl, { headers });

    const checkList: GitHubCheckRunItem[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    if (checkRunsRes.ok) {
      const data: any = await checkRunsRes.json();
      const runs = data.check_runs || [];
      for (const run of runs) {
        const name = run.name || 'CI Check';
        const status = run.status || 'completed';
        const conclusion = run.conclusion || null;
        const isSuccess = conclusion === 'success';
        const isFailure = ['failure', 'timed_out', 'action_required', 'cancelled'].includes(conclusion || '');
        const isPending = status !== 'completed' || conclusion === null;

        if (isSuccess) passedCount++;
        else if (isFailure) failedCount++;
        else if (isPending) pendingCount++;

        checkList.push({
          name,
          status,
          conclusion,
          verified: isSuccess,
          url: run.html_url || run.details_url || undefined,
        });
      }
    }

    const statusUrl = `https://api.github.com/repos/${owner}/${repoName}/commits/${headSha}/status`;
    const statusRes = await fetch(statusUrl, { headers });
    if (statusRes.ok) {
      const statusData: any = await statusRes.json();
      const statuses = statusData.statuses || [];
      for (const st of statuses) {
        const name = st.context || 'Commit Status';
        const state = st.state || 'pending';
        const isSuccess = state === 'success';
        const isFailure = state === 'failure' || state === 'error';
        const isPending = state === 'pending';

        if (!checkList.some((c) => c.name === name)) {
          if (isSuccess) passedCount++;
          else if (isFailure) failedCount++;
          else if (isPending) pendingCount++;

          checkList.push({
            name,
            status: isPending ? 'in_progress' : 'completed',
            conclusion: isSuccess ? 'success' : isFailure ? 'failure' : 'pending',
            verified: isSuccess,
            url: st.target_url || undefined,
          });
        }
      }
    }

    const total = checkList.length;
    if (total === 0) {
      return emptySummary;
    }

    let statusText = '';
    if (failedCount > 0 && passedCount > 0) {
      statusText = `GitHub reported ${passedCount} passing check(s) and ${failedCount} failing check(s).`;
    } else if (failedCount > 0) {
      statusText = `GitHub reported ${failedCount} failing check(s).`;
    } else if (passedCount === total) {
      statusText = `GitHub reported all ${passedCount} check(s) passed successfully.`;
    } else {
      statusText = `GitHub reported ${passedCount} passed, ${failedCount} failed, and ${pendingCount} pending check(s).`;
    }

    return {
      totalChecks: total,
      passedChecks: passedCount,
      failedChecks: failedCount,
      pendingChecks: pendingCount,
      checkList,
      statusText,
    };
  } catch (err) {
    return emptySummary;
  }
}

/**
 * Server-side helper to fetch raw PR file diffs, patches, & check runs directly from GitHub REST API.
 */
export async function fetchGithubPullRequestFiles(
  owner: string,
  repoName: string,
  pullNumber: number
): Promise<GitHubPullRequestDiffData | null> {
  if (!owner || !repoName || !pullNumber || pullNumber <= 0) {
    return null;
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Repo-Rescue-Diff-Analyzer',
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    let headSha: string | undefined = undefined;
    try {
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls/${pullNumber}`, { headers });
      if (prRes.ok) {
        const prData = await prRes.json();
        headSha = prData?.head?.sha;
      }
    } catch (_) {}

    const checksSummary = await fetchGithubPullRequestChecks(owner, repoName, headSha);

    const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${pullNumber}/files?per_page=100`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      return {
        files: [],
        totalFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        coverage: 'METADATA_ONLY',
        checksSummary,
        headSha,
      };
    }

    const rawFiles: any[] = await res.json();
    if (!Array.isArray(rawFiles)) {
      return {
        files: [],
        totalFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        coverage: 'METADATA_ONLY',
        checksSummary,
        headSha,
      };
    }

    let totalAdditions = 0;
    let totalDeletions = 0;
    let hasPatches = false;
    let totalPatchBytes = 0;

    const files: GitHubFileDiff[] = rawFiles.map((f) => {
      totalAdditions += f.additions || 0;
      totalDeletions += f.deletions || 0;
      if (f.patch) {
        hasPatches = true;
        totalPatchBytes += f.patch.length;
      }
      return {
        filename: f.filename,
        status: f.status || 'modified',
        additions: f.additions || 0,
        deletions: f.deletions || 0,
        changes: f.changes || 0,
        patch: f.patch ? f.patch.slice(0, 4000) : undefined,
        sha: f.sha,
        previous_filename: f.previous_filename,
      };
    });

    let coverage: 'FULL_DIFF' | 'PARTIAL_DIFF' | 'METADATA_ONLY' = 'FULL_DIFF';
    if (!hasPatches) {
      coverage = 'METADATA_ONLY';
    } else if (rawFiles.length > 15 || totalPatchBytes > 20000) {
      coverage = 'PARTIAL_DIFF';
    }

    return {
      files,
      totalFiles: rawFiles.length,
      totalAdditions,
      totalDeletions,
      coverage,
      checksSummary,
      headSha,
    };
  } catch (err) {
    console.warn(`[DiffAnalyzer] Failed fetching files for ${owner}/${repoName}#${pullNumber}:`, err);
    return null;
  }
}

/**
 * Extracts real Before (removed lines) and After (added lines) code snippets from a file patch.
 */
function extractPatchSnippet(patchText?: string): { before: string; after: string } | null {
  if (!patchText || patchText.trim().length === 0) return null;

  const lines = patchText.split('\n');
  const removed: string[] = [];
  const added: string[] = [];

  for (const line of lines) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.slice(1);
      if (content.trim().length > 0) removed.push(content);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      if (content.trim().length > 0) added.push(content);
    }
  }

  if (removed.length === 0 && added.length === 0) return null;

  return {
    before: removed.slice(0, 12).join('\n'),
    after: added.slice(0, 12).join('\n'),
  };
}

/**
 * Line-by-line & hunk-by-hunk Atomic Change Extractor & Semantic Analyzer v3.2.0
 */
export function extractHunkAtomicChanges(
  filename: string,
  patch: string | undefined,
  status: string,
  previousFilename?: string
): { fileSummary: string; atomicChanges: AtomicChange[]; evidenceList: string[]; techniques: string[] } {
  const fnLower = filename.toLowerCase();
  const atomicChanges: AtomicChange[] = [];
  const evidenceList: string[] = [];
  const techniques: string[] = [];

  // Edge case 1: Missing / Unavailable patch or special status
  if (!patch || patch.trim().length === 0) {
    if (status === 'renamed') {
      const summary = previousFilename ? `Renamed ${previousFilename} to ${filename}.` : `Renamed file ${filename}.`;
      return {
        fileSummary: summary,
        atomicChanges: [{ filename, meaning: summary, evidenceFiles: [filename], source: 'VERIFIED_DIFF', confidence: 'HIGH' }],
        evidenceList: [summary],
        techniques: ['Refactoring'],
      };
    }
    if (status === 'removed') {
      const summary = `Removed file ${filename}.`;
      return {
        fileSummary: summary,
        atomicChanges: [{ filename, meaning: summary, evidenceFiles: [filename], source: 'VERIFIED_DIFF', confidence: 'HIGH' }],
        evidenceList: [summary],
        techniques: ['Code Cleanup'],
      };
    }
    const summary = `Diff unavailable for ${filename}.`;
    return {
      fileSummary: summary,
      atomicChanges: [],
      evidenceList: ['Diff unavailable.'],
      techniques: [],
    };
  }

  // Parse removed lines vs added lines from patch
  const patchLines = patch.split('\n');
  const removedLines: string[] = [];
  const addedLines: string[] = [];

  for (const line of patchLines) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      removedLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.slice(1));
    }
  }

  const removedText = removedLines.join('\n');
  const addedText = addedLines.join('\n');

  // Pattern 1: Function call / Syntax correction (e.g. prin( -> print(, logg( -> log()
  for (let i = 0; i < Math.max(removedLines.length, addedLines.length); i++) {
    const r = removedLines[i] || '';
    const a = addedLines[i] || '';

    const rMatch = r.match(/([a-zA-Z0-9_$]+)\s*\(/);
    const aMatch = a.match(/([a-zA-Z0-9_$]+)\s*\(/);

    if (rMatch && aMatch && rMatch[1] !== aMatch[1]) {
      const meaning = `Corrected function call from ${rMatch[1]}() to ${aMatch[1]}()`;
      atomicChanges.push({
        filename,
        meaning,
        evidenceFiles: [filename],
        oldText: r.trim(),
        newText: a.trim(),
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push(`${rMatch[1]}() → ${aMatch[1]}()`);
    }
  }

  // Pattern 2: Added inline comments
  const hasAddedComment = addedLines.some((line) => {
    const trimmed = line.trim();
    const isComment = trimmed.includes('#') || trimmed.includes('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.includes('<!--');
    return isComment && !removedLines.some((r) => r.trim() === trimmed);
  });

  if (hasAddedComment) {
    atomicChanges.push({
      filename,
      meaning: `Added an inline explanatory comment`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push('Added explanatory inline comment.');
  }

  // Pattern 3: Async / Await modification
  if (addedText.includes('await ') && !removedText.includes('await ')) {
    const awaitFnMatch = addedText.match(/await\s+([a-zA-Z0-9_$.]+)\s*\(/);
    const fnName = awaitFnMatch ? awaitFnMatch[1] : 'asynchronous operation';
    atomicChanges.push({
      filename,
      meaning: `Changed ${fnName} call to await the asynchronous operation`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push(`Added await to ${fnName}`);
    techniques.push('Asynchronous Operations');
  }

  // Pattern 4: Test Assertion added
  if (
    addedText.includes('expect(') ||
    addedText.includes('assert.') ||
    addedText.includes('assert ') ||
    addedText.includes('assertEquals') ||
    addedText.includes('self.assert') ||
    addedText.includes('t.equal')
  ) {
    const statusMatch = addedText.match(/(?:toBe|toEqual|equal|assertEqual|assert)\s*\(\s*([^)]+)\s*\)/);
    const detail = statusMatch ? ` verifying ${statusMatch[1].trim()}` : '';
    atomicChanges.push({
      filename,
      meaning: `Added test assertion${detail}`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push(`Added test assertion${detail}`);
    techniques.push('Regression Testing');
  }

  // Pattern 5: Class Definition & Inheritance
  const extendsMatch = addedText.match(/class\s+([A-Z]\w+)\s+(?:extends\s+([A-Z]\w+)|(?:\(([A-Z]\w+)\):))/);
  if (extendsMatch) {
    const childClass = extendsMatch[1];
    const parentClass = extendsMatch[2] || extendsMatch[3];
    atomicChanges.push({
      filename,
      meaning: `Introduced class ${childClass} extends ${parentClass}, establishing class inheritance`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push(`class ${childClass} extends ${parentClass}`);
    techniques.push('Inheritance', 'Object-Oriented Programming');
  } else {
    const classMatch = addedText.match(/class\s+([A-Z]\w+)/);
    if (classMatch && !removedText.includes(`class ${classMatch[1]}`)) {
      atomicChanges.push({
        filename,
        meaning: `Introduced class ${classMatch[1]} to encapsulate behavior`,
        evidenceFiles: [filename],
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push(`class ${classMatch[1]}`);
      techniques.push('Object-Oriented Programming');
    }
  }

  // Pattern 6: Collection / Map / Filter transformations
  if (addedText.includes('.map(') && !removedText.includes('.map(')) {
    atomicChanges.push({
      filename,
      meaning: `Added a map() transformation to process collection items`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push('Added .map() transformation');
    techniques.push('Functional Programming');
  }

  // Pattern 7: React Hooks / State
  if (
    (addedText.includes('useState(') && !removedText.includes('useState(')) ||
    (addedText.includes('useEffect(') && !removedText.includes('useEffect('))
  ) {
    atomicChanges.push({
      filename,
      meaning: `Added React hooks for component state management`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push('Added React hook');
    techniques.push('React State');
  }

  // Pattern 8: Documentation / README command changes
  if (fnLower.endsWith('.md') || fnLower.includes('readme') || fnLower.includes('docs/')) {
    const cmdMatch = addedText.match(/(?:npm|yarn|pnpm|python|pytest|cargo)\s+[a-z0-9_-]+/);
    const oldCmdMatch = removedText.match(/(?:npm|yarn|pnpm|python|pytest|cargo)\s+[a-z0-9_-]+/);
    const isSetupDoc = addedText.toLowerCase().includes('install') || addedText.toLowerCase().includes('setup') || addedText.includes('.env');
    if (isSetupDoc) {
      atomicChanges.push({
        filename,
        meaning: `Updated installation and environment setup instructions in ${filename}`,
        evidenceFiles: [filename],
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push('Updated setup instructions');
      techniques.push('Technical Documentation');
    } else if (cmdMatch && oldCmdMatch && cmdMatch[0] !== oldCmdMatch[0]) {
      atomicChanges.push({
        filename,
        meaning: `Updated documentation command from ${oldCmdMatch[0]} to ${cmdMatch[0]}`,
        evidenceFiles: [filename],
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push(`${oldCmdMatch[0]} → ${cmdMatch[0]}`);
      techniques.push('Technical Documentation');
    } else if (!atomicChanges.some((c) => c.technique === 'Technical Documentation')) {
      atomicChanges.push({
        filename,
        meaning: `Updated documentation in ${filename}`,
        evidenceFiles: [filename],
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push('Updated documentation');
      techniques.push('Technical Documentation');
    }
  }

  // Pattern 9: Database / Schema changes
  if (fnLower.includes('schema.prisma') || fnLower.includes('.sql') || fnLower.includes('migration')) {
    const modelMatch = addedText.match(/model\s+([A-Z]\w+)/);
    if (modelMatch) {
      atomicChanges.push({
        filename,
        meaning: `Added ${modelMatch[1]} model to database schema`,
        evidenceFiles: [filename],
        source: 'VERIFIED_DIFF',
        confidence: 'HIGH',
      });
      evidenceList.push(`Added ${modelMatch[1]} model`);
      techniques.push('Database Schema');
    }
  }

  // Pattern 10: Pure formatting / whitespace check
  if (
    atomicChanges.length === 0 &&
    removedLines.length > 0 &&
    removedText.replace(/\s+/g, '') === addedText.replace(/\s+/g, '')
  ) {
    atomicChanges.push({
      filename,
      meaning: `Whitespace and formatting adjustments`,
      evidenceFiles: [filename],
      source: 'VERIFIED_DIFF',
      confidence: 'HIGH',
    });
    evidenceList.push('Formatting change');
    techniques.push('Refactoring');
  }

  // Default File Summary
  let fileSummary = `Modified ${filename} (+${addedLines.length} / -${removedLines.length}).`;
  if (atomicChanges.length > 0) {
    fileSummary = atomicChanges.map((c) => c.meaning).join('. ') + '.';
  }

  return { fileSummary, atomicChanges, evidenceList, techniques };
}

/**
 * Core Evidence Analysis Engine v3.2.0: Analyzes actual PR diffs to produce concrete "What Changed" statements, Approach, & Techniques.
 *
 * MANDATORY RULE: DIFF WINS OVER PR TITLE!
 */
export function analyzePullRequestDiff(
  diffData: GitHubPullRequestDiffData | null,
  prTitle: string,
  prNumber: number,
  repoFullName: string,
  issueTitle?: string | null
): DiffAnalysisResult {
  const defaultChecksSummary: GitHubChecksSummary = diffData?.checksSummary || {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    pendingChecks: 0,
    checkList: [],
    statusText: 'No GitHub checks reported for this pull request.',
  };

  const fileAnalyses: FileAnalysisItem[] = [];
  const atomicChanges: AtomicChange[] = [];
  const techniqueMap = new Map<string, { name: string; evidenceFiles: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }>();
  let diffPatch: { before: string; after: string; filename: string } | null = null;
  const coverage = diffData?.coverage || 'METADATA_ONLY';

  const titleClean = prTitle && prTitle.trim().length > 0 ? prTitle.trim() : 'Pull Request';

  if (!diffData || !diffData.files || diffData.files.length === 0) {
    // METADATA ONLY FALLBACK (Ground in actual metadata without generic filler)
    return {
      engineeringThesis: titleClean,
      howItWorks: null,
      whatChanged: [
        {
          statement: `Pull Request #${prNumber > 0 ? prNumber : 'merged'} (${titleClean}) merged into ${repoFullName}.`,
          source: 'VERIFIED_METADATA',
          confidence: 'HIGH',
          evidenceFiles: [],
        },
      ],
      fileAnalyses: [],
      approach: `Pull Request #${prNumber > 0 ? prNumber : 'merged'} (${titleClean}) merged into ${repoFullName}.`,
      techniques: [],
      techniqueNames: [],
      checks: defaultChecksSummary.checkList,
      checksSummary: defaultChecksSummary,
      diffPatch: null,
      coverage: 'METADATA_ONLY',
    };
  }

  // Helper to register technique with evidence file
  const addTechnique = (name: string, file: string) => {
    const existing = techniqueMap.get(name);
    if (existing) {
      if (!existing.evidenceFiles.includes(file)) existing.evidenceFiles.push(file);
    } else {
      techniqueMap.set(name, { name, evidenceFiles: [file], confidence: 'HIGH' });
    }
  };

  // Process EVERY changed file individually (Deep Hunk & Atomic Change Analysis)
  for (const file of diffData.files) {
    const filename = file.filename;
    const patch = file.patch || '';

    // Extract Before & After snippet from first meaningful patch
    if (!diffPatch && patch) {
      const snippet = extractPatchSnippet(patch);
      if (snippet && (snippet.before || snippet.after)) {
        diffPatch = {
          before: snippet.before || '(New file added)',
          after: snippet.after || '(File removed)',
          filename: file.filename,
        };
      }
    }

    // Run deep hunk atomic change extractor
    const hunkAnalysis = extractHunkAtomicChanges(filename, patch, file.status, file.previous_filename);

    for (const atomic of hunkAnalysis.atomicChanges) {
      atomicChanges.push(atomic);
    }

    for (const tech of hunkAnalysis.techniques) {
      addTechnique(tech, filename);
    }

    fileAnalyses.push({
      filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      summary: hunkAnalysis.fileSummary,
      techniques: hunkAnalysis.techniques,
      evidence: hunkAnalysis.evidenceList,
      patch: file.patch,
    });
  }

  // Build whatChanged statements from atomic changes
  const whatChangedStatements: Array<{
    statement: string;
    source: 'VERIFIED_DIFF' | 'VERIFIED_METADATA';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidenceFiles: string[];
  }> = [];

  for (const change of atomicChanges) {
    if (!whatChangedStatements.some((s) => s.statement === change.meaning)) {
      whatChangedStatements.push({
        statement: change.meaning,
        source: change.source,
        confidence: change.confidence,
        evidenceFiles: change.evidenceFiles,
      });
    }
  }

  // Fallback statement if no specific pattern matched
  if (whatChangedStatements.length === 0) {
    whatChangedStatements.push({
      statement: `Pull Request #${prNumber > 0 ? prNumber : 'merged'} (${titleClean}) modified ${diffData.files.length} file(s) (+${diffData.totalAdditions} / -${diffData.totalDeletions}).`,
      source: 'VERIFIED_METADATA',
      confidence: 'HIGH',
      evidenceFiles: diffData.files.map((f) => f.filename),
    });
  }

  // Generate Short Summary (engineeringThesis) directly from extracted atomic changes
  let engineeringThesis = '';
  const isMultiFileEndToEnd = diffData.files.length >= 3 && fileAnalyses.some((f) => f.filename.includes('api') || f.filename.includes('route')) && fileAnalyses.some((f) => f.filename.includes('component') || f.filename.includes('List')) && fileAnalyses.some((f) => f.filename.includes('test'));
  if (isMultiFileEndToEnd) {
    engineeringThesis = `Implemented end-to-end ${titleClean} across ${diffData.files.length} files.`;
  } else if (atomicChanges.length > 0) {
    engineeringThesis = atomicChanges
      .slice(0, 3)
      .map((c) => c.meaning)
      .join('. ') + '.';
  } else {
    engineeringThesis = titleClean;
  }

  const techniqueList = Array.from(techniqueMap.values());
  const techniqueNames = Array.from(techniqueMap.keys());

  const howItWorks = fileAnalyses.length > 0
    ? fileAnalyses.map((f) => `${f.filename}: ${f.summary}`).join('\n')
    : null;

  return {
    engineeringThesis,
    howItWorks,
    whatChanged: whatChangedStatements,
    fileAnalyses,
    approach: whatChangedStatements.map((w) => w.statement).join(' '),
    techniques: techniqueList,
    techniqueNames,
    checks: defaultChecksSummary.checkList,
    checksSummary: defaultChecksSummary,
    diffPatch,
    coverage,
  };
}
