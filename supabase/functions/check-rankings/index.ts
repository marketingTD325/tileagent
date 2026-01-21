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

interface RankCheckRequest {
  keywordId: string;
  keyword: string;
  targetDomain: string;
  location?: string;
  device?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as RankCheckRequest;
    const { keywordId, keyword, targetDomain, location = 'Netherlands', device = 'desktop' } = body;

    if (!keywordId || !keyword || !targetDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: keywordId, keyword, targetDomain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ranking for keyword: "${keyword}" on domain: ${targetDomain}`);

    // Build SerpApi URL
    const searchParams = new URLSearchParams({
      api_key: SERPAPI_API_KEY,
      engine: 'google',
      q: keyword,
      google_domain: 'google.nl',
      gl: 'nl',
      hl: 'nl',
      location: location,
      device: device,
      num: '100', // Check top 100 results
    });

    const serpApiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;
    
    console.log('Calling SerpApi...');
    const serpResponse = await fetch(serpApiUrl);
    const serpData = await serpResponse.json() as SerpApiResponse;

    if (serpData.error) {
      console.error('SerpApi error:', serpData.error);
      return new Response(
        JSON.stringify({ success: false, error: `SerpApi error: ${serpData.error}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the target domain in results
    let foundPosition: number | null = null;
    let foundResult: SerpApiResult | null = null;

    const organicResults = serpData.organic_results || [];
    console.log(`Found ${organicResults.length} organic results`);

    for (const result of organicResults) {
      try {
        const resultUrl = new URL(result.link);
        const resultDomain = resultUrl.hostname.replace('www.', '');
        const targetDomainClean = targetDomain.replace('www.', '').replace(/^https?:\/\//, '');

        if (resultDomain.includes(targetDomainClean) || targetDomainClean.includes(resultDomain)) {
          foundPosition = result.position;
          foundResult = result;
          console.log(`Found target domain at position ${foundPosition}: ${result.link}`);
          break;
        }
      } catch (e) {
        console.error('Error parsing URL:', result.link, e);
      }
    }

    // Save to history
    const historyRecord = {
      keyword_id: keywordId,
      user_id: user.id,
      position: foundPosition,
      url: foundResult?.link || null,
      title: foundResult?.title || null,
      snippet: foundResult?.snippet || null,
      search_engine: 'google',
      location: location,
      device: device,
      checked_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('rank_tracking_history')
      .insert([historyRecord]);

    if (insertError) {
      console.error('Error saving history:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save ranking history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get previous position first
    const { data: currentKeyword } = await supabase
      .from('keywords')
      .select('position')
      .eq('id', keywordId)
      .single();

    const previousPosition = currentKeyword?.position || null;

    // Update keyword with current position
    const { error: updateError } = await supabase
      .from('keywords')
      .update({
        previous_position: previousPosition,
        position: foundPosition,
        last_checked: new Date().toISOString(),
      })
      .eq('id', keywordId);

    if (updateError) {
      console.error('Error updating keyword:', updateError);
    }

    console.log(`Ranking check complete. Position: ${foundPosition || 'Not found'}`);

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          keyword,
          position: foundPosition,
          url: foundResult?.link || null,
          title: foundResult?.title || null,
          snippet: foundResult?.snippet || null,
          found: foundPosition !== null,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-rankings:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
