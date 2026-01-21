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
}

interface SerpApiResponse {
  organic_results?: SerpApiResult[];
  error?: string;
}

interface KeywordToCheck {
  id: string;
  keyword: string;
  target_domain: string;
  user_id: string;
  position: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('Starting scheduled rank check...');

  try {
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    if (!SERPAPI_API_KEY) {
      console.error('SERPAPI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SerpApi API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for cron access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all keywords that are being tracked with a target domain
    const { data: keywords, error: fetchError } = await supabase
      .from('keywords')
      .select('id, keyword, target_domain, user_id, position')
      .eq('is_tracking', true)
      .not('target_domain', 'is', null);

    if (fetchError) {
      console.error('Error fetching keywords:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch keywords' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!keywords || keywords.length === 0) {
      console.log('No keywords to check');
      return new Response(
        JSON.stringify({ success: true, message: 'No keywords to check', checked: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${keywords.length} keywords to check`);

    let successCount = 0;
    let failCount = 0;
    const results: { keyword: string; position: number | null; success: boolean }[] = [];

    // Process keywords with delay between requests
    for (const kw of keywords as KeywordToCheck[]) {
      try {
        console.log(`Checking: "${kw.keyword}" for domain: ${kw.target_domain}`);

        // Build SerpApi URL
        const searchParams = new URLSearchParams({
          api_key: SERPAPI_API_KEY,
          engine: 'google',
          q: kw.keyword,
          google_domain: 'google.nl',
          gl: 'nl',
          hl: 'nl',
          location: 'Netherlands',
          device: 'desktop',
          num: '100',
        });

        const serpApiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;
        const serpResponse = await fetch(serpApiUrl);
        const serpData = await serpResponse.json() as SerpApiResponse;

        if (serpData.error) {
          console.error(`SerpApi error for "${kw.keyword}":`, serpData.error);
          failCount++;
          results.push({ keyword: kw.keyword, position: null, success: false });
          continue;
        }

        // Find the target domain in results
        let foundPosition: number | null = null;
        let foundResult: SerpApiResult | null = null;

        const organicResults = serpData.organic_results || [];

        for (const result of organicResults) {
          try {
            const resultUrl = new URL(result.link);
            const resultDomain = resultUrl.hostname.replace('www.', '');
            const targetDomainClean = kw.target_domain.replace('www.', '').replace(/^https?:\/\//, '');

            if (resultDomain.includes(targetDomainClean) || targetDomainClean.includes(resultDomain)) {
              foundPosition = result.position;
              foundResult = result;
              break;
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }

        console.log(`Result for "${kw.keyword}": Position ${foundPosition || 'Not found'}`);

        // Save to history
        await supabase.from('rank_tracking_history').insert([{
          keyword_id: kw.id,
          user_id: kw.user_id,
          position: foundPosition,
          url: foundResult?.link || null,
          title: foundResult?.title || null,
          snippet: foundResult?.snippet || null,
          search_engine: 'google',
          location: 'Netherlands',
          device: 'desktop',
          checked_at: new Date().toISOString(),
        }]);

        // Update keyword
        await supabase
          .from('keywords')
          .update({
            previous_position: kw.position,
            position: foundPosition,
            last_checked: new Date().toISOString(),
          })
          .eq('id', kw.id);

        successCount++;
        results.push({ keyword: kw.keyword, position: foundPosition, success: true });

        // Delay between requests to respect rate limits (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error checking "${kw.keyword}":`, error);
        failCount++;
        results.push({ keyword: kw.keyword, position: null, success: false });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Scheduled rank check completed in ${duration}s. Success: ${successCount}, Failed: ${failCount}`);

    // Log activity
    if (keywords.length > 0) {
      const firstUserId = (keywords as KeywordToCheck[])[0].user_id;
      await supabase.from('activity_log').insert([{
        user_id: firstUserId,
        action_type: 'scheduled_rank_check',
        action_description: `Automatische ranking check: ${successCount} succesvol, ${failCount} mislukt`,
        metadata: { 
          success_count: successCount, 
          fail_count: failCount,
          duration_seconds: duration,
          keywords_checked: keywords.length
        }
      }]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${keywords.length} keywords`,
        stats: {
          total: keywords.length,
          success: successCount,
          failed: failCount,
          duration_seconds: duration,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scheduled-rank-check:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
