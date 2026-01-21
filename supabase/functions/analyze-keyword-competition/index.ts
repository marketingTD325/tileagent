import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SerpApiResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayed_link?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiResult[];
  error?: string;
}

interface CompetitorData {
  domain: string;
  appearances: number;
  keywords: string[];
  avgPosition: number;
  positions: number[];
}

interface KeywordResult {
  keyword: string;
  topResults: {
    position: number;
    domain: string;
    title: string;
    url: string;
  }[];
  difficulty: 'low' | 'medium' | 'high';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    if (!SERPAPI_API_KEY) {
      console.error('SERPAPI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SerpApi API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keywords, targetDomain } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Keywords array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing competition for ${keywords.length} keywords`);

    const competitorMap = new Map<string, CompetitorData>();
    const keywordResults: KeywordResult[] = [];
    let targetDomainPositions: { keyword: string; position: number | null }[] = [];

    // Limit to prevent excessive API usage
    const keywordsToAnalyze = keywords.slice(0, 15);

    for (const keyword of keywordsToAnalyze) {
      try {
        console.log(`Checking: "${keyword}"`);

        const searchParams = new URLSearchParams({
          api_key: SERPAPI_API_KEY,
          engine: 'google',
          q: keyword,
          google_domain: 'google.nl',
          gl: 'nl',
          hl: 'nl',
          location: 'Netherlands',
          device: 'desktop',
          num: '10',
        });

        const serpApiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;
        const serpResponse = await fetch(serpApiUrl);
        const serpData = await serpResponse.json() as SerpApiResponse;

        if (serpData.error) {
          console.error(`SerpApi error for "${keyword}":`, serpData.error);
          continue;
        }

        const organicResults = serpData.organic_results || [];
        const topResults: KeywordResult['topResults'] = [];

        // Track target domain position
        let targetPosition: number | null = null;

        for (const result of organicResults.slice(0, 10)) {
          try {
            const resultUrl = new URL(result.link);
            const domain = resultUrl.hostname.replace('www.', '');

            topResults.push({
              position: result.position,
              domain,
              title: result.title,
              url: result.link,
            });

            // Check if this is the target domain
            if (targetDomain) {
              const cleanTargetDomain = targetDomain.replace('www.', '').replace(/^https?:\/\//, '');
              if (domain.includes(cleanTargetDomain) || cleanTargetDomain.includes(domain)) {
                targetPosition = result.position;
              }
            }

            // Track competitor data
            const existing = competitorMap.get(domain);
            if (existing) {
              existing.appearances++;
              existing.keywords.push(keyword);
              existing.positions.push(result.position);
              existing.avgPosition = existing.positions.reduce((a, b) => a + b, 0) / existing.positions.length;
            } else {
              competitorMap.set(domain, {
                domain,
                appearances: 1,
                keywords: [keyword],
                avgPosition: result.position,
                positions: [result.position],
              });
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }

        // Determine keyword difficulty based on top results
        const hasStrongBrands = topResults.some(r => 
          ['bol.com', 'amazon', 'mediamarkt', 'coolblue', 'ikea', 'praxis', 'gamma', 'hornbach'].some(brand => 
            r.domain.includes(brand)
          )
        );
        
        const difficulty: 'low' | 'medium' | 'high' = hasStrongBrands ? 'high' : 
          organicResults.length >= 10 ? 'medium' : 'low';

        keywordResults.push({
          keyword,
          topResults,
          difficulty,
        });

        targetDomainPositions.push({ keyword, position: targetPosition });

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`Error analyzing "${keyword}":`, error);
      }
    }

    // Sort competitors by appearances
    const topCompetitors = Array.from(competitorMap.values())
      .filter(c => !targetDomain || !c.domain.includes(targetDomain.replace('www.', '')))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 15)
      .map(c => ({
        domain: c.domain,
        appearances: c.appearances,
        avgPosition: Math.round(c.avgPosition * 10) / 10,
        keywords: c.keywords.slice(0, 5),
      }));

    // Calculate summary stats
    const targetInTop10 = targetDomainPositions.filter(p => p.position !== null && p.position <= 10).length;
    const targetInTop3 = targetDomainPositions.filter(p => p.position !== null && p.position <= 3).length;

    console.log(`Analysis complete. Found ${topCompetitors.length} competitors.`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          keywordsAnalyzed: keywordResults.length,
          targetDomain: targetDomain || null,
          targetInTop10,
          targetInTop3,
          competitorsFound: topCompetitors.length,
        },
        topCompetitors,
        keywordResults,
        targetDomainPositions: targetDomain ? targetDomainPositions : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-keyword-competition:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
