import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequest, AnalyzeResponse, Scorecard } from '@/types/scorecard';
import { fetchRaw, renderRemotely } from '@/lib/fetcher/fetchRaw';
import { parseHTML, extractFacts } from '@/lib/parse/dom';
import { createCheckResult, computeCategoryScore, computeTotalScore } from '@/lib/analyze/rubric';

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

    // Fetch raw HTML
    const rawData = await fetchRaw(url);
    
    // Parse HTML
    const parsed = parseHTML(rawData.html);
    
    // Extract facts
    const facts = extractFacts(parsed);
    
    // Run all checks
    const checkResults = await runAllChecks(rawData, parsed, facts);
    
    // Compute category scores
    const categoryResults = [
      computeCategoryScore('fetchability', checkResults),
      computeCategoryScore('metadata', checkResults),
      computeCategoryScore('schema', checkResults),
      computeCategoryScore('semantics', checkResults),
      computeCategoryScore('freshness', checkResults),
      computeCategoryScore('brand', checkResults),
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

// All checks implementation
async function runAllChecks(
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
  } catch (error) {
    results.push(createCheckResult('F3', 'pass', ['No robots.txt found (default allow)']));
  }

  // F4: Canonical URL
  if (parsed.canonical) {
    try {
      const canonicalUrl = new URL(parsed.canonical);
      if (canonicalUrl.protocol === 'http:' || canonicalUrl.protocol === 'https:') {
        results.push(createCheckResult('F4', 'pass', [`Canonical URL found: ${parsed.canonical}`]));
      } else {
        results.push(createCheckResult('F4', 'fail', ['Canonical URL is not absolute']));
      }
    } catch (error) {
      results.push(createCheckResult('F4', 'fail', ['Canonical URL is invalid']));
    }
  } else {
    results.push(createCheckResult('F4', 'fail', ['No canonical URL found']));
  }

  // F5: JS-render parity
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

  // M2: Optimized Title
  if (parsed.title) {
    const hasBrand = facts.brand && parsed.title.toLowerCase().includes(facts.brand.toLowerCase());
    const hasLocality = facts.locality && parsed.title.toLowerCase().includes(facts.locality.toLowerCase());
    
    if (hasBrand && hasLocality) {
      results.push(createCheckResult('M2', 'pass', [
        'Title contains both brand and locality',
        `Brand: ${facts.brand}, Locality: ${facts.locality}`
      ]));
    } else if (hasBrand || hasLocality) {
      results.push(createCheckResult('M2', 'partial', [
        `Title contains ${hasBrand ? 'brand' : 'locality'} but not both`,
        `Brand: ${facts.brand || 'not found'}, Locality: ${facts.locality || 'not found'}`
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
    results.push(createCheckResult('M3', 'pass', [`Meta description found: "${parsed.description.substring(0, 100)}..."`]));
  } else {
    results.push(createCheckResult('M3', 'fail', ['No meta description found']));
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

  // M5: Open Graph basics
  const ogChecks = [
    { prop: 'og:title', value: parsed.ogTitle },
    { prop: 'og:description', value: parsed.ogDescription },
    { prop: 'og:url', value: parsed.ogUrl },
    { prop: 'og:image', value: parsed.ogImage }
  ];
  
  const foundOg = ogChecks.filter(check => check.value).length;
  
  if (foundOg === 4) {
    results.push(createCheckResult('M5', 'pass', ['All Open Graph tags found']));
  } else if (foundOg >= 2) {
    results.push(createCheckResult('M5', 'partial', [
      `Found ${foundOg}/4 Open Graph tags`,
      `Missing: ${ogChecks.filter(check => !check.value).map(check => check.prop).join(', ')}`
    ]));
  } else {
    results.push(createCheckResult('M5', 'fail', [
      `Found ${foundOg}/4 Open Graph tags`,
      `Missing: ${ogChecks.filter(check => !check.value).map(check => check.prop).join(', ')}`
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
    } catch (error) {
      results.push(createCheckResult('M6', 'fail', ['Invalid canonical URL']));
    }
  } else {
    results.push(createCheckResult('M6', 'fail', ['No canonical URL to compare']));
  }

  // S1: Core Business Schema (Highest Weight)
  const businessTypes = ['LocalBusiness', 'Organization', 'Store', 'Restaurant', 'Hotel', 'MedicalBusiness', 'ProfessionalService', 'FinancialService', 'AutomotiveBusiness', 'EntertainmentBusiness'];
  const hasBusinessSchema = parsed.jsonLd.some((item: any) => {
    const type = item['@type'];
    if (typeof type === 'string') {
      return businessTypes.some(businessType => type.includes(businessType));
    }
    if (Array.isArray(type)) {
      return type.some(t => businessTypes.some(businessType => t.includes(businessType)));
    }
    return false;
  });
  
  if (hasBusinessSchema) {
    results.push(createCheckResult('S1', 'pass', [
      'Core business schema found'
    ]));
  } else {
    results.push(createCheckResult('S1', 'fail', [
      'No core business schema found'
    ]));
  }

  // S2: Content Enhancement Schema (Medium Weight)
  const contentTypes = ['FAQ', 'Product', 'Service', 'Offer', 'Event', 'Article', 'BlogPosting', 'HowTo', 'Recipe', 'Review'];
  const foundContentTypes = parsed.jsonLd.filter((item: any) => {
    const type = item['@type'];
    if (typeof type === 'string') {
      return contentTypes.some(contentType => type.includes(contentType));
    }
    if (Array.isArray(type)) {
      return type.some(t => contentTypes.some(contentType => t.includes(contentType)));
    }
    return false;
  });
  
  if (foundContentTypes.length >= 2) {
    results.push(createCheckResult('S2', 'pass', [
      `Found ${foundContentTypes.length} content enhancement schema types`
    ]));
  } else if (foundContentTypes.length === 1) {
    results.push(createCheckResult('S2', 'partial', [
      `Found ${foundContentTypes.length} content enhancement schema type`
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
    allSchemaItems.some((item: any) => item[field])
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
  const foundRichContent = parsed.jsonLd.filter((item: any) => {
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

  // C2: Heading Structure
  let headingScore = 0;
  let maxHeadingScore = 5;
  let headingIssues: string[] = [];
  
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
    const dateModified = allSchemaItems.find((item: any) => item.dateModified)?.dateModified;
    
    if (dateModified) {
      try {
        const modifiedDate = new Date(dateModified);
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
      } catch (error) {
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
  } catch (error) {
    results.push(createCheckResult('R2', 'fail', [
      'Error checking sitemap'
    ]));
  }

  // N1: Brand consistent
  const schemaName = allSchemaItems.find((item: any) => item.name)?.name;
  const brandSources = [parsed.title, parsed.h1, schemaName].filter(Boolean);
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

  // N2: Authoritative Profiles
  const sameAsLinks = allSchemaItems.find((item: any) => item.sameAs)?.sameAs || [];
  
  if (sameAsLinks.length >= 2) {
    results.push(createCheckResult('N2', 'pass', [
      `Found ${sameAsLinks.length} social profile links`,
      `Links: ${sameAsLinks.slice(0, 3).join(', ')}`
    ]));
  } else if (sameAsLinks.length === 1) {
    results.push(createCheckResult('N2', 'partial', [
      `Found ${sameAsLinks.length} social profile link`,
      `Link: ${sameAsLinks[0]}`
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
