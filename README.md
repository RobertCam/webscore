# 🧭 Location Pages Webscore

A lean, deterministic analyzer that scores a URL (0–100) for AI‑search/LLM indexability on **location pages**.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file with:
   ```env
   CF_RENDER_ENDPOINT=https://your-worker.your-subdomain.workers.dev
   CF_RENDER_TOKEN=your-secure-token-here
   ```

3. **Deploy Cloudflare Worker:**
   ```bash
   cd cloudflare
   npm install -g wrangler
   wrangler deploy
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Architecture

- **Frontend:** Next.js 14 with App Router
- **Backend:** Next.js API routes
- **JS Rendering:** Cloudflare Worker with Browser Rendering API
- **HTML Parsing:** Cheerio, @mozilla/readability
- **Scoring:** Deterministic checks based on rubric v2.0

## Scoring Rubric

The analyzer evaluates location pages across 7 categories with a total of 100 points:

| Category | Weight | Description |
|----------|--------|-------------|
| **Fetchability** | 20 pts | Can bots access and index the page? |
| **Metadata** | 20 pts | Title, description, Open Graph tags |
| **Schema** | 25 pts | JSON-LD structured data |
| **Semantic Content** | 15 pts | Headings, content structure |
| **Freshness** | 10 pts | Recent updates, sitemap recency |
| **Brand Clarity** | 13 pts | Consistent branding across elements |
| **Accessibility** | 13 pts | Image alt text, forms, navigation, video accessibility |

### Detailed Check Weights

#### Fetchability (20 pts)
- F1: HTTP 200 (6 pts)
- F2: No noindex meta (4 pts)
- F3: robots.txt not blocking (4 pts)
- F4: Canonical exists & absolute (3 pts)
- F5: JS-render parity (3 pts)

#### Metadata (20 pts)
- M1: Title exists (3 pts)
- M2: Title optimized: brand + locality (3 pts)
- M3: Meta description exists (3 pts)
- M4: Meta description contains brand + locality (4 pts)
- M5: Open Graph basics (4 pts)
- M6: Canonical host matches (3 pts)

#### Schema (25 pts)
- S1: Valid JSON-LD parses (5 pts)
- S2: LocalBusiness essentials (10 pts)
- S3: Org/WebSite/WebPage coherence (7 pts)
- S4: Meaningful dateModified (3 pts)

#### Semantic Content (15 pts)
- C1: H1 exists and unique (4 pts)
- C2: H1 contains locality (4 pts)
- C3: H2-H6 structure (3 pts)
- C4: Main content extraction (4 pts)

#### Freshness (10 pts)
- R1: Sitemap recency (10 pts)

#### Brand Clarity (13 pts)
- N1: Brand consistent (4 pts)
- N2: sameAs to authoritative profiles (3 pts)
- N3: Logo in schema + visible (3 pts)
- N4: Image alt text contains brand/location info (3 pts)

#### Accessibility (13 pts)
- A1: Images have descriptive alt text (3 pts)
- A2: Form labels and structure (2 pts)
- A3: Color contrast and text readability (2 pts)
- A4: Navigation and link structure (2 pts)
- A5: Video accessibility (captions, transcripts) (3 pts)

## API Usage

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/locations/chicago"}'
```

## Deployment

1. Deploy Cloudflare Worker and update `CF_RENDER_ENDPOINT`
2. Deploy to Vercel with environment variables
3. Test with real location page URLs