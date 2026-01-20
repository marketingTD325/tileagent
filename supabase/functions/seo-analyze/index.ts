import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tegeldepot Brand Guidelines for SEO Analysis
const TEGELDEPOT_CONTEXT = `
## CONTEXT: TEGELDEPOT.NL

Tegeldepot is een Nederlandse e-commerce webshop gespecialiseerd in:
- Tegels (vloertegels, wandtegels, buitentegels)
- Badkamerproducten en sanitair
- Accessoires en gereedschap

### TONE OF VOICE EISEN
- Pragmatisch en no-nonsense
- Oplossingsgericht met keuzehulp
- Duidelijk en concreet (geen vakjargon)
- Autoritair vanuit expertise
- Eerlijk en transparant

### SEO CATEGORIEPAGINA STANDAARDEN
- Sterke H1 + introductietekst
- SEO-tekst 700-1000 woorden onder de listing
- Interne linking: 300 woorden → 1-2 links, 600 → 3-4, 800-1000 → 5-6
- FAQ-blok met schema.org markup
- E-E-A-T elementen (expertise, experience, authority, trust)
- Geen keyword stuffing
- Meta title/description die aansluit bij zoekintentie
`;

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

    const systemPrompt = `Je bent een expert SEO-analist voor Tegeldepot.nl.

${TEGELDEPOT_CONTEXT}

Analyseer de gegeven pagina-inhoud en geef een gedetailleerde SEO-audit.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst.

BEOORDEEL OP:
1. Title tag (lengte 50-60 karakters, zoekwoord vooraan)
2. Meta description (lengte 150-160 karakters, call-to-action)
3. Heading structuur (H1-H6 hiërarchie)
4. Content kwaliteit:
   - Volgt het de Tegeldepot tone of voice?
   - Is het oplossingsgericht met keuzehulp?
   - Geen vage algemeenheden?
   - Concrete praktische info?
5. Interne linking (voldoende voor de tekstlengte?)
6. E-E-A-T elementen (expertise, FAQ, etc.)
7. Afbeeldingen (alt-tags)
8. URL structuur
9. Schema markup mogelijkheden

SCOOR STRENG: Tegeldepot wil pragmatische, no-nonsense content die de klant echt helpt.

JSON formaat:
{
  "score": 0-100,
  "title": "gevonden title",
  "metaDescription": "gevonden meta description",
  "issues": [
    {"type": "error|warning|info", "category": "categorie", "message": "beschrijving", "priority": "high|medium|low"}
  ],
  "recommendations": [
    {"category": "categorie", "action": "concrete aanbeveling in Tegeldepot stijl", "impact": "high|medium|low", "effort": "low|medium|high"}
  ],
  "toneOfVoiceScore": {
    "pragmatisch": 0-100,
    "oplossingsgericht": 0-100,
    "concreet": 0-100,
    "autoritair": 0-100,
    "feedback": "specifieke feedback over tone of voice"
  },
  "technicalData": {
    "titleLength": 0,
    "metaDescriptionLength": 0,
    "h1Count": 0,
    "h2Count": 0,
    "h3Count": 0,
    "imageCount": 0,
    "imagesWithoutAlt": 0,
    "internalLinks": 0,
    "externalLinks": 0,
    "wordCount": 0,
    "estimatedReadTime": "X min",
    "hasFaq": false,
    "hasStructuredData": false
  }
}`;

    const userPrompt = `Analyseer deze Tegeldepot.nl pagina voor SEO optimalisatie:

URL: ${url}

Pagina inhoud:
${pageContent || 'Geen inhoud beschikbaar - analyseer alleen de URL structuur'}

Wees kritisch en concreet. Geef specifieke verbeterpunten in de Tegeldepot tone of voice.`;

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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      analysis = {
        score: 50,
        title: 'Parsing error',
        metaDescription: '',
        issues: [{ type: 'error', category: 'Analyse', message: 'Kon de analyse niet voltooien', priority: 'high' }],
        recommendations: [],
        toneOfVoiceScore: { pragmatisch: 0, oplossingsgericht: 0, concreet: 0, autoritair: 0, feedback: '' },
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
