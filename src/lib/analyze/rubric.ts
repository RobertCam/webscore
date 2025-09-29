import { Rubric, CategoryResult, CheckResult, CheckStatus } from '@/types/scorecard';
import rubricData from '@/config/rubric.v2.0.json';

// Load the rubric configuration
export const rubric: Rubric = rubricData as Rubric;

// All checks are always enabled - no phase logic needed 

// Check if a check can be NA
export function canBeNA(checkId: string): boolean {
  return rubric.allow_na.includes(checkId);
}

// Compute score for a category
export function computeCategoryScore(
  categoryId: string,
  checkResults: CheckResult[]
): CategoryResult {
  const category = rubric.categories.find(c => c.id === categoryId);
  if (!category) {
    throw new Error(`Category ${categoryId} not found`);
  }

  // Calculate max possible score (excluding NA)
  const maxScore = category.checks.reduce((sum, check) => sum + check.weight, 0);

  // Calculate actual score for this category only
  const actualScore = checkResults
    .filter(result => 
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
  categoryResults: CategoryResult[]
): number {
  // Calculate total possible points
  const totalPossiblePoints = rubric.categories.reduce((sum, category) => {
    return sum + category.checks.reduce((catSum, check) => catSum + check.weight, 0);
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
