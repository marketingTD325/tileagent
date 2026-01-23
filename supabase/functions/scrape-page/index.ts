import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Robust metadata extraction using cheerio with priority chains
// Priority: HTML tags -> OG tags -> Firecrawl metadata object
function extractMetadataRobust(html: string, firecrawlMetadata?: any): { title: string; description: string | null } {
  const $ = cheerio.load(html);
  
  // 1. Robust Title Extraction (Priority: Title Tag -> OG Title -> Firecrawl Metadata)
  const title = $('title').text().trim() || 
                $('meta[property="og:title"]').attr('content')?.trim() || 
                firecrawlMetadata?.title?.trim() || 
                '';
  
  // 2. Robust Description Extraction (Priority: Meta Name -> OG Description -> Firecrawl Metadata)
  // IMPORTANT: Never fall back to body text - only use proper meta tags
  const metaDesc = $('meta[name="description"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  const firecrawlDesc = firecrawlMetadata?.description?.trim();
  
  // Use first available, but return null if none found (strict mode)
  const description = metaDesc || ogDesc || firecrawlDesc || null;
  
  // 3. Log results for debugging
  console.log('Extracted Metadata:', { 
    title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
    titleSource: metaDesc ? 'title-tag' : ($('meta[property="og:title"]').attr('content') ? 'og:title' : 'firecrawl'),
    descriptionFound: !!description,
    descriptionSource: metaDesc ? 'meta-name' : (ogDesc ? 'og:description' : (firecrawlDesc ? 'firecrawl' : 'none')),
    descriptionLength: description?.length || 0 
  });
  
  return { title, description };
}

// Extract and categorize ALL links using Cheerio for accurate HTML parsing
function analyzeLinkStructure($: cheerio.CheerioAPI, baseUrl: string): {
  total: number;
  internal: number;
  external: number;
  footerLinks: number;
  abcIndexLinks: number;
  contentLinks: number;
} {
  try {
    const hostname = new URL(baseUrl).hostname;
    
    // Helper to check if link is internal
    const isInternalLink = (href: string): boolean => {
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
        return false;
      }
      try {
        if (href.startsWith('/') || !href.startsWith('http')) {
          return true; // Relative links are internal
        }
        const linkHost = new URL(href).hostname;
        return linkHost === hostname || linkHost.endsWith('.' + hostname) || hostname.endsWith('.' + linkHost);
      } catch {
        return true; // Malformed URLs are likely internal
      }
    };
    
    // Get ALL links from the page using Cheerio
    const allLinks = $('a[href]').toArray();
    let internal = 0;
    let external = 0;
    
    // 1. Count footer links using comprehensive selectors
    const footerSelectors = [
      'footer a[href]',
      '.footer a[href]',
      '#footer a[href]',
      '.site-footer a[href]',
      '#site-footer a[href]',
      '.foot-nav a[href]',
      '[class*="footer"] a[href]',
      '[id*="footer"] a[href]'
    ].join(', ');
    
    const footerLinks = $(footerSelectors).length;
    
    // 2. Count ABC-index / alphabet / brands-list links
    const abcSelectors = [
      '.alphabet a[href]',
      '#alphabet a[href]',
      '.abc-index a[href]',
      '.a-z-index a[href]',
      '.sitemap-alpha a[href]',
      '.letter-nav a[href]',
      '.brands-list a[href]',
      '.brand-list a[href]',
      '.merken-list a[href]',
      '.brand-index a[href]',
      '[class*="alphabet"] a[href]',
      '[class*="brands"] a[href]',
      'nav.alphabet a[href]',
      'nav.brand a[href]',
      'ul.alphabet a[href]',
      'ul.sitemap a[href]',
      'ul.brand-index a[href]'
    ].join(', ');
    
    const abcIndexLinks = $(abcSelectors).length;
    
    // 3. Count all links and categorize internal/external
    for (const el of allLinks) {
      const href = $(el).attr('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') {
        continue;
      }
      
      if (isInternalLink(href)) {
        internal++;
      } else if (href.startsWith('http')) {
        external++;
      }
    }
    
    // Content links = internal links minus footer and ABC (for SEO scoring)
    const contentLinks = Math.max(0, internal - footerLinks - abcIndexLinks);
    const total = internal + external;

    console.log(`Link analysis (Cheerio): total=${total}, internal=${internal}, external=${external}, footer=${footerLinks}, abc=${abcIndexLinks}, content=${contentLinks}`);

    return {
      total,
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

// Extract images missing alt tags
function extractImageIssues($: cheerio.CheerioAPI): Array<{ src: string; alt: string | null }> {
  const imageIssues: Array<{ src: string; alt: string | null }> = [];
  
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || $(el).attr('data-src') || 'unknown';
    
    // Flag if alt is missing, empty, or just whitespace
    if (!alt || alt.trim() === '') {
      // Extract just the filename from the src for cleaner display
      const filename = src.split('/').pop()?.split('?')[0] || src;
      imageIssues.push({ src: filename, alt: alt || null });
    }
  });
  
  console.log(`Found ${imageIssues.length} images without proper alt tags`);
  return imageIssues;
}

// Extract JSON-LD schema types
function extractSchemaTypes($: cheerio.CheerioAPI): string[] {
  const schemaTypes: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const json = JSON.parse(content);
        
        // Handle single object or array
        const items = Array.isArray(json) ? json : [json];
        
        for (const item of items) {
          if (item['@type']) {
            // Handle array of types or single type
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            types.forEach((t: string) => {
              if (!schemaTypes.includes(t)) {
                schemaTypes.push(t);
              }
            });
          }
          
          // Also check @graph for nested schemas (common pattern)
          if (item['@graph'] && Array.isArray(item['@graph'])) {
            for (const graphItem of item['@graph']) {
              if (graphItem['@type']) {
                const types = Array.isArray(graphItem['@type']) ? graphItem['@type'] : [graphItem['@type']];
                types.forEach((t: string) => {
                  if (!schemaTypes.includes(t)) {
                    schemaTypes.push(t);
                  }
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('Error parsing JSON-LD schema:', e);
    }
  });
  
  console.log(`Found ${schemaTypes.length} schema types:`, schemaTypes);
  return schemaTypes;
}

// Extract content quality metrics using Cheerio for headings
function extractContentMetrics($: cheerio.CheerioAPI, markdown: string): {
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
  // Count headings using Cheerio for accuracy
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const h4Count = $('h4').length;
  const h5Count = $('h5').length;
  const h6Count = $('h6').length;

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
    
    // Load Cheerio once and reuse for all parsing
    const $ = cheerio.load(html);
    
    // Extract metadata using robust cheerio-based extraction with priority chain
    const metadata = extractMetadataRobust(html, scrapedData.metadata);
    
    // Analyze link structure using Cheerio (not regex)
    const linkAnalysis = analyzeLinkStructure($, formattedUrl);
    
    // Extract content metrics using Cheerio
    const contentMetrics = extractContentMetrics($, markdown);
    
    // Extract images without alt tags (actionable data)
    const imageIssues = extractImageIssues($);
    
    // Extract JSON-LD schema types
    const schemaTypes = extractSchemaTypes($);

    const result = {
      url: formattedUrl,
      markdown: markdown,
      html: html,
      links: scrapedData.links || [],
      metadata: {
        title: metadata.title,
        description: metadata.description, // Can be null if not found - NO FALLBACK
        ogImage: scrapedData.metadata?.ogImage || null,
        ogTitle: scrapedData.metadata?.ogTitle || null,
      },
      linkAnalysis,
      contentMetrics,
      imageIssues,
      schemaTypes
    };

    console.log('Scrape successful for:', formattedUrl, {
      title: metadata.title.substring(0, 30),
      metaDescFound: !!metadata.description,
      linkCount: linkAnalysis.total,
      wordCount: contentMetrics.wordCount,
      imageIssuesCount: imageIssues.length,
      schemaTypesCount: schemaTypes.length
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
