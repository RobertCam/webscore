import * as cheerio from 'cheerio';
import { DetectedFacts } from '@/types/scorecard';

// Parse HTML and extract basic metadata
export interface ParsedHTML {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
  h1?: string;
  h1s: string[];
  headings: { level: number; text: string; id?: string }[];
  images: { src: string; alt?: string }[];
  links: { href: string; text: string }[];
  jsonLd: any[];
  mainText?: string;
}

export function parseHTML(html: string): ParsedHTML {
  const $ = cheerio.load(html);
  
  // Basic metadata
  const title = $('title').text().trim() || undefined;
  const description = $('meta[name="description"]').attr('content')?.trim() || undefined;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || undefined;
  const noindex = $('meta[name="robots"]').attr('content')?.toLowerCase().includes('noindex') || false;

  // Open Graph
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || undefined;
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || undefined;
  const ogUrl = $('meta[property="og:url"]').attr('content')?.trim() || undefined;
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || undefined;

  // Headings
  const h1s: string[] = [];
  const headings: { level: number; text: string; id?: string }[] = [];
  
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const level = parseInt(el.tagName.substring(1));
    const id = $el.attr('id');
    
    if (level === 1) {
      h1s.push(text);
    }
    
    headings.push({ level, text, id });
  });

  const h1 = h1s[0] || undefined;

  // Images
  const images: { src: string; alt?: string }[] = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    const alt = $el.attr('alt');
    if (src) {
      images.push({ src, alt });
    }
  });

  // Links
  const links: { href: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const text = $el.text().trim();
    if (href && text) {
      links.push({ href, text });
    }
  });

  // JSON-LD
  const jsonLd: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else {
          jsonLd.push(parsed);
        }
      }
    } catch (error) {
      // Invalid JSON-LD, skip
    }
  });

  // Extract main text content (simplified)
  const mainText = extractMainText($);

  return {
    title,
    description,
    canonical,
    noindex,
    ogTitle,
    ogDescription,
    ogUrl,
    ogImage,
    h1,
    h1s,
    headings,
    images,
    links,
    jsonLd,
    mainText,
  };
}

// Extract main text content using a simple approach
function extractMainText($: cheerio.CheerioAPI): string {
  // Remove script and style elements
  $('script, style, nav, header, footer, aside').remove();
  
  // Get text from main content areas
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main'
  ];
  
  let mainContent = '';
  for (const selector of mainSelectors) {
    const content = $(selector).text();
    if (content && content.length > mainContent.length) {
      mainContent = content;
    }
  }
  
  // Fallback to body if no main content found
  if (!mainContent) {
    mainContent = $('body').text();
  }
  
  // Clean up whitespace
  return mainContent.replace(/\s+/g, ' ').trim();
}

// Extract facts from parsed content
export function extractFacts(parsed: ParsedHTML): DetectedFacts {
  const facts: DetectedFacts = {};
  
  // Try to extract brand from title, h1, or schema
  const brandSources = [
    parsed.title,
    parsed.h1,
    ...parsed.jsonLd.map(item => item.name || item['@type'])
  ].filter(Boolean);
  
  // Simple brand extraction (first word or common patterns)
  for (const source of brandSources) {
    if (source && typeof source === 'string') {
      const words = source.split(' ');
      if (words.length > 0) {
        facts.brand = words[0];
        break;
      }
    }
  }
  
  // Try to extract locality from title, h1, or schema
  const localitySources = [
    parsed.title,
    parsed.h1,
    ...parsed.jsonLd.map(item => item.address?.locality || item.address?.addressLocality)
  ].filter(Boolean);
  
  // Simple locality extraction (look for common patterns)
  for (const source of localitySources) {
    if (source && typeof source === 'string') {
      // Look for patterns like "in City", "City, State", etc.
      const localityMatch = source.match(/\b(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
      if (localityMatch) {
        facts.locality = localityMatch[2];
        break;
      }
      
      // Look for comma-separated patterns
      const commaMatch = source.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/);
      if (commaMatch) {
        facts.locality = commaMatch[1];
        break;
      }
    }
  }
  
  // Extract address and geo from JSON-LD
  for (const item of parsed.jsonLd) {
    if (item.address) {
      facts.address = {
        street: item.address.streetAddress,
        locality: item.address.addressLocality,
        region: item.address.addressRegion,
        postal: item.address.postalCode,
        country: item.address.addressCountry,
      };
    }
    
    if (item.geo) {
      facts.geo = {
        lat: parseFloat(item.geo.latitude),
        lon: parseFloat(item.geo.longitude),
      };
    }
  }
  
  return facts;
}
