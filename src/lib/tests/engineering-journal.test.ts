import { CaseStudyAnalysisSchema } from '../ai/case-study-schema';
import { synthesizeEvidenceAnalysis, extractEvidenceBasedTechniques } from '../ai/case-study-service';

function runEngineeringJournalTests() {
  console.log('🧪 Running Engineering Journal Verification Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test 1: CaseStudyAnalysisSchema validation
  try {
    const validData = CaseStudyAnalysisSchema.parse({
      problem: 'Redis connection pool exhaustion in backend',
      investigation: 'The contribution indicates an investigation into connection lifecycle timeouts.',
      approach: 'Updated connection pool timeout handling and added lock guards.',
      techniques: ['Concurrency', 'Database Optimization'],
      implementation: [{ title: 'Fix connection leak', commitSha: 'a1b2c3d' }],
      tradeoffs: ['No explicit trade-off was documented for this contribution.'],
      result: '✓ PR merged into redis/redis',
      evidence: [{ type: 'Issue', label: 'Issue #101', url: 'https://github.com', verified: true }],
      confidence: 'HIGH',
    });
    assert(validData.confidence === 'HIGH' && validData.techniques.length === 2, 'Valid case study analysis passes Zod schema validation');
  } catch (err) {
    assert(false, 'Valid case study analysis passes Zod schema validation');
  }

  // Test 2: Invalid schema validation failure (empty problem string)
  try {
    CaseStudyAnalysisSchema.parse({
      problem: '',
      investigation: 'Test',
      approach: 'Test',
      result: 'Test',
    });
    assert(false, 'Schema rejects empty problem string');
  } catch (err) {
    assert(true, 'Schema rejects empty problem string');
  }

  // Test 3: Technique extraction based on GitHub evidence
  const techniques = extractEvidenceBasedTechniques(
    'Fix race condition in mutex lock during concurrent database access',
    'Body text detailing async thread safety',
    ['bug', 'concurrency'],
    'Go',
    'Backend',
    4
  );
  assert(techniques.includes('Concurrency'), 'Extracts Concurrency technique from diff & title evidence');

  // Test 4: Nuanced Language Enforcement (No fake absolute statements)
  const synth = synthesizeEvidenceAnalysis({
    id: 'contrib-123',
    issue: {
      githubNumber: 42,
      title: 'Memory leak in image processing pipeline',
      body: 'Memory usage spikes during buffer serialization.',
      language: 'Rust',
      repository: { fullName: 'image-rs/image', url: 'https://github.com/image-rs/image' },
    },
    pullRequest: { githubNumber: 99, title: 'Fix buffer allocation', mergedBy: 'maintainer-1' },
    linesAdded: 50,
    linesDeleted: 20,
    filesChanged: 3,
    verifiedAt: new Date(),
    rrPoints: 85,
  });

  assert(
    synth.investigation.includes('indicates an investigation into') ||
    synth.investigation.includes('suggest'),
    'Enforces nuanced, evidence-backed investigation phrasing'
  );

  // Test 5: Trade-offs when evidence is insufficient
  assert(
    synth.tradeoffs[0].includes('No explicit trade-off was documented'),
    'Returns evidence-honest trade-off fallback when no explicit trade-off documented'
  );

  // Test 6: Machine-verifiable evidence checklist structure
  assert(
    synth.evidence.length >= 4 && synth.evidence.every((e) => e.verified === true),
    'Generates machine-verifiable evidence checklist'
  );

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEngineeringJournalTests();
