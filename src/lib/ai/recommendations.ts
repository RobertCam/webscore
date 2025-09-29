import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIRecommendations {
  aiSearchOptimization: {
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    rationale: string;
  }[];
  contentGaps: {
    gap: string;
    opportunity: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  schemaSuggestions: {
    schema: string;
    purpose: string;
    implementation: string;
  }[];
  competitiveAdvantages: {
    advantage: string;
    howToLeverage: string;
  }[];
}

export async function generateRecommendations(
  context: {
    url: string;
    brand: string;
    locality: string;
    currentScore: number;
    weaknesses: string[];
    strengths: string[];
  }
): Promise<AIRecommendations> {
  const prompt = `
Generate specific, actionable recommendations to improve AI search visibility for "${context.brand}" in "${context.locality}".

CURRENT SITUATION:
- URL: ${context.url}
- Current Score: ${context.currentScore}/100
- Weaknesses: ${context.weaknesses.join(', ')}
- Strengths: ${context.strengths.join(', ')}

GOAL: Help this brand take control of how they're cited in AI search results and increase visibility.

AREAS TO ADDRESS:
1. AI Search Optimization: Specific technical and content improvements
2. Content Gaps: Missing content that could improve visibility
3. Schema Markup: Structured data recommendations
4. Competitive Advantages: How to differentiate and stand out

Focus on:
- Practical, implementable recommendations
- High-impact, low-effort improvements first
- Content that addresses how people actually search
- Technical optimizations for AI search engines
- Competitive differentiation strategies
`;

  try {
    const completion = await openai.responses.create({
      model: 'gpt-4o',
      tools: [
        {
          type: 'web_search_preview'
        }
      ],
      input: `You are an AI search optimization expert. Provide specific, actionable recommendations for improving brand visibility in AI search results.

${prompt}`
    });

    const response = completion.output_text;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return parseRecommendationsResponse(response);
  } catch (error) {
    console.error('Recommendations generation failed:', error);
    throw new Error('Failed to generate recommendations');
  }
}

function parseRecommendationsResponse(response: string): AIRecommendations {
  // Simplified parser - in production, use structured output
  return {
    aiSearchOptimization: [
      {
        recommendation: 'Add comprehensive LocalBusiness schema',
        impact: 'high',
        effort: 'low',
        rationale: 'Improves AI understanding of business details'
      },
      {
        recommendation: 'Include FAQ section with common questions',
        impact: 'medium',
        effort: 'medium',
        rationale: 'Addresses common search queries'
      }
    ],
    contentGaps: [
      {
        gap: 'Customer testimonials',
        opportunity: 'Build trust and social proof',
        priority: 'high'
      },
      {
        gap: 'Service details',
        opportunity: 'Improve search relevance',
        priority: 'medium'
      }
    ],
    schemaSuggestions: [
      {
        schema: 'LocalBusiness',
        purpose: 'Business information',
        implementation: 'Add to page head'
      },
      {
        schema: 'Review',
        purpose: 'Customer feedback',
        implementation: 'Include in testimonials section'
      }
    ],
    competitiveAdvantages: [
      {
        advantage: 'Local expertise',
        howToLeverage: 'Create location-specific content and case studies'
      },
      {
        advantage: 'Customer service',
        howToLeverage: 'Highlight service quality in content'
      }
    ]
  };
}
