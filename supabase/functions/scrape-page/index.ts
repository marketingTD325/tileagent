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

// Extract and categorize ALL links from entire HTML (including footer/ABC)
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
    
    // Get ALL links from entire DOM - global selector, not restricted to main/article
    const linkMatches = html.match(/<a[^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi) || [];
    const allLinks = linkMatches.map(link => {
      const hrefMatch = link.match(/href=["']([^"'#][^"']*)["']/i);
      return hrefMatch ? hrefMatch[1] : '';
    }).filter(href => href.length > 0 && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:'));

    // Count internal vs external for ALL links
    let internal = 0;
    let external = 0;
    
    for (const href of allLinks) {
      try {
        if (href.startsWith('/')) {
          internal++;
        } else if (href.startsWith('http')) {
          const linkHost = new URL(href).hostname;
          if (linkHost === hostname || linkHost.endsWith('.' + hostname) || hostname.endsWith('.' + linkHost)) {
            internal++;
          } else {
            external++;
          }
        } else {
          internal++; // relative links without leading slash
        }
      } catch {
        internal++; // malformed URLs are likely internal
      }
    }

    // Detect footer links - search for common footer containers
    const footerPatterns = [
      /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
      /<div[^>]*(class|id)=["'][^"']*(footer|foot-nav|site-footer)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ];
    
    let footerLinks = 0;
    for (const pattern of footerPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const footerHtml = match[0];
        footerLinks += (footerHtml.match(/<a\s[^>]*href/gi) || []).length;
      }
    }

    // Detect ABC-index / alphabet / sitemap / brands-list links (common in Magento/Tweakwise)
    const abcPatterns = [
      /<[^>]*(class|id)=["'][^"']*(alphabet|abc-index|a-z-index|sitemap-alpha|letter-nav|brands-list|brand-list|merken-list)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z]+>/gi,
      /<nav[^>]*(class|id)=["'][^"']*(alphabet|a-z|brand)[^"']*["'][^>]*>([\s\S]*?)<\/nav>/gi,
      /<ul[^>]*(class|id)=["'][^"']*(alphabet|sitemap|brand-index)[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi,
    ];
    
    let abcIndexLinks = 0;
    for (const pattern of abcPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const abcHtml = match[0];
        abcIndexLinks += (abcHtml.match(/<a\s[^>]*href/gi) || []).length;
      }
    }

    // Content links = total internal links minus footer and ABC (for SEO scoring)
    // But report the full internal count as well
    const contentLinks = Math.max(0, internal - footerLinks - abcIndexLinks);

    console.log(`Link analysis: total=${allLinks.length}, internal=${internal}, external=${external}, footer=${footerLinks}, abc=${abcIndexLinks}, content=${contentLinks}`);

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
    
    // Extract metadata using robust cheerio-based extraction with priority chain
    const metadata = extractMetadataRobust(html, scrapedData.metadata);
    
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
        title: metadata.title,
        description: metadata.description, // Can be null if not found - NO FALLBACK
        ogImage: scrapedData.metadata?.ogImage || null,
        ogTitle: scrapedData.metadata?.ogTitle || null,
      },
      linkAnalysis,
      contentMetrics
    };

    console.log('Scrape successful for:', formattedUrl, {
      title: metadata.title.substring(0, 30),
      metaDescFound: !!metadata.description,
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
