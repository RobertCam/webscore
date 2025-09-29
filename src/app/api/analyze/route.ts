import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequest, AnalyzeResponse, Scorecard } from '@/types/scorecard';
import { fetchRaw, renderRemotely } from '@/lib/fetcher/fetchRaw';
import { parseHTML, extractFacts, ParsedHTML } from '@/lib/parse/dom';
import { createCheckResult, computeCategoryScore, computeTotalScore } from '@/lib/analyze/rubric';
import { generateAIInsights, AnalysisContext } from '@/lib/ai/analysis';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: AnalyzeRequest = await request.json();
    const { url, enableAiInsights = true } = body;

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

    // Fetch raw HTML
    const rawData = await fetchRaw(url);
    
    // Parse HTML
    const parsed = parseHTML(rawData.html);
    
    // Extract facts
    const facts = extractFacts(parsed);
    
    // Run all checks
    const checkResults = await runAllChecks(rawData, parsed, facts as Record<string, unknown>);
    
    // Compute category scores
  const categoryResults = [
    computeCategoryScore('fetchability', checkResults),
    computeCategoryScore('metadata', checkResults),
    computeCategoryScore('schema', checkResults),
    computeCategoryScore('semantics', checkResults),
    computeCategoryScore('freshness', checkResults),
    computeCategoryScore('brand', checkResults),
    computeCategoryScore('accessibility', checkResults),
  ];
    
    // Compute total score
    const totalScore = computeTotalScore(categoryResults);
    
    // Create scorecard
    const scorecard: Scorecard = {
      url,
      final_url: rawData.finalUrl,
      rubric_version: '2.0.0',
      total_score: totalScore,
      categories: categoryResults,
      analyzed_at: new Date().toISOString(),
      phase: 1, // Keep for backward compatibility, but not used
    };

    // Generate AI insights if enabled and OpenAI is configured
    let aiInsights = null;
    console.log('AI Insights enabled:', enableAiInsights);
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    
    if (enableAiInsights && process.env.OPENAI_API_KEY) {
      try {
        console.log('Starting AI insights generation...');
        const analysisContext: AnalysisContext = {
          url: body.url,
          parsed,
          scorecard,
          brand: facts.brand as string,
          locality: facts.locality as string
        };
        console.log('Analysis context:', { url: analysisContext.url, brand: analysisContext.brand, locality: analysisContext.locality });
        aiInsights = await generateAIInsights(analysisContext);
        console.log('AI insights generated successfully:', !!aiInsights);
      } catch (error) {
        console.error('AI insights generation failed:', error);
        console.error('Error details:', error);
        // Continue without AI insights if it fails
      }
    } else {
      console.log('AI insights skipped:', !enableAiInsights ? 'Disabled by user' : 'No OpenAI API key found');
    }

    const duration = Date.now() - startTime;
    console.log(`Analysis completed in ${duration}ms for ${url}`);
    
    return NextResponse.json({
      success: true,
      scorecard,
      ai_insights: aiInsights as unknown as Record<string, unknown> | undefined,
      duration_ms: duration
    } as AnalyzeResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Analysis failed after ${duration}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      duration_ms: duration
    } as AnalyzeResponse, { status: 500 });
  }
}

