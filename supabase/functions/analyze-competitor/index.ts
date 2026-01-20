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
    const { competitorDomain, pageContent, competitorName } = await req.json();

    if (!competitorDomain) {
      return new Response(
        JSON.stringify({ error: 'Competitor domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing competitor:', competitorDomain);

    const systemPrompt = `Je bent een SEO-concurrent analyse expert voor de Nederlandse tegels en badkamer markt.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst.

Analyseer de concurrent website en vergelijk met tegeldepot.nl op:
1. SEO-sterke punten
2. Content strategie
3. Zoekwoord focus
4. Technische SEO
5. User experience indicatoren
6. Content gaps (kansen voor tegeldepot.nl)

JSON formaat:
{
  "visibilityScore": 0-100,
  "strengths": ["sterke punt 1", "sterke punt 2"],
  "weaknesses": ["zwakte 1", "zwakte 2"],
  "topKeywords": [
    {"keyword": "zoekwoord", "estimatedPosition": 1-100, "searchVolume": 100-50000}
  ],
  "contentGaps": [
    {"topic": "onderwerp", "opportunity": "hoog|medium|laag", "description": "beschrijving kans"}
  ],
  "keywordOverlap": [
    {"keyword": "zoekwoord", "competitorPosition": 1-100, "ourEstimatedPosition": 1-100}
  ],
  "recommendations": [
    {"action": "aanbeveling", "priority": "hoog|medium|laag", "impact": "beschrijving impact"}
  ],
  "analysisData": {
    "estimatedMonthlyTraffic": 0,
    "estimatedKeywordCount": 0,
    "contentQualityScore": 0-100,
    "technicalSeoScore": 0-100
  }
}`;

    const userPrompt = `Analyseer deze concurrent van tegeldepot.nl:

Concurrent: ${competitorName || competitorDomain}
Website: ${competitorDomain}

${pageContent ? `Website inhoud:\n${pageContent}` : 'Analyseer gebaseerd op de domain en je kennis van de markt.'}

Vergelijk met tegeldepot.nl en identificeer:
1. Wat doet deze concurrent beter?
2. Waar zijn ze zwakker?
3. Welke zoekwoorden targeten zij die wij missen?
4. Welke content kansen zijn er?`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
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
    let analysisData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      analysisData = {
        visibilityScore: 0,
        strengths: [],
        weaknesses: [],
        topKeywords: [],
        contentGaps: [],
        keywordOverlap: [],
        recommendations: [],
        analysisData: {}
      };
    }

    console.log('Competitor analysis completed');

    return new Response(
      JSON.stringify({ success: true, data: analysisData }),
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
