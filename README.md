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
   CF_RENDER_ENDPOINT=https://your-worker.your-subdomain.workers.dev/?url=
   CF_RENDER_TOKEN=your-secure-token-here
   NEXT_PUBLIC_PHASE=1
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

## Phases

- **Phase 0:** Skeleton & UI
- **Phase 1:** MVP (F1, F2, F5, M1, M4, S1, S2 subset, C1, N1)
- **Phase 2:** Core completeness
- **Phase 3:** Polish & DX

## Scoring Categories

1. **Fetchability (20 pts)** - Can bots access and index the page?
2. **Metadata (20 pts)** - Title, description, Open Graph tags
3. **Schema (25 pts)** - JSON-LD structured data
4. **Semantic Content (15 pts)** - Headings, content structure
5. **Freshness (10 pts)** - Recent updates, sitemap recency
6. **Brand Clarity (10 pts)** - Consistent branding across elements

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