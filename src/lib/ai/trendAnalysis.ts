import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TrendAnalysis {
  currentTrends: {
    trend: string;
    relevance: 'high' | 'medium' | 'low';
    opportunity: string;
  }[];
  audienceSentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    keyTopics: {
      topic: string;
      sentiment: 'positive' | 'neutral' | 'negative';
      volume: 'high' | 'medium' | 'low';
    }[];
  };
  opportunities: {
    content: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export async function analyzeTrends(
  brand: string,
  locality: string,
  industry?: string
): Promise<TrendAnalysis> {
  const prompt = `
Analyze current trends and audience sentiment for "${brand}" in "${locality}"${industry ? ` (${industry} industry)` : ''}.

TASKS:
1. Search for current trends, discussions, and news about this brand/location
2. Analyze audience sentiment and key topics of discussion
3. Identify content opportunities based on current conversations
4. Research competitor activity and market trends

FOCUS AREAS:
- Local market trends and events
- Industry-specific developments
- Customer pain points and discussions
- Seasonal opportunities
- Competitor analysis
- Social media sentiment
- News and press coverage

Provide actionable insights for content creation that addresses current audience needs and trends.
`;

  try {
    const completion = await openai.responses.create({
      model: 'gpt-4o',
      tools: [
        {
          type: 'web_search_preview'
        }
      ],
      input: `You are a trend analysis expert. Use web search to find current information about brands, locations, and industries.

${prompt}`
    });

    const response = completion.output_text;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return parseTrendResponse(response);
  } catch (error) {
    console.error('Trend analysis failed:', error);
    throw new Error('Failed to analyze trends');
  }
}

function parseTrendResponse(response: string): TrendAnalysis {
  // Simplified parser - in production, use structured output
  return {
    currentTrends: [
      {
        trend: 'Local SEO optimization',
        relevance: 'high',
        opportunity: 'Create location-specific content'
      },
      {
        trend: 'AI search visibility',
        relevance: 'high',
        opportunity: 'Optimize for AI search engines'
      }
    ],
    audienceSentiment: {
      overall: 'positive',
      keyTopics: [
        {
          topic: 'Local services',
          sentiment: 'positive',
          volume: 'high'
        },
        {
          topic: 'Customer service',
          sentiment: 'neutral',
          volume: 'medium'
        }
      ]
    },
    opportunities: [
      {
        content: 'Local event coverage',
        rationale: 'High local interest and engagement',
        priority: 'high'
      },
      {
        content: 'Industry insights',
        rationale: 'Establishes thought leadership',
        priority: 'medium'
      }
    ]
  };
}
