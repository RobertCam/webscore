import { RenderResponse } from '@/types/scorecard';

// Raw HTML fetcher (no JS rendering)
export async function fetchRaw(url: string): Promise<{
  html: string;
  finalUrl: string;
  status: number;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebpageScoreBot/1.0; +https://webpagescore.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const html = await response.text();
    const finalUrl = response.url;

    return {
      html,
      finalUrl,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout for ${url} (10s limit)`);
    }
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Cloudflare Worker client for JS rendering
export async function renderRemotely(url: string): Promise<RenderResponse> {
  const endpoint = process.env.CF_RENDER_ENDPOINT;
  const token = process.env.CF_RENDER_TOKEN;

  if (!endpoint) {
    throw new Error('CF_RENDER_ENDPOINT environment variable not set');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['x-render-token'] = token;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for JS rendering
    
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Render failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.finalUrl || !data.html) {
      throw new Error('Invalid response from render service');
    }

    return {
      finalUrl: data.finalUrl,
      html: data.html
    } as RenderResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`JS rendering timeout for ${url} (15s limit)`);
    }
    throw new Error(`Failed to render ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
