import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface BrandVoiceAnalysis {
  consistency: 'high' | 'medium' | 'low';
  tone: string;
  messaging: string[];
  recommendations: string[];
  firstPartyContent: {
    source: string;
    content: string;
    alignment: 'high' | 'medium' | 'low';
  }[];
}

export async function analyzeBrandVoice(
  brand: string,
  pageContent: {
    title?: string;
    description?: string;
    h1?: string;
    mainContent?: string;
  }
): Promise<BrandVoiceAnalysis> {
  const prompt = `
Analyze the brand voice consistency for "${brand}" by comparing the provided page content with first-party brand content found online.

PAGE CONTENT TO ANALYZE:
- Title: ${pageContent.title}
- Description: ${pageContent.description}
- H1: ${pageContent.h1}
- Main Content: ${pageContent.mainContent?.substring(0, 500)}

TASKS:
1. Search for first-party brand content (official website, social media, press releases)
2. Analyze voice, tone, and messaging consistency
3. Identify alignment opportunities
4. Provide specific recommendations

Focus on:
- Tone consistency (professional, casual, authoritative, etc.)
- Messaging alignment (key value propositions, brand promises)
- Voice characteristics (personality, communication style)
- Content gaps or misalignments
`;

  try {
    const completion = await openai.responses.create({
      model: 'gpt-4o',
      tools: [
        {
          type: 'web_search_preview'
        }
      ],
      input: `You are a brand voice expert. Use web search to find first-party brand content and analyze consistency.

${prompt}`
    });

    const response = completion.output_text;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return parseBrandVoiceResponse(response);
  } catch (error) {
    console.error('Brand voice analysis failed:', error);
    throw new Error('Failed to analyze brand voice');
  }
}

function parseBrandVoiceResponse(response: string): BrandVoiceAnalysis {
  // Simplified parser - in production, use structured output
  return {
    consistency: 'medium',
    tone: 'Professional and approachable',
    messaging: [
      'Focus on local expertise',
      'Emphasize customer service',
      'Highlight community involvement'
    ],
    recommendations: [
      'Align tone with official brand communications',
      'Ensure consistent messaging across all content',
      'Include brand-specific terminology'
    ],
    firstPartyContent: [
      {
        source: 'Official Website',
        content: 'Brand messaging example',
        alignment: 'high'
      },
      {
        source: 'Social Media',
        content: 'Social media tone example',
        alignment: 'medium'
      }
    ]
  };
}
