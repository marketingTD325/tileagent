import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Page type detection for tegeldepot.nl URL patterns
type PageType = 'homepage' | 'category' | 'filter' | 'product' | 'other';

function detectPageType(url: string): PageType {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // 1. Homepage
    if (path === '/' || path === '') {
      return 'homepage';
    }
    
    // 2. Filter Pages - contain filter patterns like /filter/, /radiator-breedte-reeks/, /kleur/, /merk/
    const filterPatterns = [
      /\/filter\//i,
      /\/radiator-breedte-reeks\//i,
      /\/radiator-hoogte-reeks\//i,
      /\/kleur\//i,
      /\/merk\//i,
      /\/afmeting\//i,
      /\/materiaal\//i,
      /---to--/i,  // Range filter pattern like "40---to--50-cm"
    ];
    
    if (filterPatterns.some(pattern => pattern.test(path))) {
      return 'filter';
    }
    
    // 3. Product Pages - long slugs with dimensions/specs patterns
    const productPatterns = [
      /\d+x\d+/i,           // Dimensions like 124x71
      /\d+x\d+x\d+/i,       // 3D dimensions like 124x71x42
      /-cm$/i,              // Ends with -cm
      /-mm$/i,              // Ends with -mm
      /-wit$/i,             // Color suffix
      /-zwart$/i,
      /-grijs$/i,
      /-liter$/i,           // Volume
      /-watt$/i,            // Power
    ];
    
    const segments = path.split('/').filter(s => s.length > 0);
    const lastSegment = segments[segments.length - 1] || '';
    
    // Product pages typically have long slugs with specs
    if (lastSegment.length > 30 && productPatterns.some(p => p.test(lastSegment))) {
      return 'product';
    }
    
    // Also check for specific product indicators in the last segment
    if (lastSegment.includes('-') && (
      /\d{2,}/.test(lastSegment) || // Contains 2+ digit numbers
      productPatterns.some(p => p.test(lastSegment))
    )) {
      // Additional check: products tend to have many hyphens (more than 4)
      const hyphenCount = (lastSegment.match(/-/g) || []).length;
      if (hyphenCount > 4) {
        return 'product';
      }
    }
    
    // 4. Category Pages - 1-4 segments, typically category hierarchy
    // Examples: /bad, /bad/whirlpool-bad, /bad/whirlpool-bad/bubbelbad
    if (segments.length >= 1 && segments.length <= 4) {
      // Category slugs are shorter and don't have product specs
      const hasNoProductSpecs = !productPatterns.some(p => p.test(path));
      if (hasNoProductSpecs) {
        return 'category';
      }
    }
    
    return 'other';
  } catch (error) {
    console.error('Error detecting page type:', error);
    return 'other';
  }
}

// Get page type-specific SEO requirements
function getPageTypeRequirements(pageType: PageType): {
  minWordCount: number;
  maxWordCount: number;
  requiredSchema: string[];
  recommendedSchema: string[];
  minInternalLinks: number;
  requiresFaq: boolean;
} {
  switch (pageType) {
    case 'homepage':
      return {
        minWordCount: 300,
        maxWordCount: 800,
        requiredSchema: ['Organization', 'WebSite'],
        recommendedSchema: ['BreadcrumbList'],
        minInternalLinks: 10,
        requiresFaq: false,
      };
    case 'category':
      return {
        minWordCount: 700,
        maxWordCount: 1000,
        requiredSchema: ['BreadcrumbList'],
        recommendedSchema: ['FAQPage', 'ItemList'],
        minInternalLinks: 5,
        requiresFaq: true,
      };
    case 'filter':
      return {
        minWordCount: 200,
        maxWordCount: 400,
        requiredSchema: ['BreadcrumbList'],
        recommendedSchema: ['ItemList'],
        minInternalLinks: 3,
        requiresFaq: false,
      };
    case 'product':
      return {
        minWordCount: 150,
        maxWordCount: 300,
        requiredSchema: ['Product', 'Offer'],
        recommendedSchema: ['BreadcrumbList', 'Review'],
        minInternalLinks: 2,
        requiresFaq: false,
      };
    default:
      return {
        minWordCount: 300,
        maxWordCount: 800,
        requiredSchema: [],
        recommendedSchema: ['BreadcrumbList'],
        minInternalLinks: 3,
        requiresFaq: false,
      };
  }
}

