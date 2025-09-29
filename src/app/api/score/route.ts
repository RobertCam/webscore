import { NextRequest, NextResponse } from 'next/server';
import { ScoreRequest, ScoreResponse } from '@/types/scorecard';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ScoreRequest = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      } as ScoreResponse, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      } as ScoreResponse, { status: 400 });
    }

    // Call the existing analyze endpoint internally with AI disabled
    const analyzeUrl = new URL('/api/analyze', request.url);
    
    try {
      const analyzeResponse = await fetch(analyzeUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(),
          enableAiInsights: false // Disable AI insights for external API
        }),
      });

      const analyzeData = await analyzeResponse.json();
      
      if (!analyzeData.success) {
        return NextResponse.json({
          success: false,
          error: analyzeData.error || 'Analysis failed',
          duration_ms: Date.now() - startTime
        } as ScoreResponse, { status: 500 });
      }

      // Return only the scorecard (no AI insights)
      const duration = Date.now() - startTime;
      console.log(`Score API completed in ${duration}ms for ${url} (score: ${analyzeData.scorecard?.total_score || 0}/100)`);

      return NextResponse.json({
        success: true,
        scorecard: analyzeData.scorecard,
        duration_ms: duration
      } as ScoreResponse);

    } catch (fetchError) {
      console.error('Internal analyze call failed:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Internal analysis service unavailable',
        duration_ms: Date.now() - startTime
      } as ScoreResponse, { status: 500 });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Score analysis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      duration_ms: duration
    } as ScoreResponse, { status: 500 });
  }
}