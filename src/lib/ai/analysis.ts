import OpenAI from 'openai';
import { ParsedHTML } from '@/lib/parse/dom';
import { Scorecard } from '@/types/scorecard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIInsights {
  markdownResponse?: string; // Raw markdown response for new UI
  // Legacy structured data (kept for backward compatibility)
  brandVoiceAnalysis?: {
    consistency: 'high' | 'medium' | 'low';
    recommendations: string[];
    firstPartyContent: string[];
  };
  trendAnalysis?: {
    currentTrends: string[];
    audienceSentiment: 'positive' | 'neutral' | 'negative';
    opportunities: string[];
  };
  contentRecommendations?: {
    aiSearchOptimization: string[];
    contentGaps: string[];
    schemaSuggestions: string[];
  };
  competitiveInsights?: {
    marketPosition: string;
    differentiationOpportunities: string[];
  };
}

export interface AnalysisContext {
  url: string;
  parsed: ParsedHTML;
  scorecard: Scorecard;
  brand?: string;
  locality?: string;
}

export async function generateAIInsights(context: AnalysisContext): Promise<AIInsights> {
  const { url, parsed, scorecard, brand, locality } = context;
  
  // Get more detailed content for analysis
  const h2s = parsed.headings.filter(h => h.level === 2).map(h => h.text);
  const h3s = parsed.headings.filter(h => h.level === 3).map(h => h.text);
  
  const fullContent = {
    title: parsed.title || '',
    description: parsed.description || '',
    h1: parsed.h1 || '',
    h2s: h2s,
    h3s: h3s,
    mainText: parsed.mainText || '',
    jsonLd: parsed.jsonLd.map(item => item).slice(0, 3), // First 3 schema items
    allText: (parsed.mainText || '').substring(0, 2000), // First 2000 chars
    links: parsed.links?.slice(0, 10) || [], // First 10 internal/external links
  };

  const weaknesses = scorecard.categories
    .filter(c => c.score < c.max_score * 0.7)
    .map(c => `${c.label} (${c.score}/${c.max_score})`);

  const prompt = `
You are an expert AI content strategist analyzing a specific webpage for content optimization and AI search visibility.

## PAGE ANALYSIS ASSIGNMENT

Analyze this specific webpage and provide targeted content recommendations based on the actual page content, brand voice analysis, and current local/industry trends.

## CURRENT PAGE CONTENT:
**URL:** ${url}
**Title:** ${fullContent.title}
**Meta Description:** ${fullContent.description}
**Main H1:** ${fullContent.h1}
**Subheadings (H2s):** ${fullContent.h2s.join(' | ')}
**Main Content:** ${fullContent.allText}

**Brand Context:** ${brand || 'Unknown brand'}
**Location:** ${locality || 'Unknown location'}
**Current SEO Score:** ${scorecard.total_score}/100

**Performance Issues:** ${weaknesses.join(', ') || 'No significant weaknesses detected'}

## ANALYSIS REQUIREMENTS:

1. **CONTENT AUDIT & IMPROVEMENT:**
   - Analyze the actual page content quality, structure, and messaging
   - Identify specific content gaps and weak areas
   - Provide exact recommendations for improving the existing content

2. **BRAND VOICE RESEARCH & ALIGNMENT:**
   - Use web search to gather brand voice examples from official sources
   - Compare the current page's tone with brand's official communications
   - Suggest specific wording changes to better match brand voice

3. **LOCAL MARKET INTELLIGENCE:**
   - Research current trends, events, and conversations in ${locality || 'this location'}
   - Identify content opportunities based on local audience interests
   - Suggest locally relevant content that competitors aren't covering

4. **AI SEARCH OPTIMIZATION:**
   - Based on the actual page content, suggest improvements for AI search visibility
   - Recommend specific content additions that answer common queries
   - Suggest schema markup improvements based on the page's content type

5. **CONTENT GENERATION RECOMMENDATIONS:**
   - Provide specific content suggestions written in the brand's voice
   - Include sample headlines, descriptions, or content snippets
   - Suggest topics that align with both brand expertise and local search intent

## OUTPUT FORMAT:
Provide specific, actionable recommendations with examples. Focus on improving THIS specific page rather than generic advice.`;

  try {
    console.log(`Making OpenAI request for URL: ${url}`);
    console.log(`Brand: ${brand}, Locality: ${locality}`);
    console.log(`Content length: ${fullContent.allText.length} chars`);
    
    const completion = await openai.responses.create({
      model: 'gpt-4o',
      tools: [
        {
          type: 'web_search_preview'
        }
      ],
      input: `As an expert AI content strategist, analyze this specific webpage and provide targeted recommendations.

${prompt}`
    });

    console.log('OpenAI response received:', completion);
    
    // Parse the response and structure it
    const response = completion.output_text;
    console.log('OpenAI output_text:', response?.substring(0, 200) + '...');
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the actual AI response, not hardcoded data
    // Just return the raw markdown response
    return {
      markdownResponse: response
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw new Error(`Failed to generate AI insights: ${error}`);
  }
}

// No parsing needed - we'll render markdown directly!
