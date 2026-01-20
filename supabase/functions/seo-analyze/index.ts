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
    const { url, pageContent } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
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

    console.log('Analyzing SEO for URL:', url);

    const systemPrompt = `Je bent een expert SEO-analist gespecialiseerd in de Nederlandse e-commerce markt, met name voor tegels en badkamerproducten. 
Analyseer de gegeven pagina-inhoud en geef een gedetailleerde SEO-audit.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst. Gebruik het exacte formaat hieronder.

Beoordeel de pagina op:
1. Title tag kwaliteit (lengte, zoekwoorden, uniciteit)
2. Meta description (lengte, call-to-action, zoekwoorden)
3. Heading structuur (H1-H6 hiërarchie)
4. Content kwaliteit en zoekwoorddichtheid
5. Interne linking
6. Afbeeldingen (alt-tags)
7. URL structuur
8. Mobiele optimalisatie indicatoren
9. Laadsnelheid indicatoren
10. Schema markup mogelijkheden

Antwoord in JSON formaat:
{
  "score": 0-100,
  "title": "gevonden title",
  "metaDescription": "gevonden meta description",
  "issues": [
    {"type": "error|warning|info", "category": "categorie", "message": "beschrijving", "priority": "high|medium|low"}
  ],
  "recommendations": [
    {"category": "categorie", "action": "aanbevolen actie", "impact": "high|medium|low", "effort": "low|medium|high"}
  ],
  "technicalData": {
    "titleLength": 0,
    "metaDescriptionLength": 0,
    "h1Count": 0,
    "imageCount": 0,
    "imagesWithoutAlt": 0,
    "internalLinks": 0,
    "externalLinks": 0,
    "wordCount": 0,
    "keywordDensity": {}
  }
}`;

    const userPrompt = `Analyseer deze pagina voor SEO optimalisatie:

URL: ${url}

Pagina inhoud:
${pageContent || 'Geen inhoud beschikbaar - analyseer alleen de URL structuur'}`;

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
        temperature: 0.3,
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
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      // Return a basic analysis if parsing fails
      analysis = {
        score: 50,
        title: 'Parsing error',
        metaDescription: '',
        issues: [{ type: 'error', category: 'Analyse', message: 'Kon de analyse niet voltooien', priority: 'high' }],
        recommendations: [],
        technicalData: {}
      };
    }

    console.log('SEO analysis completed with score:', analysis.score);

    return new Response(
      JSON.stringify({ success: true, data: analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('SEO analyze error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
