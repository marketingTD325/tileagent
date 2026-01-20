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
    const { content, contentType } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
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

    console.log('Analyzing content quality for:', contentType);

    const systemPrompt = `Je bent een SEO en content kwaliteit expert die teksten beoordeelt voor Tegeldepot.nl.

Analyseer de gegeven HTML content en geef een score (1-10) voor elke categorie.

BEOORDELINGSCRITERIA:

## E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
- Experience: Toont de tekst praktijkervaring? ("In onze showrooms zien we...", "Veel klanten kiezen...")
- Expertise: Spreekt de tekst vanuit vakkennis? ("Bij Tegeldepot adviseren we...", specialist tips)
- Authoritativeness: Wordt er met zekerheid gesproken? Concrete aanbevelingen?
- Trustworthiness: Eerlijke nuances? ("Let op bij...", geen overdreven claims)

## Helpfulness (Behulpzaamheid)
- Beantwoordt de tekst echte klantvragen?
- Biedt het keuzehulp en praktische tips?
- Is er unieke waarde of alleen algemene info?
- Helpt het de lezer een beslissing maken?

## Basic SEO
- Goede H1/H2/H3 structuur?
- Natuurlijk zoekwoordgebruik (niet stuffing)?
- Interne links aanwezig (check voor <a href>)?
- Logische tekstopbouw?

## Leesbaarheid
- Vlotte, leesbare zinnen?
- Logische opbouw en flow?
- Geen overbodige tekst of herhaling?
- Afwisseling in zinslengte?

ANTWOORD FORMAAT (JSON):
{
  "scores": {
    "eeat": {
      "score": 7,
      "feedback": "Korte feedback in 1-2 zinnen"
    },
    "helpfulness": {
      "score": 8,
      "feedback": "Korte feedback in 1-2 zinnen"
    },
    "seo": {
      "score": 7,
      "feedback": "Korte feedback in 1-2 zinnen"
    },
    "readability": {
      "score": 8,
      "feedback": "Korte feedback in 1-2 zinnen"
    }
  },
  "overallScore": 7.5,
  "topPriority": "Hoogste prioriteit verbetering in 1 zin",
  "strengths": ["Sterk punt 1", "Sterk punt 2"]
}

Geef ALLEEN valide JSON terug, geen andere tekst.`;

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
          { role: 'user', content: `Analyseer deze ${contentType || 'categorie'} tekst:\n\n${content}` }
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
    let analysisText = aiResponse.choices?.[0]?.message?.content;

    if (!analysisText) {
      throw new Error('No content in AI response');
    }

    // Clean up the response - remove markdown code blocks if present
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', analysisText);
      throw new Error('Failed to parse quality analysis');
    }

    console.log('Content quality analysis completed');

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Content analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Content analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
