import { Rubric, CategoryResult, CheckResult, CheckStatus } from '@/types/scorecard';
import rubricData from '@/config/rubric.v2.0.json';

// Load the rubric configuration
export const rubric: Rubric = rubricData as Rubric;

// Phase configurations
export const PHASES = {
  0: {
    phase: 0,
    enabled_checks: [],
    description: "Skeleton & UI"
  },
  1: {
    phase: 1,
    enabled_checks: ['F1', 'F2', 'F5', 'M1', 'M4', 'S1', 'S2', 'C1', 'N1'],
    description: "MVP - Core checks"
  },
  2: {
    phase: 2,
    enabled_checks: ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'S1', 'S2', 'S3', 'C1', 'C2', 'C3', 'C4', 'R1', 'R2', 'N1', 'N2', 'N3'],
    description: "Core completeness"
  },
  3: {
    phase: 3,
    enabled_checks: ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'S1', 'S2', 'S3', 'S4', 'C1', 'C2', 'C3', 'C4', 'R1', 'R2', 'N1', 'N2', 'N3'],
    description: "Polish & DX"
  }
} as const;

export type Phase = keyof typeof PHASES;

// Get current phase (default to 1 for MVP)
export function getCurrentPhase(): Phase {
  return parseInt(process.env.NEXT_PUBLIC_PHASE || '1') as Phase;
}

// Check if a check is enabled in the current phase
export function isCheckEnabled(checkId: string, phase: Phase = getCurrentPhase()): boolean {
  return PHASES[phase].enabled_checks.includes(checkId);
}

// Check if a check can be NA
export function canBeNA(checkId: string): boolean {
  return rubric.allow_na.includes(checkId);
}

// Compute score for a category
export function computeCategoryScore(
  categoryId: string,
  checkResults: CheckResult[],
  phase: Phase = getCurrentPhase()
): CategoryResult {
  const category = rubric.categories.find(c => c.id === categoryId);
  if (!category) {
    throw new Error(`Category ${categoryId} not found`);
  }

  // Filter to only enabled checks for this phase
  const enabledChecks = category.checks.filter(check => 
    isCheckEnabled(check.id, phase)
  );

  // Calculate max possible score (excluding NA)
  const maxScore = enabledChecks.reduce((sum, check) => sum + check.weight, 0);

  // Calculate actual score for this category only
  const actualScore = checkResults
    .filter(result => 
      isCheckEnabled(result.id, phase) && 
      category.checks.some(check => check.id === result.id)
    )
    .reduce((sum, result) => sum + result.score, 0);

  // Calculate percentage
  const percentage = maxScore > 0 ? (actualScore / maxScore) * 100 : 0;

  return {
    id: categoryId,
    label: category.label,
    checks: checkResults.filter(result => 
      category.checks.some(check => check.id === result.id)
    ),
    score: actualScore,
    max_score: maxScore,
    percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
  };
}

// Compute total score across all categories
export function computeTotalScore(
  categoryResults: CategoryResult[],
  phase: Phase = getCurrentPhase()
): number {
  // Calculate total possible points (excluding NA categories)
  const totalPossiblePoints = rubric.categories.reduce((sum, category) => {
    const enabledChecks = category.checks.filter(check => 
      isCheckEnabled(check.id, phase)
    );
    return sum + enabledChecks.reduce((catSum, check) => catSum + check.weight, 0);
  }, 0);

  // Calculate actual points earned
  const actualPoints = categoryResults.reduce((sum, result) => sum + result.score, 0);

  // Normalize to 0-100 scale
  const normalizedScore = totalPossiblePoints > 0 ? (actualPoints / totalPossiblePoints) * 100 : 0;

  return Math.round(normalizedScore);
}

// Helper to create a check result
export function createCheckResult(
  id: string,
  status: CheckStatus,
  evidence: string[] = [],
  details?: Record<string, any>
): CheckResult {
  const category = rubric.categories.find(c => 
    c.checks.some(check => check.id === id)
  );
  const check = category?.checks.find(c => c.id === id);
  
  if (!check) {
    throw new Error(`Check ${id} not found in rubric`);
  }

  let score = 0;
  switch (status) {
    case 'pass':
      score = check.weight;
      break;
    case 'partial':
      // For partial scores, we'll need to define specific rules per check
      // For now, default to half points
      score = check.weight * 0.5;
      break;
    case 'fail':
    case 'na':
      score = 0;
      break;
  }

  return {
    id,
    status,
    score,
    evidence,
    details
  };
}
