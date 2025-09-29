// Comprehensive check information for user display
export interface CheckInfo {
  id: string;
  name: string;
  category: string;
  weight: number;
  description: string;
  whatItChecks: string;
  whyItMatters: string;
  howToPass: string;
  examples?: string[];
}

export const CHECK_INFO: Record<string, CheckInfo> = {
  // Fetchability Checks
  F1: {
    id: 'F1',
    name: 'HTTP 200 Status',
    category: 'Fetchability',
    weight: 6,
    description: 'Confirms the page returns a valid HTTP status code',
    whatItChecks: 'Checks if the page responds with HTTP 200 OK status',
    whyItMatters: 'Search engines and AI systems cannot index pages that return errors (404, 500) or redirects',
    howToPass: 'Ensure your page responds with HTTP 200 OK when accessed directly',
    examples: ['✅ https://example.com/location returns 200', '❌ https://example.com/location returns 404']
  },
  
  F2: {
    id: 'F2',
    name: 'No Index Blocking',
    category: 'Fetchability',
    weight: 4,
    description: 'Ensures the page is not blocked from indexing',
    whatItChecks: 'Looks for meta robots tags that prevent indexing (noindex)',
    whyItMatters: 'Pages with noindex tags are explicitly excluded from search engine indexes and AI training data',
    howToPass: 'Remove any <meta name="robots" content="noindex"> tags or ensure they allow indexing',
    examples: ['✅ <meta name="robots" content="index,follow">', '❌ <meta name="robots" content="noindex">']
  },
  
  F3: {
    id: 'F3',
    name: 'Robots.txt Compliance',
    category: 'Fetchability',
    weight: 4,
    description: 'Checks robots.txt allows crawling and GPTBot access',
    whatItChecks: 'Verifies robots.txt doesn\'t block the page path and allows GPTBot',
    whyItMatters: 'AI systems like ChatGPT use GPTBot to crawl pages. Blocking it prevents AI discovery',
    howToPass: 'Ensure robots.txt allows crawling of your location pages and doesn\'t disallow GPTBot',
    examples: ['✅ User-agent: *\nAllow: /locations/', '❌ User-agent: GPTBot\nDisallow: /']
  },
  
  F4: {
    id: 'F4',
    name: 'Canonical URL',
    category: 'Fetchability',
    weight: 3,
    description: 'Ensures a proper canonical URL is set',
    whatItChecks: 'Looks for a canonical link tag with an absolute URL',
    whyItMatters: 'Canonical URLs help search engines understand the preferred version of a page',
    howToPass: 'Add <link rel="canonical" href="https://yoursite.com/location"> with absolute URL',
    examples: ['✅ <link rel="canonical" href="https://example.com/locations/chicago">', '❌ <link rel="canonical" href="/locations/chicago">']
  },
  
  F5: {
    id: 'F5',
    name: 'JavaScript Rendering Parity',
    category: 'Fetchability',
    weight: 3,
    description: 'Compares content between raw HTML and JavaScript-rendered version',
    whatItChecks: 'Compares H1 and main text content between server-side HTML and client-side rendered HTML',
    whyItMatters: 'AI systems primarily see server-side content. If key information only appears after JavaScript, it may be missed',
    howToPass: 'Ensure important content (business name, address, services) appears in the initial HTML response',
    examples: ['✅ Business name in <h1> tag in raw HTML', '❌ Business name only added via JavaScript']
  },
  
  // Metadata Checks
  M1: {
    id: 'M1',
    name: 'Page Title',
    category: 'Metadata',
    weight: 3,
    description: 'Ensures the page has a title tag',
    whatItChecks: 'Looks for a <title> tag with content',
    whyItMatters: 'Page titles are crucial for search results and AI understanding of page content',
    howToPass: 'Add a descriptive <title> tag to your page',
    examples: ['✅ <title>Starbucks Coffee - Downtown Chicago Location</title>', '❌ <title></title> or missing title']
  },
  
  M2: {
    id: 'M2',
    name: 'Optimized Title',
    category: 'Metadata',
    weight: 3,
    description: 'Title contains both brand and location information',
    whatItChecks: 'Verifies the title includes both the business brand and locality (city/area)',
    whyItMatters: 'Titles with brand and location help AI systems understand the business context and location',
    howToPass: 'Include both your business name and location in the title',
    examples: ['✅ "McDonald\'s - 123 Main St, Chicago, IL"', '❌ "Restaurant" or "Chicago Location"']
  },
  
  M3: {
    id: 'M3',
    name: 'Meta Description',
    category: 'Metadata',
    weight: 3,
    description: 'Ensures the page has a meta description',
    whatItChecks: 'Looks for a meta description tag with content',
    whyItMatters: 'Meta descriptions provide context for search results and help AI understand page content',
    howToPass: 'Add a descriptive meta description tag',
    examples: ['✅ <meta name="description" content="Visit our Chicago location for...">', '❌ Missing meta description']
  },
  
  M4: {
    id: 'M4',
    name: 'Brand & Location in Description',
    category: 'Metadata',
    weight: 4,
    description: 'Meta description contains both brand and location',
    whatItChecks: 'Verifies the meta description includes both business brand and locality',
    whyItMatters: 'Descriptions with brand and location help AI systems understand business context',
    howToPass: 'Include both your business name and location in the meta description',
    examples: ['✅ "Visit Starbucks in downtown Chicago for..."', '❌ "Great coffee and pastries"']
  },
  
  M5: {
    id: 'M5',
    name: 'Open Graph Tags',
    category: 'Metadata',
    weight: 4,
    description: 'Essential Open Graph meta tags for social sharing',
    whatItChecks: 'Looks for og:title, og:description, og:url, and og:image tags',
    whyItMatters: 'Open Graph tags ensure proper display when shared on social media and help AI systems understand content',
    howToPass: 'Add all four essential Open Graph tags',
    examples: ['✅ <meta property="og:title" content="...">', '❌ Missing og:image or og:url']
  },
  
  M6: {
    id: 'M6',
    name: 'Canonical Host Match',
    category: 'Metadata',
    weight: 3,
    description: 'Canonical URL host matches the actual page host',
    whatItChecks: 'Verifies the canonical URL domain matches the current page domain',
    whyItMatters: 'Mismatched canonical hosts can confuse search engines about the preferred page version',
    howToPass: 'Ensure canonical URL uses the same domain as the current page',
    examples: ['✅ Page: example.com, Canonical: example.com', '❌ Page: example.com, Canonical: othersite.com']
  },
  
  // Schema Checks
  S1: {
    id: 'S1',
    name: 'Valid JSON-LD',
    category: 'Schema',
    weight: 5,
    description: 'Page contains valid JSON-LD structured data',
    whatItChecks: 'Looks for valid JSON-LD script tags that can be parsed',
    whyItMatters: 'JSON-LD provides structured information that AI systems can easily understand and use',
    howToPass: 'Add valid JSON-LD script tags with proper syntax',
    examples: ['✅ <script type="application/ld+json">{"@type":"LocalBusiness"...}</script>', '❌ Invalid JSON syntax']
  },
  
  S2: {
    id: 'S2',
    name: 'LocalBusiness Schema',
    category: 'Schema',
    weight: 10,
    description: 'Complete LocalBusiness structured data with essential fields',
    whatItChecks: 'Verifies LocalBusiness schema includes name, url, telephone, address, geo coordinates, and hours',
    whyItMatters: 'LocalBusiness schema provides rich, structured data about your business that AI systems can use for location-based queries',
    howToPass: 'Include all essential LocalBusiness fields in your JSON-LD',
    examples: ['✅ Complete address, phone, hours, and coordinates', '❌ Missing telephone or address fields']
  },
  
  S3: {
    id: 'S3',
    name: 'Organization Schema',
    category: 'Schema',
    weight: 7,
    description: 'Supporting Organization, WebSite, and WebPage schema',
    whatItChecks: 'Looks for Organization, WebSite, and WebPage schema types that complement LocalBusiness',
    whyItMatters: 'Additional schema types provide more context about your business and website structure',
    howToPass: 'Add Organization, WebSite, and WebPage schema alongside LocalBusiness',
    examples: ['✅ Organization schema with logo and sameAs links', '❌ Only LocalBusiness, no Organization context']
  },
  
  S4: {
    id: 'S4',
    name: 'Content Freshness',
    category: 'Schema',
    weight: 3,
    description: 'Meaningful dateModified in schema or visible content',
    whatItChecks: 'Looks for dateModified fields in schema or visible date information',
    whyItMatters: 'Fresh content signals to AI systems that the information is current and relevant',
    howToPass: 'Include dateModified in schema or show visible update dates',
    examples: ['✅ "Last updated: March 2024" or schema dateModified', '❌ No date information anywhere']
  },
  
  // Semantic Content Checks
  C1: {
    id: 'C1',
    name: 'Single H1 with Location',
    category: 'Semantic Content',
    weight: 5,
    description: 'Page has exactly one H1 tag that includes location information',
    whatItChecks: 'Verifies there\'s exactly one H1 tag and it contains locality information',
    whyItMatters: 'H1 tags are the primary heading and help AI systems understand the page\'s main topic and location',
    howToPass: 'Use exactly one H1 tag that includes your location',
    examples: ['✅ <h1>Starbucks Coffee - Downtown Chicago</h1>', '❌ Multiple H1s or H1 without location']
  },
  
  C2: {
    id: 'C2',
    name: 'Heading Structure',
    category: 'Semantic Content',
    weight: 5,
    description: 'Clean, logical heading hierarchy (H2, H3, etc.)',
    whatItChecks: 'Analyzes heading structure for logical hierarchy without jumps',
    whyItMatters: 'Proper heading structure helps AI systems understand content organization and hierarchy',
    howToPass: 'Use H2 for main sections, H3 for subsections, avoid skipping levels',
    examples: ['✅ H1 → H2 → H3 structure', '❌ H1 → H3 (skipping H2)']
  },
  
  C3: {
    id: 'C3',
    name: 'Services in Lists',
    category: 'Semantic Content',
    weight: 3,
    description: 'Services and amenities presented in structured lists or tables',
    whatItChecks: 'Looks for services, amenities, or features presented in list or table format',
    whyItMatters: 'Structured lists make it easier for AI systems to extract and understand service offerings',
    howToPass: 'Present services, amenities, or features in <ul>, <ol>, or <table> elements',
    examples: ['✅ <ul><li>Free WiFi</li><li>Parking</li></ul>', '❌ Services mentioned only in paragraph text']
  },
  
  C4: {
    id: 'C4',
    name: 'Section Anchors',
    category: 'Semantic Content',
    weight: 2,
    description: 'Content sections have anchor links for deep linking',
    whatItChecks: 'Looks for heading elements with id attributes for anchor linking',
    whyItMatters: 'Anchor links enable direct linking to specific sections and help with content navigation',
    howToPass: 'Add id attributes to major headings',
    examples: ['✅ <h2 id="services">Our Services</h2>', '❌ <h2>Our Services</h2> (no id)']
  },
  
  // Freshness Checks
  R1: {
    id: 'R1',
    name: 'Recent Updates',
    category: 'Freshness',
    weight: 4,
    description: 'Content shows recent updates (within 180 days)',
    whatItChecks: 'Looks for visible date information or schema dateModified within 180 days',
    whyItMatters: 'Recent updates signal to AI systems that the information is current and maintained',
    howToPass: 'Show visible update dates or include recent dateModified in schema',
    examples: ['✅ "Updated March 2024" or schema dateModified', '❌ No recent date information']
  },
  
  R2: {
    id: 'R2',
    name: 'Sitemap Freshness',
    category: 'Freshness',
    weight: 6,
    description: 'Sitemap discovered and shows recent lastmod date',
    whatItChecks: 'Finds sitemap and verifies lastmod date for the page is within 180 days',
    whyItMatters: 'Sitemap lastmod dates help search engines understand when content was last updated',
    howToPass: 'Ensure your sitemap includes lastmod dates and update them regularly',
    examples: ['✅ Sitemap with <lastmod>2024-03-15</lastmod>', '❌ No sitemap or old lastmod date']
  },
  
  // Brand Clarity Checks
  N1: {
    id: 'N1',
    name: 'Brand Consistency',
    category: 'Brand Clarity',
    weight: 4,
    description: 'Brand name consistent across title, H1, and schema',
    whatItChecks: 'Verifies the same brand name appears in page title, H1, and schema name',
    whyItMatters: 'Consistent branding helps AI systems understand and recognize your business identity',
    howToPass: 'Use the same brand name in title, H1, and schema',
    examples: ['✅ "Starbucks" in title, H1, and schema', '❌ "Starbucks Coffee" vs "Starbucks" vs "SBUX"']
  },
  
  N2: {
    id: 'N2',
    name: 'Authoritative Profiles',
    category: 'Brand Clarity',
    weight: 3,
    description: 'Links to authoritative business profiles (corporate site, LinkedIn, etc.)',
    whatItChecks: 'Looks for sameAs links to official business profiles and websites',
    whyItMatters: 'Authoritative profile links help AI systems verify business legitimacy and find more information',
    howToPass: 'Include sameAs links to your official website, LinkedIn, and other verified profiles',
    examples: ['✅ sameAs: ["https://starbucks.com", "https://linkedin.com/company/starbucks"]', '❌ No sameAs links']
  },
  
  N3: {
    id: 'N3',
    name: 'Logo Visibility',
    category: 'Brand Clarity',
    weight: 3,
    description: 'Business logo present in both schema and visible on page',
    whatItChecks: 'Verifies logo is included in schema and also visible on the page',
    whyItMatters: 'Visible logos help with brand recognition and provide visual context for AI systems',
    howToPass: 'Include logo in schema and ensure it\'s visible on the page',
    examples: ['✅ Logo in schema + <img src="logo.png" alt="Business Name">', '❌ Logo only in schema or not visible']
  }
};

// Get all checks for a category
export function getChecksForCategory(categoryId: string): CheckInfo[] {
  return Object.values(CHECK_INFO).filter(check => check.category.toLowerCase() === categoryId.toLowerCase());
}

// Get check info by ID
export function getCheckInfo(checkId: string): CheckInfo | undefined {
  return CHECK_INFO[checkId];
}

// Get all categories with their checks
export function getAllCategoriesWithChecks(): Record<string, CheckInfo[]> {
  const categories: Record<string, CheckInfo[]> = {};
  
  Object.values(CHECK_INFO).forEach(check => {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  });
  
  return categories;
}
