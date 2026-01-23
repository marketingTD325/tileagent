import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract meta description with multiple patterns - NO fallback to body text
function extractMetaDescription(html: string): string | null {
  const patterns = [
    // Standard: <meta name="description" content="...">
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    // Reversed: <meta content="..." name="description">
    /<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']description["']/i,
    // With property instead of name (less common)
    /<meta[^>]*property=["']description["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]*content=["']([^"']*?)["'][^>]*property=["']description["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      const desc = match[1].trim();
      // Filter out obvious non-meta-description content
      const invalidPatterns = [
        /winkelwagen/i,
        /cart/i,
        /login/i,
        /cookie/i,
        /javascript/i,
      ];
      
      const isValid = !invalidPatterns.some(p => p.test(desc));
      if (isValid && desc.length >= 20) { // Meta descriptions should be at least 20 chars
        return desc;
      }
    }
  }
  
  return null; // CRITICAL: Return null, NOT body text fallback
}

// Extract and categorize links from HTML
function analyzeLinkStructure(html: string, baseUrl: string): {
  total: number;
  internal: number;
  external: number;
  footerLinks: number;
  abcIndexLinks: number;
  contentLinks: number;
} {
  try {
    const hostname = new URL(baseUrl).hostname;
    
    // Get all links
    const linkMatches = html.match(/<a[^>]*href=["']([^"'#]*)["'][^>]*>/gi) || [];
    const allLinks = linkMatches.map(link => {
      const hrefMatch = link.match(/href=["']([^"'#]*)["']/i);
      return hrefMatch ? hrefMatch[1] : '';
    }).filter(href => href.length > 0);

    // Count internal vs external
    let internal = 0;
    let external = 0;
    
    for (const href of allLinks) {
      try {
        if (href.startsWith('/') || href.startsWith('#')) {
          internal++;
        } else if (href.startsWith('http')) {
          const linkHost = new URL(href).hostname;
          if (linkHost === hostname || linkHost.endsWith('.' + hostname)) {
            internal++;
          } else {
            external++;
          }
        } else {
          internal++; // relative links
        }
      } catch {
        internal++; // malformed URLs are likely internal
      }
    }

    // Detect footer links
    const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
    const footerLinks = footerMatch 
      ? (footerMatch[1].match(/<a\s/gi) || []).length 
      : 0;

    // Detect ABC-index / alphabet links (common in Magento/Tweakwise)
    const abcPatterns = [
      /<[^>]*(class|id)=["'][^"']*(alphabet|abc-index|a-z-index|sitemap-alpha|letter-nav)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/gi,
      /<div[^>]*class=["'][^"']*index[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ];
    
    let abcIndexLinks = 0;
    for (const pattern of abcPatterns) {
      const matches = html.match(pattern) || [];
      for (const match of matches) {
        abcIndexLinks += (match.match(/<a\s/gi) || []).length;
      }
    }

    // Content links = total - footer - abc (approximate)
    const contentLinks = Math.max(0, allLinks.length - footerLinks - abcIndexLinks);

    return {
      total: allLinks.length,
      internal,
      external,
      footerLinks,
      abcIndexLinks,
      contentLinks
    };
  } catch (error) {
    console.error('Error analyzing links:', error);
    return {
      total: 0,
      internal: 0,
      external: 0,
      footerLinks: 0,
      abcIndexLinks: 0,
      contentLinks: 0
    };
  }
}

// Extract content quality metrics from HTML
function extractContentMetrics(html: string, markdown: string): {
  wordCount: number;
  paragraphCount: number;
  avgParagraphLength: number;
  headingStructure: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  sentenceCount: number;
  avgSentenceLength: number;
} {
  // Count headings from HTML for accuracy
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
  const h4Count = (html.match(/<h4[^>]*>/gi) || []).length;
  const h5Count = (html.match(/<h5[^>]*>/gi) || []).length;
  const h6Count = (html.match(/<h6[^>]*>/gi) || []).length;

  // Use markdown for text analysis (cleaner)
  const cleanText = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Remove markdown links, keep text
    .replace(/[#*_`~]/g, '') // Remove markdown formatting
    .replace(/\n{2,}/g, '\n\n') // Normalize paragraph breaks
    .trim();

  // Count paragraphs (separated by double newlines)
  const paragraphs = cleanText.split(/\n\n+/).filter(p => p.trim().length > 20);
  const paragraphCount = paragraphs.length;

  // Word count
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Avg paragraph length
  const avgParagraphLength = paragraphCount > 0 
    ? Math.round(wordCount / paragraphCount) 
    : 0;

  // Sentence analysis
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 
    ? Math.round(wordCount / sentenceCount) 
    : 0;

  return {
    wordCount,
    paragraphCount,
    avgParagraphLength,
    headingStructure: {
      h1: h1Count,
      h2: h2Count,
      h3: h3Count,
      h4: h4Count,
      h5: h5Count,
      h6: h6Count,
    },
    sentenceCount,
    avgSentenceLength
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Scraping service not configured. Please connect Firecrawl in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false, // Get full page for SEO analysis
        waitFor: 2000,
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

    // Extract relevant SEO data from the scraped content
    const scrapedData = data.data || data;
    
    const html = scrapedData.html || '';
    const markdown = scrapedData.markdown || '';
    
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : (scrapedData.metadata?.title || '');
    
    // Extract meta description - NO FALLBACK TO BODY TEXT
    const metaDescription = extractMetaDescription(html);
    
    // Analyze link structure
    const linkAnalysis = analyzeLinkStructure(html, formattedUrl);
    
    // Extract content metrics
    const contentMetrics = extractContentMetrics(html, markdown);

    const result = {
      url: formattedUrl,
      markdown: markdown,
      html: html,
      links: scrapedData.links || [],
      metadata: {
        title: title,
        description: metaDescription, // Can be null if not found
        ogImage: scrapedData.metadata?.ogImage || null,
        ogTitle: scrapedData.metadata?.ogTitle || null,
      },
      linkAnalysis,
      contentMetrics
    };

    console.log('Scrape successful for:', formattedUrl, {
      metaDescFound: !!metaDescription,
      linkCount: linkAnalysis.total,
      wordCount: contentMetrics.wordCount
    });
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
