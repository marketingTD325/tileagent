const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PageData {
  url: string;
  title?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    ogImage?: string;
  };
}

interface AnalysisResult {
  visibilityScore: number;
  strengths: string[];
  weaknesses: string[];
  topKeywords: Array<{ keyword: string; estimatedPosition: number; searchVolume: number; difficulty: string }>;
  contentGaps: Array<{ topic: string; opportunity: string; description: string; suggestedAction: string }>;
  keywordOverlap: Array<{ keyword: string; competitorPosition: number; ourEstimatedPosition: number }>;
  recommendations: Array<{ action: string; priority: string; impact: string; effort: string }>;
  analysisData: {
    estimatedMonthlyTraffic: number;
    estimatedKeywordCount: number;
    contentQualityScore: number;
    technicalSeoScore: number;
    mobileScore: number;
    pageSpeedIndicator: string;
    contentFreshness: string;
    domainAuthority: number;
    totalPages: number;
    avgContentLength: number;
  };
  technicalSeo: {
    hasHttps: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    metaDescriptions: number;
    h1Tags: number;
    imageAltTags: string;
    structuredData: boolean;
    canonicalTags: boolean;
  };
  contentStrategy: {
    blogPresent: boolean;
    productCategories: string[];
    contentTypes: string[];
    updateFrequency: string;
    avgWordCount: number;
    uniqueSellingPoints: string[];
  };
  competitivePosition: {
    marketPosition: string;
    pricePositioning: string;
    targetAudience: string;
    geographicFocus: string;
    brandStrength: string;
  };
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<PageData | null> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping with Firecrawl:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      url: formattedUrl,
      title: data.data?.metadata?.title || '',
      markdown: data.data?.markdown || '',
      metadata: data.data?.metadata,
    };
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    return null;
  }
}

