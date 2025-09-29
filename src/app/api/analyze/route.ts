import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequest, AnalyzeResponse, Scorecard } from '@/types/scorecard';
import { fetchRaw, renderRemotely } from '@/lib/fetcher/fetchRaw';
import { parseHTML, extractFacts } from '@/lib/parse/dom';
import { getCurrentPhase, createCheckResult, computeCategoryScore, computeTotalScore } from '@/lib/analyze/rubric';

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      } as AnalyzeResponse, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      } as AnalyzeResponse, { status: 400 });
    }

    const phase = getCurrentPhase();
    
    // Fetch raw HTML
    const rawData = await fetchRaw(url);
    
    // Parse HTML
    const parsed = parseHTML(rawData.html);
    
    // Extract facts
    const facts = extractFacts(parsed);
    
    // Run Phase 1 checks
    const checkResults = await runPhase1Checks(rawData, parsed, facts);
    
    // Compute category scores
    const categoryResults = [
      computeCategoryScore('fetchability', checkResults, phase),
      computeCategoryScore('metadata', checkResults, phase),
      computeCategoryScore('schema', checkResults, phase),
      computeCategoryScore('semantics', checkResults, phase),
      computeCategoryScore('freshness', checkResults, phase),
      computeCategoryScore('brand', checkResults, phase),
    ];
    
    // Compute total score
    const totalScore = computeTotalScore(categoryResults, phase);
    
    // Create scorecard
    const scorecard: Scorecard = {
      url,
      final_url: rawData.finalUrl,
      rubric_version: '2.0.0',
      total_score: totalScore,
      categories: categoryResults,
      analyzed_at: new Date().toISOString(),
      phase,
    };

    return NextResponse.json({
      success: true,
      scorecard
    } as AnalyzeResponse);

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as AnalyzeResponse, { status: 500 });
  }
}

