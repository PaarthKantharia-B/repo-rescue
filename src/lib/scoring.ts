import { IssueScoreFactors, IssueScoreFactorsV2 } from '@/types';

export const SCORING_VERSION = 'v1.1.0';
export const SCORING_VERSION_V2 = 'v2.0.0';
export const SCORING_VERSION_V2_3 = 'v2.3.0';

/**
 * V1.1.0 weight configuration (retained for rollback capability).
 * Sum of weights = 1.0
 */
export const FACTOR_WEIGHTS: Record<keyof IssueScoreFactors, number> = {
  technicalDifficulty: 0.25, // Primary algorithm/system complexity weight
  codebaseComplexity: 0.15,  // Architecture & file dependency depth
  issueScope: 0.15,          // Scale of changes required across components
  domainKnowledge: 0.10,     // Required specialized background (e.g. compiler, async stream)
  expectedImpact: 0.10,      // Criticality to framework/repo users
  testingComplexity: 0.10,   // Harness setup, integration test coverage difficulty
  issueClarity: 0.05,        // Inverted: lower clarity -> higher effort needed
  maintainerActivity: 0.10,  // Responsiveness bonus/penalty factor
};

/**
 * V2.0.0 weight configuration for contributor effort scoring model.
 * Sum of weights = 1.0
 */
export const FACTOR_WEIGHTS_V2: Record<keyof IssueScoreFactorsV2, number> = {
  technicalComplexity: 0.35,       // Primary algorithmic depth & execution complexity
  changeScope: 0.25,                // Scale of changes across files/components/modules
  domainSpecialization: 0.15,       // Specialized technical background barrier
  testingVerificationEffort: 0.15, // Test harness setup & integration testing effort
  problemAmbiguity: 0.10,           // Triage & problem clarity effort (higher = more effort)
};

/**
 * Calculates composite V1 RR Difficulty (0.0 - 10.0 scale) deterministically.
 */
export function calculateRRDifficulty(factors: IssueScoreFactors): number {
  let weightedSum = 0;

  for (const factorKey of Object.keys(FACTOR_WEIGHTS) as Array<keyof IssueScoreFactors>) {
    const rawVal = factors[factorKey] ?? 5.0;
    const clampedVal = Math.min(10.0, Math.max(0.0, rawVal));
    weightedSum += clampedVal * FACTOR_WEIGHTS[factorKey];
  }

  const score = Math.round(weightedSum * 10) / 10;
  return Math.min(10.0, Math.max(0.0, score));
}

/**
 * Calculates composite V2 RR Difficulty (0.0 - 10.0 scale) deterministically.
 */
export function calculateRRDifficultyV2(factors: IssueScoreFactorsV2): number {
  let weightedSum = 0;

  for (const factorKey of Object.keys(FACTOR_WEIGHTS_V2) as Array<keyof IssueScoreFactorsV2>) {
    const rawVal = factors[factorKey] ?? 0.0;
    const clampedVal = Math.min(10.0, Math.max(0.0, rawVal));
    weightedSum += clampedVal * FACTOR_WEIGHTS_V2[factorKey];
  }

  const score = Math.round(weightedSum * 10) / 10;
  return Math.min(10.0, Math.max(0.0, score));
}

/**
 * RR Points formula: RR Points = RR Difficulty * 10
 */
export function calculateRRPointsFromScore(rrDifficulty: number): number {
  return Math.round(rrDifficulty * 10);
}