async function mapWebsite(url: string, apiKey: string): Promise<string[]> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Mapping website:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 100,
        includeSubdomains: false,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl map error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.links || [];
  } catch (error) {
    console.error('Firecrawl map error:', error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitorDomain, competitorName, deepAnalysis = true } = await req.json();

    if (!competitorDomain) {
      return new Response(
        JSON.stringify({ error: 'Competitor domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting ${deepAnalysis ? 'deep' : 'basic'} analysis for:`, competitorDomain);

    let scrapedPages: PageData[] = [];
    let siteStructure: string[] = [];
    let totalPagesFound = 0;

    // Use Firecrawl if available for deep analysis
    if (FIRECRAWL_API_KEY && deepAnalysis) {
      console.log('Using Firecrawl for comprehensive scraping...');

      // First, map the website to understand structure
      siteStructure = await mapWebsite(competitorDomain, FIRECRAWL_API_KEY);
      totalPagesFound = siteStructure.length;
      console.log(`Found ${totalPagesFound} pages on ${competitorDomain}`);

      // Scrape key pages: homepage, about, products, blog
      const keyPages = [
        competitorDomain, // homepage
      ];

      // Find important category pages
      const categoryPatterns = ['/tegels', '/badkamer', '/sanitair', '/douche', '/toilet', '/kranen', '/meubels', '/producten', '/categorie', '/shop'];
      const aboutPatterns = ['/over-ons', '/about', '/contact', '/showroom'];
      const blogPatterns = ['/blog', '/nieuws', '/inspiratie', '/tips'];

      for (const pattern of [...categoryPatterns, ...aboutPatterns, ...blogPatterns]) {
        const matchingUrl = siteStructure.find(url => url.toLowerCase().includes(pattern));
        if (matchingUrl && !keyPages.includes(matchingUrl)) {
          keyPages.push(matchingUrl);
        }
        if (keyPages.length >= 6) break; // Limit to 6 pages to save credits
      }

      console.log('Scraping key pages:', keyPages);

      // Scrape pages in parallel (max 3 at a time)
      for (let i = 0; i < keyPages.length; i += 3) {
        const batch = keyPages.slice(i, i + 3);
        const results = await Promise.all(
          batch.map(url => scrapeWithFirecrawl(url, FIRECRAWL_API_KEY))
        );
        scrapedPages.push(...results.filter((r): r is PageData => r !== null));
      }

      console.log(`Successfully scraped ${scrapedPages.length} pages`);
    }

    // Build comprehensive content for AI analysis
    let contentForAnalysis = '';
    
    if (scrapedPages.length > 0) {
      contentForAnalysis = scrapedPages.map(page => `
--- PAGE: ${page.url} ---
Title: ${page.metadata?.title || page.title || 'Unknown'}
Meta Description: ${page.metadata?.description || 'Not found'}

Content:
${page.markdown?.substring(0, 4000) || 'No content'}
---
`).join('\n\n');
    }

    const systemPrompt = `Je bent een senior SEO-strateeg en concurrentie-analist gespecialiseerd in de Nederlandse e-commerce markt voor tegels, badkamers en sanitair.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst.

Voer een UITGEBREIDE analyse uit van de concurrent website. Je analyseert:

1. **Visibility & Rankings**
   - Geschatte organische zichtbaarheid
   - Keyword rankings en zoekvolumes
   - Marktpositie t.o.v. tegeldepot.nl

2. **Technische SEO**
   - HTTPS, sitemap, robots.txt
   - Meta tags kwaliteit
   - Gestructureerde data
   - Pagina snelheid indicatoren
   - Mobile-friendliness

3. **Content Strategie**
   - Content types (blog, producten, gidsen)
   - Update frequentie
   - Gemiddelde content lengte
   - Unique selling points

4. **Competitieve Positie**
   - Marktpositie (budget/mid/premium)
   - Doelgroep
   - Geografische focus
   - Merksterkte

5. **Content Gaps & Kansen**
   - Onderwerpen die zij wel dekken en tegeldepot.nl niet
   - Keyword kansen
   - Content verbetermogelijkheden

JSON formaat (ALLE velden invullen):
{
  "visibilityScore": 0-100,
  "strengths": ["minimaal 5 sterke punten met specifieke details"],
  "weaknesses": ["minimaal 5 zwakke punten met specifieke details"],
  "topKeywords": [
    {"keyword": "zoekwoord", "estimatedPosition": 1-100, "searchVolume": 100-50000, "difficulty": "laag|medium|hoog"}
  ],
  "contentGaps": [
    {"topic": "onderwerp", "opportunity": "hoog|medium|laag", "description": "gedetailleerde beschrijving", "suggestedAction": "concrete actie"}
  ],
  "keywordOverlap": [
    {"keyword": "zoekwoord waar beide ranken", "competitorPosition": 1-100, "ourEstimatedPosition": 1-100}
  ],
  "recommendations": [
    {"action": "specifieke aanbeveling", "priority": "hoog|medium|laag", "impact": "beschrijving impact", "effort": "laag|medium|hoog"}
  ],
  "analysisData": {
    "estimatedMonthlyTraffic": getal,
    "estimatedKeywordCount": getal,
    "contentQualityScore": 0-100,
    "technicalSeoScore": 0-100,
    "mobileScore": 0-100,
    "pageSpeedIndicator": "snel|gemiddeld|traag",
    "contentFreshness": "vers|redelijk|verouderd",
    "domainAuthority": 0-100,
    "totalPages": getal,
    "avgContentLength": getal in woorden
  },
  "technicalSeo": {
    "hasHttps": boolean,
    "hasSitemap": boolean,
    "hasRobotsTxt": boolean,
    "metaDescriptions": percentage 0-100,
    "h1Tags": percentage 0-100,
    "imageAltTags": "goed|matig|slecht",
    "structuredData": boolean,
    "canonicalTags": boolean
  },
  "contentStrategy": {
    "blogPresent": boolean,
    "productCategories": ["categorie1", "categorie2"],
    "contentTypes": ["producten", "blogs", "guides", "faq", etc],
    "updateFrequency": "dagelijks|wekelijks|maandelijks|zelden",
    "avgWordCount": getal,
    "uniqueSellingPoints": ["USP1", "USP2", "USP3"]
  },
  "competitivePosition": {
    "marketPosition": "budget|mid-range|premium|luxury",
    "pricePositioning": "goedkoopste|competitief|premium|exclusief",
    "targetAudience": "beschrijving doelgroep",
    "geographicFocus": "nationaal|regionaal|lokaal",
    "brandStrength": "sterk|gemiddeld|zwak"
  }
}`;

    const userPrompt = `Analyseer deze concurrent van tegeldepot.nl UITGEBREID:

**Concurrent:** ${competitorName || competitorDomain}
**Website:** ${competitorDomain}
**Totaal pagina's gevonden:** ${totalPagesFound}
**Site structuur (sample URLs):** 
${siteStructure.slice(0, 20).join('\n')}

${contentForAnalysis ? `
**Gescrapete pagina inhoud:**
${contentForAnalysis}
` : 'Analyseer gebaseerd op de domain, URLs en je kennis van de Nederlandse tegels/badkamer markt.'}

OPDRACHT:
1. Analyseer ALLE aspecten van hun SEO-strategie
2. Vergelijk kritisch met tegeldepot.nl
3. Identificeer concrete kansen om hen te verslaan
4. Geef prioriteit aan quick wins vs. lange termijn strategieën
5. Wees specifiek en data-gedreven in je analyse`;

    console.log('Sending to AI for analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let analysisData: AnalysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw content:', content.substring(0, 500));
      
      // Return a default structure
      analysisData = {
        visibilityScore: 50,
        strengths: ['Analyse kon niet volledig worden uitgevoerd'],
        weaknesses: ['Probeer opnieuw voor volledige analyse'],
        topKeywords: [],
        contentGaps: [],
        keywordOverlap: [],
        recommendations: [],
        analysisData: {
          estimatedMonthlyTraffic: 0,
          estimatedKeywordCount: 0,
          contentQualityScore: 0,
          technicalSeoScore: 0,
          mobileScore: 0,
          pageSpeedIndicator: 'onbekend',
          contentFreshness: 'onbekend',
          domainAuthority: 0,
          totalPages: totalPagesFound,
          avgContentLength: 0,
        },
        technicalSeo: {
          hasHttps: true,
          hasSitemap: false,
          hasRobotsTxt: false,
          metaDescriptions: 0,
          h1Tags: 0,
          imageAltTags: 'onbekend',
          structuredData: false,
          canonicalTags: false,
        },
        contentStrategy: {
          blogPresent: false,
          productCategories: [],
          contentTypes: [],
          updateFrequency: 'onbekend',
          avgWordCount: 0,
          uniqueSellingPoints: [],
        },
        competitivePosition: {
          marketPosition: 'onbekend',
          pricePositioning: 'onbekend',
          targetAudience: 'onbekend',
          geographicFocus: 'onbekend',
          brandStrength: 'onbekend',
        },
      };
    }

    // Add metadata about the analysis
    const result = {
      ...analysisData,
      _metadata: {
        analysisDate: new Date().toISOString(),
        pagesScraped: scrapedPages.length,
        totalPagesFound,
        deepAnalysis,
        scrapedUrls: scrapedPages.map(p => p.url),
      },
    };

    console.log('Comprehensive competitor analysis completed');

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Competitor analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Competitor analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
