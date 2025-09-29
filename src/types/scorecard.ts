// Core types for the scoring system

export interface Check {
  id: string;
  label: string;
  weight: number;
}

export interface Category {
  id: string;
  label: string;
  nominal_weight: number;
  checks: Check[];
}

export interface Rubric {
  version: string;
  allow_na: string[];
  categories: Category[];
}

// Check result types
export type CheckStatus = 'pass' | 'partial' | 'fail' | 'na';

export interface CheckResult {
  id: string;
  status: CheckStatus;
  score: number; // actual points awarded
  evidence: string[]; // evidence strings for debugging/UI
  details?: Record<string, unknown>; // additional structured data
}

export interface CategoryResult {
  id: string;
  label: string;
  checks: CheckResult[];
  score: number; // total points for this category
  max_score: number; // maximum possible points (excluding NA)
  percentage: number; // score as percentage of max_score
}

// Main scorecard output
export interface Scorecard {
  url: string;
  final_url?: string;
  rubric_version: string;
  total_score: number; // 0-100
  categories: CategoryResult[];
  analyzed_at: string; // ISO timestamp
  phase: number; // current phase (0, 1, 2, 3)
}

// API request/response types
export interface AnalyzeRequest {
  url: string;
  enableAiInsights?: boolean; // Optional toggle for AI insights
}

export interface AnalyzeResponse {
  success: boolean;
  scorecard?: Scorecard;
  ai_insights?: Record<string, unknown>; // AI insights from OpenAI analysis
  duration_ms?: number;
  error?: string;
}

// Fact detection types
export interface DetectedFacts {
  brand?: string;
  locality?: string;
  address?: {
    street?: string;
    locality?: string;
    region?: string;
    postal?: string;
    country?: string;
  };
  geo?: {
    lat: number;
    lon: number;
  };
}

// Cloudflare Worker response
export interface RenderResponse {
  finalUrl: string;
  html: string;
}

// Phase configuration
export interface PhaseConfig {
  phase: number;
  enabled_checks: string[];
  description: string;
}