// All checks implementation
async function runAllChecks(
  rawData: { html: string; finalUrl: string; status: number },
  parsed: ParsedHTML,
  facts: Record<string, unknown>
) {
  const results = [];

  // F1: HTTP 200
  if (rawData.status === 200) {
    results.push(createCheckResult('F1', 'pass', ['Page returns HTTP 200 OK']));
  } else {
    results.push(createCheckResult('F1', 'fail', [`Page returns HTTP ${rawData.status}`]));
  }

  // F2: No noindex meta
  const noindexTag = rawData.html.match(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i)?.[0] || '';
  const escapedNoindexTag = noindexTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  if (!parsed.noindex) {
    results.push(createCheckResult('F2', 'pass', [
      'No noindex meta tag found',
      ...(escapedNoindexTag ? [`HTML: ${escapedNoindexTag}`] : [])
    ]));
  } else {
    results.push(createCheckResult('F2', 'fail', [
      'noindex meta tag found',
      ...(escapedNoindexTag ? [`HTML: ${escapedNoindexTag}`] : [])
    ]));
  }

  // F3: Robots.txt compliance
  try {
    const robotsUrl = new URL('/robots.txt', rawData.finalUrl).toString();
    const robotsResponse = await fetch(robotsUrl);
    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      const path = new URL(rawData.finalUrl).pathname;
      const isBlocked = robotsText.includes(`Disallow: ${path}`) || 
                       robotsText.includes('Disallow: /');
      const gptBotBlocked = robotsText.includes('User-agent: GPTBot') && 
                           robotsText.includes('Disallow:');
      
      if (!isBlocked && !gptBotBlocked) {
        results.push(createCheckResult('F3', 'pass', ['robots.txt allows crawling and GPTBot']));
      } else {
        results.push(createCheckResult('F3', 'fail', [
          isBlocked ? 'Page path is blocked in robots.txt' : 'GPTBot is blocked in robots.txt'
        ]));
      }
    } else {
      results.push(createCheckResult('F3', 'pass', ['No robots.txt found (default allow)']));
    }
  } catch {
    results.push(createCheckResult('F3', 'pass', ['No robots.txt found (default allow)']));
  }

  // F4: Canonical URL
  const canonicalTag = rawData.html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || '';
  const escapedCanonicalTag = canonicalTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  if (parsed.canonical) {
    try {
      const canonicalUrl = new URL(parsed.canonical);
      if (canonicalUrl.protocol === 'http:' || canonicalUrl.protocol === 'https:') {
        results.push(createCheckResult('F4', 'pass', [
          `Canonical URL found: ${parsed.canonical}`,
          ...(escapedCanonicalTag ? [`HTML: ${escapedCanonicalTag}`] : [])
        ]));
      } else {
        results.push(createCheckResult('F4', 'fail', [
          'Canonical URL is not absolute',
          ...(escapedCanonicalTag ? [`HTML: ${escapedCanonicalTag}`] : [])
        ]));
      }
    } catch {
      results.push(createCheckResult('F4', 'fail', [
        'Canonical URL is invalid',
        ...(escapedCanonicalTag ? [`HTML: ${escapedCanonicalTag}`] : [])
      ]));
    }
  } else {
    results.push(createCheckResult('F4', 'fail', ['No canonical URL found']));
  }

  // F5: JS-render parity (and get JS-rendered HTML for other checks)
  let renderedData = null;
  let renderedParsed = parsed;
  try {
    renderedData = await renderRemotely(rawData.finalUrl);
    renderedParsed = parseHTML(renderedData.html);
    
    // Check H1 parity
    const h1Match = parsed.h1 === renderedParsed.h1;
    const textSimilarity = calculateTextSimilarity(parsed.mainText || '', renderedParsed.mainText || '');
    
    // Check for significant content differences
    const rawImages = rawData.html.match(/<img[^>]*>/gi) || [];
    const renderedImages = renderedData.html.match(/<img[^>]*>/gi) || [];
    const imageDiff = Math.abs(rawImages.length - renderedImages.length);
    
    const linkDiff = Math.abs(parsed.links.length - renderedParsed.links.length);
    const hasSignificantDifferences = imageDiff > 2 || linkDiff > 5;
    
    if (h1Match && textSimilarity > 0.8 && !hasSignificantDifferences) {
      results.push(createCheckResult('F5', 'pass', [
        'H1 matches between raw and rendered HTML',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`,
        `Images: ${rawImages.length} raw, ${renderedImages.length} rendered`,
        `Links: ${parsed.links.length} raw, ${renderedParsed.links.length} rendered`
      ]));
    } else if ((h1Match && textSimilarity > 0.6) || !hasSignificantDifferences) {
      results.push(createCheckResult('F5', 'partial', [
        h1Match ? 'H1 matches' : 'H1 differs',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`,
        `Images: ${rawImages.length} raw, ${renderedImages.length} rendered`,
        `Links: ${parsed.links.length} raw, ${renderedParsed.links.length} rendered`
      ]));
    } else {
      results.push(createCheckResult('F5', 'fail', [
        h1Match ? 'H1 matches' : 'H1 differs',
        `Text similarity: ${Math.round(textSimilarity * 100)}%`,
        `Images: ${rawImages.length} raw, ${renderedImages.length} rendered`,
        `Links: ${parsed.links.length} raw, ${renderedParsed.links.length} rendered`,
        hasSignificantDifferences ? 'Significant content differences detected' : ''
      ].filter(Boolean)));
    }
  } catch (error) {
    results.push(createCheckResult('F5', 'fail', [
      `JS rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    ]));
  }

  // M1: Title exists
  if (parsed.title) {
    const titleTag = rawData.html.match(/<title[^>]*>.*?<\/title>/i)?.[0] || '';
    const escapedTitleTag = titleTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    results.push(createCheckResult('M1', 'pass', [
      `Title found: "${parsed.title}"`,
      ...(escapedTitleTag ? [`HTML: ${escapedTitleTag}`] : [])
    ]));
  } else {
    results.push(createCheckResult('M1', 'fail', ['No title tag found']));
  }

  // M2: Optimized Title
  if (parsed.title) {
    const hasBrand = facts.brand && typeof facts.brand === 'string' && parsed.title.toLowerCase().includes(facts.brand.toLowerCase());
    const hasLocality = facts.locality && typeof facts.locality === 'string' && parsed.title.toLowerCase().includes(facts.locality.toLowerCase());
    
    if (hasBrand && hasLocality) {
      results.push(createCheckResult('M2', 'pass', [
        'Title contains both brand and locality',
        `Brand: ${facts.brand as string}, Locality: ${facts.locality as string}`
      ]));
    } else if (hasBrand || hasLocality) {
      results.push(createCheckResult('M2', 'partial', [
        `Title contains ${hasBrand ? 'brand' : 'locality'} but not both`,
        `Brand: ${(facts.brand as string) || 'not found'}, Locality: ${(facts.locality as string) || 'not found'}`
      ]));
    } else {
      results.push(createCheckResult('M2', 'fail', [
        'Title does not contain brand or locality'
      ]));
    }
  } else {
    results.push(createCheckResult('M2', 'fail', ['No title found']));
  }

  // M3: Meta Description
  if (parsed.description) {
    const metaDescTag = rawData.html.match(/<meta[^>]*name=["']description["'][^>]*>/i)?.[0] || '';
    const escapedMetaDescTag = metaDescTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    results.push(createCheckResult('M3', 'pass', [
      `Meta description found: "${parsed.description.substring(0, 100)}..."`,
      ...(escapedMetaDescTag ? [`HTML: ${escapedMetaDescTag}`] : [])
    ]));
  } else {
    results.push(createCheckResult('M3', 'fail', ['No meta description found']));
  }

  // M4: Meta description contains brand + locality
  if (parsed.description) {
    const hasBrand = facts.brand && typeof facts.brand === 'string' && parsed.description.toLowerCase().includes(facts.brand.toLowerCase());
    const hasLocality = facts.locality && typeof facts.locality === 'string' && parsed.description.toLowerCase().includes(facts.locality.toLowerCase());
    
    if (hasBrand && hasLocality) {
      results.push(createCheckResult('M4', 'pass', [
        'Description contains both brand and locality',
        `Brand: ${facts.brand as string}, Locality: ${facts.locality as string}`
      ]));
    } else if (hasBrand || hasLocality) {
      results.push(createCheckResult('M4', 'partial', [
        `Description contains ${hasBrand ? 'brand' : 'locality'} but not both`,
        `Brand: ${(facts.brand as string) || 'not found'}, Locality: ${(facts.locality as string) || 'not found'}`
      ]));
    } else {
      results.push(createCheckResult('M4', 'fail', [
        'Description does not contain brand or locality'
      ]));
    }
  } else {
    results.push(createCheckResult('M4', 'fail', ['No meta description found']));
  }

  // M5: Open Graph basics
  const ogChecks = [
    { prop: 'og:title', value: parsed.ogTitle },
    { prop: 'og:description', value: parsed.ogDescription },
    { prop: 'og:url', value: parsed.ogUrl },
    { prop: 'og:image', value: parsed.ogImage }
  ];
  
  const foundOg = ogChecks.filter(check => check.value).length;
  
  // Collect Open Graph meta tags for evidence
  const ogTags = rawData.html.match(/<meta[^>]*property=["']og:[^"']*["'][^>]*>/gi) || [];
  const escapedOgTags = ogTags.slice(0, 3).map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (foundOg === 4) {
    results.push(createCheckResult('M5', 'pass', [
      'All Open Graph tags found',
      ...(escapedOgTags.length > 0 ? [`HTML: ${escapedOgTags.join(', ')}`] : [])
    ]));
  } else if (foundOg >= 2) {
    results.push(createCheckResult('M5', 'partial', [
      `Found ${foundOg}/4 Open Graph tags`,
      `Missing: ${ogChecks.filter(check => !check.value).map(check => check.prop).join(', ')}`,
      ...(escapedOgTags.length > 0 ? [`HTML: ${escapedOgTags.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('M5', 'fail', [
      `Found ${foundOg}/4 Open Graph tags`,
      `Missing: ${ogChecks.filter(check => !check.value).map(check => check.prop).join(', ')}`,
      ...(escapedOgTags.length > 0 ? [`HTML: ${escapedOgTags.join(', ')}`] : [])
    ]));
  }

  // M6: Canonical Host Match
  if (parsed.canonical) {
    try {
      const canonicalUrl = new URL(parsed.canonical);
      const currentUrl = new URL(rawData.finalUrl);
      
      if (canonicalUrl.hostname === currentUrl.hostname) {
        results.push(createCheckResult('M6', 'pass', ['Canonical host matches current host']));
      } else {
        results.push(createCheckResult('M6', 'fail', [
          `Canonical host (${canonicalUrl.hostname}) does not match current host (${currentUrl.hostname})`
        ]));
      }
    } catch {
      results.push(createCheckResult('M6', 'fail', ['Invalid canonical URL']));
    }
  } else {
    results.push(createCheckResult('M6', 'fail', ['No canonical URL to compare']));
  }

  // S1: Core Business Schema (Highest Weight)
  const businessTypes = ['LocalBusiness', 'Organization', 'Store', 'Restaurant', 'Hotel', 'MedicalBusiness', 'ProfessionalService', 'FinancialService', 'AutomotiveBusiness', 'EntertainmentBusiness'];
  const businessSchemaItems = parsed.jsonLd.filter((item: Record<string, unknown>) => {
    const type = item['@type'];
    if (typeof type === 'string') {
      return businessTypes.some(businessType => type.includes(businessType));
    }
    if (Array.isArray(type)) {
      return type.some(t => businessTypes.some(businessType => t.includes(businessType)));
    }
    return false;
  });
  
  // Collect schema examples for evidence
  const schemaExamples = businessSchemaItems.slice(0, 2).map(item => 
    JSON.stringify(item, null, 2).substring(0, 200) + '...'
  );
  
  if (businessSchemaItems.length > 0) {
    results.push(createCheckResult('S1', 'pass', [
      'Core business schema found',
      ...(schemaExamples.length > 0 ? [`Schema: ${schemaExamples.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('S1', 'fail', [
      'No core business schema found'
    ]));
  }

  // S2: Content Enhancement Schema (Medium Weight)
  const contentTypes = ['FAQ', 'Product', 'Service', 'Offer', 'Event', 'Article', 'BlogPosting', 'HowTo', 'Recipe', 'Review'];
  const foundContentTypes = parsed.jsonLd.filter((item: Record<string, unknown>) => {
    const type = item['@type'];
    if (typeof type === 'string') {
      return contentTypes.some(contentType => type.includes(contentType));
    }
    if (Array.isArray(type)) {
      return type.some(t => contentTypes.some(contentType => t.includes(contentType)));
    }
    return false;
  });
  
  // Collect content schema examples for evidence
  const contentSchemaExamples = foundContentTypes.slice(0, 2).map(item => 
    JSON.stringify(item, null, 2).substring(0, 200) + '...'
  );
  
  if (foundContentTypes.length >= 2) {
    results.push(createCheckResult('S2', 'pass', [
      `Found ${foundContentTypes.length} content enhancement schema types`,
      ...(contentSchemaExamples.length > 0 ? [`Schema: ${contentSchemaExamples.join(', ')}`] : [])
    ]));
  } else if (foundContentTypes.length === 1) {
    results.push(createCheckResult('S2', 'partial', [
      `Found ${foundContentTypes.length} content enhancement schema type`,
      ...(contentSchemaExamples.length > 0 ? [`Schema: ${contentSchemaExamples.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('S2', 'fail', [
      'No content enhancement schema found'
    ]));
  }

  // S3: Contact Information Schema (Medium Weight)
  const contactFields = ['address', 'telephone', 'email', 'openingHours', 'contactPoint', 'geo', 'url'];
  const allSchemaItems = parsed.jsonLd.flat();
  const foundContactFields = contactFields.filter(field => 
    allSchemaItems.some((item: Record<string, unknown>) => item[field])
  );
  
  if (foundContactFields.length >= 3) {
    results.push(createCheckResult('S3', 'pass', [
      `Found ${foundContactFields.length}/7 contact information fields`,
      `Found: ${foundContactFields.join(', ')}`
    ]));
  } else if (foundContactFields.length >= 1) {
    results.push(createCheckResult('S3', 'partial', [
      `Found ${foundContactFields.length}/7 contact information fields`,
      `Found: ${foundContactFields.join(', ')}`
    ]));
  } else {
    results.push(createCheckResult('S3', 'fail', [
      'No contact information found in schema'
    ]));
  }

  // S4: Rich Content Schema (Lower Weight)
  const richContentTypes = ['Review', 'Rating', 'ImageObject', 'VideoObject', 'AudioObject', 'MediaObject', 'BreadcrumbList', 'SiteNavigationElement'];
  const foundRichContent = parsed.jsonLd.filter((item: Record<string, unknown>) => {
    const type = item['@type'];
    if (typeof type === 'string') {
      return richContentTypes.some(richType => type.includes(richType));
    }
    if (Array.isArray(type)) {
      return type.some(t => richContentTypes.some(richType => t.includes(richType)));
    }
    return false;
  });
  
  if (foundRichContent.length >= 2) {
    results.push(createCheckResult('S4', 'pass', [
      `Found ${foundRichContent.length} rich content schema types`
    ]));
  } else if (foundRichContent.length === 1) {
    results.push(createCheckResult('S4', 'partial', [
      `Found ${foundRichContent.length} rich content schema type`
    ]));
  } else {
    results.push(createCheckResult('S4', 'fail', [
      'No rich content schema found'
    ]));
  }

  // C1: Single H1 with locality
  const h1Tags = rawData.html.match(/<h1[^>]*>.*?<\/h1>/gi) || [];
  const escapedH1Tags = h1Tags.slice(0, 3).map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (parsed.h1s.length === 1) {
    const hasLocality = facts.locality && typeof facts.locality === 'string' && parsed.h1 && parsed.h1.toLowerCase().includes(facts.locality.toLowerCase());
    if (hasLocality) {
      results.push(createCheckResult('C1', 'pass', [
        `Single H1 found with locality: "${parsed.h1}"`,
        ...(escapedH1Tags.length > 0 ? [`HTML: ${escapedH1Tags[0]}`] : [])
      ]));
    } else {
      results.push(createCheckResult('C1', 'partial', [
        `Single H1 found but no locality detected: "${parsed.h1}"`,
        ...(escapedH1Tags.length > 0 ? [`HTML: ${escapedH1Tags[0]}`] : [])
      ]));
    }
  } else if (parsed.h1s.length === 0) {
    results.push(createCheckResult('C1', 'fail', ['No H1 found']));
  } else {
    results.push(createCheckResult('C1', 'fail', [
      `Multiple H1s found (${parsed.h1s.length}): ${parsed.h1s.join(', ')}`,
      ...(escapedH1Tags.length > 0 ? [`HTML: ${escapedH1Tags.join(', ')}`] : [])
    ]));
  }

  // C2: Heading Structure
  let headingScore = 0;
  // const maxHeadingScore = 5;
  const headingIssues: string[] = [];
  
  // Check for logical hierarchy (no jumps)
  for (let i = 0; i < parsed.headings.length - 1; i++) {
    const current = parsed.headings[i];
    const next = parsed.headings[i + 1];
    
    if (next.level > current.level + 1) {
      headingIssues.push(`Heading jump from H${current.level} to H${next.level}`);
    }
  }
  
  // Check for proper H2/H3 structure
  const h2Count = parsed.headings.filter(h => h.level === 2).length;
  const h3Count = parsed.headings.filter(h => h.level === 3).length;
  
  if (h2Count > 0) headingScore += 2;
  if (h3Count > 0) headingScore += 1;
  if (headingIssues.length === 0) headingScore += 2;
  
  if (headingScore >= 4) {
    results.push(createCheckResult('C2', 'pass', [
      `Good heading structure: ${h2Count} H2s, ${h3Count} H3s`,
      headingIssues.length === 0 ? 'No heading jumps' : `Issues: ${headingIssues.join(', ')}`
    ]));
  } else if (headingScore >= 2) {
    results.push(createCheckResult('C2', 'partial', [
      `Basic heading structure: ${h2Count} H2s, ${h3Count} H3s`,
      headingIssues.length > 0 ? `Issues: ${headingIssues.join(', ')}` : 'Could use more structure'
    ]));
  } else {
    results.push(createCheckResult('C2', 'fail', [
      `Poor heading structure: ${h2Count} H2s, ${h3Count} H3s`,
      headingIssues.length > 0 ? `Issues: ${headingIssues.join(', ')}` : 'No proper H2/H3 structure'
    ]));
  }

  // C3: Services in Lists
  const listElements = parsed.mainText?.match(/<ul>|<ol>|<li>|<table>/gi) || [];
  const listCount = listElements.length;
  
  if (listCount >= 3) {
    results.push(createCheckResult('C3', 'pass', [
      `Found ${listCount} list/table elements for services/amenities`
    ]));
  } else if (listCount >= 1) {
    results.push(createCheckResult('C3', 'partial', [
      `Found ${listCount} list/table elements (could use more structure)`
    ]));
  } else {
    results.push(createCheckResult('C3', 'fail', [
      'No list or table elements found for services/amenities'
    ]));
  }

  // C4: Section Anchors
  const headingsWithIds = parsed.headings.filter(h => h.id).length;
  const wordCount = parsed.mainText?.split(/\s+/).length || 0;
  const requiredAnchors = wordCount > 800 ? 3 : 1;
  
  if (headingsWithIds >= requiredAnchors) {
    results.push(createCheckResult('C4', 'pass', [
      `Found ${headingsWithIds} headings with anchor IDs (required: ${requiredAnchors})`
    ]));
  } else if (headingsWithIds >= 1) {
    results.push(createCheckResult('C4', 'partial', [
      `Found ${headingsWithIds} headings with anchor IDs (required: ${requiredAnchors})`
    ]));
  } else {
    results.push(createCheckResult('C4', 'fail', [
      `No headings with anchor IDs found (required: ${requiredAnchors})`
    ]));
  }

  // R1: Recent Updates
  const visibleDates = parsed.mainText?.match(/\b(updated|modified|last\s+updated|revised)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/gi);
  
  if (visibleDates && visibleDates.length > 0) {
    results.push(createCheckResult('R1', 'pass', [
      `Found visible date information: ${visibleDates[0]}`
    ]));
  } else {
    // Check for dateModified in any schema
    const allSchemaItems = parsed.jsonLd.flat();
    const dateModified = allSchemaItems.find((item: Record<string, unknown>) => item.dateModified)?.dateModified;
    
    if (dateModified) {
      try {
        const modifiedDate = new Date(dateModified as string);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 180) {
          results.push(createCheckResult('R1', 'pass', [
            `Schema shows recent update: ${daysDiff} days ago`
          ]));
        } else {
          results.push(createCheckResult('R1', 'fail', [
            `Schema shows old update: ${daysDiff} days ago`
          ]));
        }
      } catch {
        results.push(createCheckResult('R1', 'fail', [
          'Invalid dateModified format in schema'
        ]));
      }
    } else {
      results.push(createCheckResult('R1', 'fail', [
        'No visible or schema date information found'
      ]));
    }
  }

  // R2: Sitemap Freshness
  try {
    const sitemapUrl = new URL('/sitemap.xml', rawData.finalUrl).toString();
    const sitemapResponse = await fetch(sitemapUrl);
    
    if (sitemapResponse.ok) {
      const sitemapText = await sitemapResponse.text();
      const lastmodMatch = sitemapText.match(/<lastmod>([^<]+)<\/lastmod>/i);
      
      if (lastmodMatch) {
        const lastmodDate = new Date(lastmodMatch[1]);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - lastmodDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 180) {
          results.push(createCheckResult('R2', 'pass', [
            `Sitemap lastmod: ${daysDiff} days ago`,
            `Date: ${lastmodMatch[1]}`
          ]));
        } else {
          results.push(createCheckResult('R2', 'fail', [
            `Sitemap lastmod: ${daysDiff} days ago (older than 180 days)`,
            `Date: ${lastmodMatch[1]}`
          ]));
        }
      } else {
        results.push(createCheckResult('R2', 'partial', [
          'Sitemap found but no lastmod date'
        ]));
      }
    } else {
      results.push(createCheckResult('R2', 'fail', [
        'No sitemap.xml found'
      ]));
    }
  } catch {
    results.push(createCheckResult('R2', 'fail', [
      'Error checking sitemap'
    ]));
  }

  // N1: Brand consistent
  const schemaName = allSchemaItems.find((item: Record<string, unknown>) => item.name)?.name;
  const brandSources = [parsed.title, parsed.h1, schemaName].filter(Boolean);
  const brandConsistency = brandSources.every(source => 
    source && typeof source === 'string' && facts.brand && typeof facts.brand === 'string' && source.toLowerCase().includes(facts.brand.toLowerCase())
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

  // N2: Social Profiles
  const socialPlatforms = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com', 'snapchat.com', 'whatsapp.com', 'telegram.org', 'discord.com', 'reddit.com', 'twitch.tv', 'github.com', 'medium.com', 'behance.net', 'dribbble.com', 'flickr.com', 'vimeo.com', 'soundcloud.com', 'spotify.com', 'apple.com/music', 'amazon.com/music', 'bandcamp.com', 'mixcloud.com', 'anchor.fm', 'clubhouse.com', 'mastodon.social', 'threads.net', 'bluesky.com'];
  
  const sameAsLinks = allSchemaItems.find((item: Record<string, unknown>) => item.sameAs)?.sameAs as string[] || [];
  const socialLinks = sameAsLinks.filter(link => 
    socialPlatforms.some(platform => link.toLowerCase().includes(platform))
  );
  
  if (socialLinks.length >= 2) {
    results.push(createCheckResult('N2', 'pass', [
      `Found ${socialLinks.length} social profile links`,
      `Links: ${socialLinks.slice(0, 3).join(', ')}`
    ]));
  } else if (socialLinks.length === 1) {
    results.push(createCheckResult('N2', 'partial', [
      `Found ${socialLinks.length} social profile link`,
      `Link: ${socialLinks[0]}`
    ]));
  } else {
    results.push(createCheckResult('N2', 'fail', [
      'No social profile links found in schema'
    ]));
  }

  // N3: Logo Visibility
  const logoVisible = parsed.images.some(img => 
    img.alt && img.alt.toLowerCase().includes('logo') ||
    img.src && img.src.toLowerCase().includes('logo')
  );
  
  if (logoVisible) {
    results.push(createCheckResult('N3', 'pass', [
      'Logo visible on page'
    ]));
  } else {
    results.push(createCheckResult('N3', 'fail', [
      'No logo found visible on page'
    ]));
  }

  // N4: Brand Alt Text (use JS-rendered HTML for better accuracy)
  const renderedHtml = renderedData ? renderedData.html : rawData.html;
  
  const imgTags = renderedHtml.match(/<img[^>]*>/gi) || [];
  const totalImages = imgTags.length;
  
  if (totalImages === 0) {
    results.push(createCheckResult('N4', 'pass', [
      'No images found on page'
    ]));
  } else {
    let imagesWithBrandInfo = 0;
    const brandKeywords = ['store', 'shop', 'location', 'address', 'street', 'avenue', 'road', 'center', 'centre', 'mall', 'plaza'];
    
    imgTags.forEach(imgTag => {
      const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i) || 
                      imgTag.match(/alt\s*=\s*([^\s>]+)/i);
      if (altMatch && altMatch[1]) {
        const altText = altMatch[1].toLowerCase();
        // Check for brand/location keywords or business name patterns
        const hasBrandInfo = brandKeywords.some(keyword => altText.includes(keyword)) ||
                           altText.length > 20; // Longer alt text likely contains more descriptive info
        if (hasBrandInfo) {
          imagesWithBrandInfo++;
        }
      }
    });
    
    // Collect example img tags for evidence
    const exampleImgTags = imgTags.slice(0, 3).map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    
    if (imagesWithBrandInfo === totalImages) {
      results.push(createCheckResult('N4', 'pass', [
        `All ${totalImages} images have brand/location info in alt text`,
        ...(exampleImgTags.length > 0 ? [`Examples: ${exampleImgTags.join(', ')}`] : [])
      ]));
    } else if (imagesWithBrandInfo > totalImages * 0.5) {
      results.push(createCheckResult('N4', 'partial', [
        `${imagesWithBrandInfo}/${totalImages} images have brand/location info in alt text`,
        ...(exampleImgTags.length > 0 ? [`Examples: ${exampleImgTags.join(', ')}`] : [])
      ]));
    } else {
      results.push(createCheckResult('N4', 'fail', [
        `Only ${imagesWithBrandInfo}/${totalImages} images have brand/location info in alt text`,
        'Include business name, brand, or location in image alt text',
        ...(exampleImgTags.length > 0 ? [`Examples: ${exampleImgTags.join(', ')}`] : [])
      ]));
    }
  }

  // A1: Image Alt Text (use JS-rendered HTML for better accuracy)
  const a1ImgTags = renderedHtml.match(/<img[^>]*>/gi) || [];
  const a1TotalImages = a1ImgTags.length;
  
  let a1ImagesWithAlt = 0;
  a1ImgTags.forEach(imgTag => {
    // Check for alt attribute with various formats
    const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i) || 
                    imgTag.match(/alt\s*=\s*([^\s>]+)/i);
    if (altMatch && altMatch[1] && altMatch[1].trim().length > 0) {
      a1ImagesWithAlt++;
    }
  });
  
  // Collect example img tags for evidence
  const a1ExampleImgTags = a1ImgTags.slice(0, 3).map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (a1TotalImages === 0) {
    results.push(createCheckResult('A1', 'pass', [
      'No images found on page'
    ]));
  } else if (a1ImagesWithAlt === a1TotalImages) {
    results.push(createCheckResult('A1', 'pass', [
      `All ${a1TotalImages} images have alt text`,
      ...(a1ExampleImgTags.length > 0 ? [`Examples: ${a1ExampleImgTags.join(', ')}`] : [])
    ]));
  } else if (a1ImagesWithAlt > a1TotalImages * 0.5) {
    results.push(createCheckResult('A1', 'partial', [
      `${a1ImagesWithAlt}/${a1TotalImages} images have alt text`,
      ...(a1ExampleImgTags.length > 0 ? [`Examples: ${a1ExampleImgTags.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('A1', 'fail', [
      `Only ${a1ImagesWithAlt}/${a1TotalImages} images have alt text`,
      ...(a1ExampleImgTags.length > 0 ? [`Examples: ${a1ExampleImgTags.join(', ')}`] : [])
    ]));
  }

  // A2: Form Structure (use JS-rendered HTML)
  const forms = renderedParsed.mainText?.match(/<form[^>]*>/gi) || [];
  const labels = renderedParsed.mainText?.match(/<label[^>]*>/gi) || [];
  const inputs = renderedParsed.mainText?.match(/<input[^>]*>/gi) || [];
  
  // Collect form elements for evidence
  const formElements = [...forms, ...labels, ...inputs].slice(0, 3);
  const escapedFormElements = formElements.map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (forms.length === 0) {
    results.push(createCheckResult('A2', 'pass', [
      'No forms found on page'
    ]));
  } else if (labels.length >= inputs.length * 0.8) {
    results.push(createCheckResult('A2', 'pass', [
      `Good form structure: ${labels.length} labels for ${inputs.length} inputs`,
      ...(escapedFormElements.length > 0 ? [`HTML: ${escapedFormElements.join(', ')}`] : [])
    ]));
  } else if (labels.length > 0) {
    results.push(createCheckResult('A2', 'partial', [
      `Basic form structure: ${labels.length} labels for ${inputs.length} inputs`,
      ...(escapedFormElements.length > 0 ? [`HTML: ${escapedFormElements.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('A2', 'fail', [
      `Poor form structure: ${labels.length} labels for ${inputs.length} inputs`,
      ...(escapedFormElements.length > 0 ? [`HTML: ${escapedFormElements.join(', ')}`] : [])
    ]));
  }

  // A3: Text Readability (use JS-rendered HTML)
  const textContent = renderedParsed.mainText?.replace(/<[^>]*>/g, '') || '';
  const textWordCount = textContent.split(/\s+/).length;
  const hasReadableContent = textWordCount > 100;
  
  if (hasReadableContent) {
    results.push(createCheckResult('A3', 'pass', [
      `Page has substantial text content (${textWordCount} words)`
    ]));
  } else {
    results.push(createCheckResult('A3', 'fail', [
      `Page has minimal text content (${textWordCount} words)`
    ]));
  }

  // A4: Navigation Structure (use JS-rendered HTML)
  const navElements = renderedParsed.mainText?.match(/<nav[^>]*>/gi) || [];
  const navListElements = renderedParsed.mainText?.match(/<ul[^>]*>|<ol[^>]*>/gi) || [];
  const descriptiveLinks = renderedParsed.links.filter(link =>
    link.text && link.text.length > 3 && !link.text.toLowerCase().includes('click here')
  );
  
  // Collect navigation elements for evidence
  const navElementsForEvidence = [...navElements, ...navListElements].slice(0, 3);
  const escapedNavElements = navElementsForEvidence.map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (navElements.length > 0 && navListElements.length > 0) {
    results.push(createCheckResult('A4', 'pass', [
      `Good navigation structure: ${navElements.length} nav elements, ${navListElements.length} lists`,
      ...(escapedNavElements.length > 0 ? [`HTML: ${escapedNavElements.join(', ')}`] : [])
    ]));
  } else if (descriptiveLinks.length > renderedParsed.links.length * 0.7) {
    results.push(createCheckResult('A4', 'partial', [
      `Basic navigation: ${descriptiveLinks.length}/${renderedParsed.links.length} descriptive links`,
      ...(escapedNavElements.length > 0 ? [`HTML: ${escapedNavElements.join(', ')}`] : [])
    ]));
  } else {
    results.push(createCheckResult('A4', 'fail', [
      `Poor navigation structure: ${descriptiveLinks.length}/${renderedParsed.links.length} descriptive links`,
      ...(escapedNavElements.length > 0 ? [`HTML: ${escapedNavElements.join(', ')}`] : [])
    ]));
  }

  // A5: Video Accessibility (use JS-rendered HTML)
  const videoTags = renderedHtml.match(/<video[^>]*>/gi) || [];
  const totalVideos = videoTags.length;
  
  // Collect video tags for evidence
  const escapedVideoTags = videoTags.slice(0, 3).map(tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  
  if (totalVideos === 0) {
    results.push(createCheckResult('A5', 'pass', [
      'No videos found on page'
    ]));
  } else {
    let videosWithAccessibility = 0;
    let hasTranscripts = false;
    
    videoTags.forEach(videoTag => {
      // Check for captions/tracks
      const hasTracks = videoTag.includes('<track') || videoTag.includes('kind="captions"') || videoTag.includes('kind="subtitles"');
      if (hasTracks) {
        videosWithAccessibility++;
      }
    });
    
    // Check for transcript links near videos
    const transcriptKeywords = ['transcript', 'captions', 'subtitles', 'closed caption'];
    const hasTranscriptLinks = transcriptKeywords.some(keyword => 
      renderedHtml.toLowerCase().includes(keyword) && 
      renderedHtml.toLowerCase().includes('video')
    );
    
    if (hasTranscriptLinks) {
      hasTranscripts = true;
      videosWithAccessibility = Math.max(videosWithAccessibility, 1);
    }
    
    if (videosWithAccessibility === totalVideos) {
      results.push(createCheckResult('A5', 'pass', [
        `All ${totalVideos} videos have accessibility features`,
        hasTranscripts ? 'Transcript links found' : 'Video tracks/captions found',
        ...(escapedVideoTags.length > 0 ? [`HTML: ${escapedVideoTags.join(', ')}`] : [])
      ]));
    } else if (videosWithAccessibility > 0) {
      results.push(createCheckResult('A5', 'partial', [
        `${videosWithAccessibility}/${totalVideos} videos have accessibility features`,
        hasTranscripts ? 'Some transcript links found' : 'Some video tracks found',
        ...(escapedVideoTags.length > 0 ? [`HTML: ${escapedVideoTags.join(', ')}`] : [])
      ]));
    } else {
      results.push(createCheckResult('A5', 'fail', [
        `${totalVideos} videos found but no accessibility features detected`,
        'Add captions, transcripts, or descriptive text for video content',
        ...(escapedVideoTags.length > 0 ? [`HTML: ${escapedVideoTags.join(', ')}`] : [])
      ]));
    }
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