// Phase 1 checks implementation
async function runPhase1Checks(
  rawData: { html: string; finalUrl: string; status: number },
  parsed: any,
  facts: any
) {
  const results = [];

  // F1: HTTP 200
  if (rawData.status === 200) {
    results.push(createCheckResult('F1', 'pass', ['Page returns HTTP 200 OK']));
  } else {
    results.push(createCheckResult('F1', 'fail', [`Page returns HTTP ${rawData.status}`]));
  }

  // F2: No noindex meta
  if (!parsed.noindex) {
    results.push(createCheckResult('F2', 'pass', ['No noindex meta tag found']));
  } else {
    results.push(createCheckResult('F2', 'fail', ['noindex meta tag found']));
  }

  // F5: JS-render parity (simplified for now - will implement with Cloudflare)
  try {
    const renderedData = await renderRemotely(rawData.finalUrl);
    const renderedParsed = parseHTML(renderedData.html);
    
    // Check H1 parity
    const h1Match = parsed.h1 === renderedParsed.h1;
    const textSimilarity = calculateTextSimilarity(parsed.mainText || '', renderedParsed.mainText || '');
    
    if (h1Match && textSimilarity > 0.8) {
      results.push(createCheckResult('F5', 'pass', [
        'H1 matches between raw and rendered HTML',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`
      ]));
    } else if (h1Match || textSimilarity > 0.6) {
      results.push(createCheckResult('F5', 'partial', [
        h1Match ? 'H1 matches' : 'H1 differs',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`
      ]));
    } else {
      results.push(createCheckResult('F5', 'fail', [
        'H1 differs between raw and rendered HTML',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`
      ]));
    }
  } catch (error) {
    results.push(createCheckResult('F5', 'fail', [
      `JS rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    ]));
  }

  // M1: Title exists
  if (parsed.title) {
    results.push(createCheckResult('M1', 'pass', [`Title found: "${parsed.title}"`]));
  } else {
    results.push(createCheckResult('M1', 'fail', ['No title tag found']));
  }

  // M4: Meta description contains brand + locality
  if (parsed.description) {
    const hasBrand = facts.brand && parsed.description.toLowerCase().includes(facts.brand.toLowerCase());
    const hasLocality = facts.locality && parsed.description.toLowerCase().includes(facts.locality.toLowerCase());
    
    if (hasBrand && hasLocality) {
      results.push(createCheckResult('M4', 'pass', [
        'Description contains both brand and locality',
        `Brand: ${facts.brand}, Locality: ${facts.locality}`
      ]));
    } else if (hasBrand || hasLocality) {
      results.push(createCheckResult('M4', 'partial', [
        `Description contains ${hasBrand ? 'brand' : 'locality'} but not both`,
        `Brand: ${facts.brand || 'not found'}, Locality: ${facts.locality || 'not found'}`
      ]));
    } else {
      results.push(createCheckResult('M4', 'fail', [
        'Description does not contain brand or locality'
      ]));
    }
  } else {
    results.push(createCheckResult('M4', 'fail', ['No meta description found']));
  }

  // S1: Valid JSON-LD parses
  if (parsed.jsonLd.length > 0) {
    results.push(createCheckResult('S1', 'pass', [
      `Found ${parsed.jsonLd.length} valid JSON-LD block(s)`
    ]));
  } else {
    results.push(createCheckResult('S1', 'fail', ['No valid JSON-LD found']));
  }

  // S2: LocalBusiness essentials (subset for Phase 1)
  const localBusiness = parsed.jsonLd.find((item: any) => 
    item['@type'] === 'LocalBusiness' || 
    (Array.isArray(item['@type']) && item['@type'].includes('LocalBusiness'))
  );
  
  if (localBusiness) {
    const essentials = ['name', 'url', 'telephone', 'address'];
    const foundEssentials = essentials.filter(prop => localBusiness[prop]);
    
    if (foundEssentials.length >= 3) {
      results.push(createCheckResult('S2', 'pass', [
        `LocalBusiness schema found with ${foundEssentials.length}/4 essentials`,
        `Found: ${foundEssentials.join(', ')}`
      ]));
    } else {
      results.push(createCheckResult('S2', 'partial', [
        `LocalBusiness schema found with ${foundEssentials.length}/4 essentials`,
        `Found: ${foundEssentials.join(', ') || 'none'}`
      ]));
    }
  } else {
    results.push(createCheckResult('S2', 'fail', ['No LocalBusiness schema found']));
  }

  // C1: Single H1 with locality
  if (parsed.h1s.length === 1) {
    const hasLocality = facts.locality && parsed.h1.toLowerCase().includes(facts.locality.toLowerCase());
    if (hasLocality) {
      results.push(createCheckResult('C1', 'pass', [
        `Single H1 found with locality: "${parsed.h1}"`
      ]));
    } else {
      results.push(createCheckResult('C1', 'partial', [
        `Single H1 found but no locality detected: "${parsed.h1}"`
      ]));
    }
  } else if (parsed.h1s.length === 0) {
    results.push(createCheckResult('C1', 'fail', ['No H1 found']));
  } else {
    results.push(createCheckResult('C1', 'fail', [
      `Multiple H1s found (${parsed.h1s.length}): ${parsed.h1s.join(', ')}`
    ]));
  }

  // N1: Brand consistent
  const brandSources = [parsed.title, parsed.h1, localBusiness?.name].filter(Boolean);
  const brandConsistency = brandSources.every(source => 
    source && facts.brand && source.toLowerCase().includes(facts.brand.toLowerCase())
  );
  
  if (brandConsistency && brandSources.length >= 2) {
    results.push(createCheckResult('N1', 'pass', [
      'Brand consistent across title, H1, and schema'
    ]));
  } else if (brandSources.length >= 2) {
    results.push(createCheckResult('N1', 'partial', [
      'Brand found in some but not all sources'
    ]));
  } else {
    results.push(createCheckResult('N1', 'fail', [
      'Brand not consistently found across sources'
    ]));
  }

  return results;
}

// Simple text similarity calculation
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}