// Robust metadata extraction using cheerio with priority chains
// Priority: HTML tags -> OG tags -> Firecrawl metadata object
function extractMetadataRobust(html: string, firecrawlMetadata?: any): { 
  title: string; 
  description: string | null;
  titleSource: 'title-tag' | 'og:title' | 'firecrawl' | 'none';
  descriptionSource: 'meta-name' | 'og:description' | 'firecrawl' | 'none';
} {
  const $ = cheerio.load(html);
  
  // 1. Robust Title Extraction (Priority: Title Tag -> OG Title -> Firecrawl Metadata)
  const titleFromTag = $('title').text().trim();
  const titleFromOg = $('meta[property="og:title"]').attr('content')?.trim();
  const titleFromFirecrawl = firecrawlMetadata?.title?.trim();
  
  let title = '';
  let titleSource: 'title-tag' | 'og:title' | 'firecrawl' | 'none' = 'none';
  
  if (titleFromTag) {
    title = titleFromTag;
    titleSource = 'title-tag';
  } else if (titleFromOg) {
    title = titleFromOg;
    titleSource = 'og:title';
  } else if (titleFromFirecrawl) {
    title = titleFromFirecrawl;
    titleSource = 'firecrawl';
  }
  
  // 2. Robust Description Extraction (Priority: Meta Name -> OG Description -> Firecrawl Metadata)
  // IMPORTANT: Never fall back to body text - only use proper meta tags
  const metaDesc = $('meta[name="description"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  const firecrawlDesc = firecrawlMetadata?.description?.trim();
  
  let description: string | null = null;
  let descriptionSource: 'meta-name' | 'og:description' | 'firecrawl' | 'none' = 'none';
  
  if (metaDesc) {
    description = metaDesc;
    descriptionSource = 'meta-name';
  } else if (ogDesc) {
    description = ogDesc;
    descriptionSource = 'og:description';
  } else if (firecrawlDesc) {
    description = firecrawlDesc;
    descriptionSource = 'firecrawl';
  }
  
  // 3. Log results for debugging
  console.log('Extracted Metadata:', { 
    title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
    titleSource,
    descriptionFound: !!description,
    descriptionSource,
    descriptionLength: description?.length || 0 
  });
  
  return { title, description, titleSource, descriptionSource };
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

// Extract images missing alt tags with improved detection
function extractImageIssues($: cheerio.CheerioAPI): Array<{ src: string; alt: string | null; issue: string }> {
  const imageIssues: Array<{ src: string; alt: string | null; issue: string }> = [];
  
  // Generic/useless alt text patterns
  const genericAltPatterns = [
    /^image$/i,
    /^photo$/i,
    /^picture$/i,
    /^img$/i,
    /^afbeelding$/i,
    /^foto$/i,
    /^\d+$/,  // Just numbers
    /^untitled$/i,
    /^placeholder$/i,
    /^dsc\d+$/i,  // Camera filenames like DSC1234
    /^img_?\d+$/i,  // Camera filenames like IMG_1234
  ];
  
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    // Check multiple lazy-loading patterns
    const src = $(el).attr('src') 
      || $(el).attr('data-src') 
      || $(el).attr('data-lazy-src')
      || $(el).attr('data-original')
      || $(el).attr('data-lazy')
      || 'unknown';
    
    // Extract just the filename from the src for cleaner display
    const filename = src.split('/').pop()?.split('?')[0] || src;
    
    // Case 1: Alt is completely missing or empty
    if (!alt || alt.trim() === '') {
      imageIssues.push({ src: filename, alt: null, issue: 'missing' });
      return;
    }
    
    // Case 2: Alt is generic/useless text
    const altTrimmed = alt.trim();
    for (const pattern of genericAltPatterns) {
      if (pattern.test(altTrimmed)) {
        imageIssues.push({ src: filename, alt: altTrimmed, issue: 'generic' });
        return;
      }
    }
  });
  
  console.log(`Found ${imageIssues.length} images with alt issues (missing or generic)`);
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
  h1Text: string | null;  // NEW: Extract H1 text for keyword analysis
  contentTruncated: boolean;
  originalWordCount: number;
} {
  // Count headings using Cheerio for accuracy
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const h4Count = $('h4').length;
  const h5Count = $('h5').length;
  const h6Count = $('h6').length;

  // NEW: Extract H1 text for keyword analysis
  const h1Text = $('h1').first().text().trim() || null;

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
  const originalWordCount = wordCount;
  
  // Content truncation flag (will be set by analyze function)
  const contentTruncated = false;

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
    avgSentenceLength,
    h1Text,
    contentTruncated,
    originalWordCount
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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
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

    // Detect page type for type-specific analysis
    const pageType = detectPageType(formattedUrl);
    const pageTypeRequirements = getPageTypeRequirements(pageType);

    const result = {
      url: formattedUrl,
      markdown: markdown,
      html: html,
      links: scrapedData.links || [],
      metadata: {
        title: metadata.title,
        description: metadata.description, // Can be null if not found - NO FALLBACK
        titleSource: metadata.titleSource,
        descriptionSource: metadata.descriptionSource,
        ogImage: scrapedData.metadata?.ogImage || null,
        ogTitle: scrapedData.metadata?.ogTitle || null,
      },
      linkAnalysis,
      contentMetrics,
      imageIssues,
      schemaTypes,
      // NEW: Page type detection for type-specific scoring
      pageType,
      pageTypeRequirements
    };

    console.log('Scrape successful for:', formattedUrl, {
      pageType,
      title: metadata.title.substring(0, 30),
      titleSource: metadata.titleSource,
      metaDescFound: !!metadata.description,
      descriptionSource: metadata.descriptionSource,
      h1Text: contentMetrics.h1Text?.substring(0, 30) || 'none',
      linkCount: linkAnalysis.total,
      wordCount: contentMetrics.wordCount,
      imageIssuesCount: imageIssues.length,
      schemaTypesCount: schemaTypes.length,
      requirements: pageTypeRequirements
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
