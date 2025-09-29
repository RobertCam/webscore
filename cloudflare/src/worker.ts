export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-render-token',
        },
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Extract URL from query parameter
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get('url');
      
      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      // Validate URL
      let parsedTargetUrl: URL;
      try {
        parsedTargetUrl = new URL(targetUrl);
      } catch {
        return new Response('Invalid URL format', { status: 400 });
      }

      // Check authentication token if provided
      const authToken = request.headers.get('x-render-token');
      const expectedToken = env.RENDER_TOKEN;
      
      if (expectedToken && authToken !== expectedToken) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Use Cloudflare Browser Rendering API
      const browser = await env.BROWSER.launch();
      const page = await browser.newPage();

      try {
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (compatible; WebpageScoreBot/1.0; +https://webpagescore.com/bot)');

        // Navigate to the page
        const response = await page.goto(targetUrl, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        if (!response) {
          throw new Error('Failed to load page');
        }

        // Get the final URL after redirects
        const finalUrl = page.url();

        // Wait a bit more for any dynamic content
        await page.waitForTimeout(2000);

        // Get the rendered HTML
        const html = await page.content();

        // Close the page
        await page.close();

        // Return the result
        return new Response(JSON.stringify({
          finalUrl,
          html,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });

      } finally {
        await browser.close();
      }

    } catch (error) {
      console.error('Render error:', error);
      
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
