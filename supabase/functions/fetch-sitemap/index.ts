import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, search, limit } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Firecrawl not configured. Please connect Firecrawl in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = domain.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Mapping sitemap for:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        search: search || undefined,
        limit: limit || 500,
        includeSubdomains: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract URLs from response
    const urls = data.links || data.data?.links || [];
    
    // Parse URLs to extract path info
    const parsedUrls = urls.map((url: string) => {
      try {
        const urlObj = new URL(url);
        return {
          url: url,
          path: urlObj.pathname,
          // Generate suggested anchor text from path
          suggestedAnchor: urlObj.pathname
            .split('/')
            .filter(Boolean)
            .pop()
            ?.replace(/-/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Home'
        };
      } catch {
        return { url, path: url, suggestedAnchor: url };
      }
    });

    console.log('Sitemap mapped successfully, found', parsedUrls.length, 'URLs');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        urls: parsedUrls,
        total: parsedUrls.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sitemap';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
