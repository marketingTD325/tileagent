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
    const { seedKeyword, category } = await req.json();

    if (!seedKeyword) {
      return new Response(
        JSON.stringify({ error: 'Seed keyword is required' }),
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

    console.log('Researching keywords for:', seedKeyword);

    const systemPrompt = `Je bent een SEO keyword research specialist voor Tegeldepot.nl - een Nederlandse e-commerce webshop gespecialiseerd in tegels, badkamerproducten en sanitair.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst.

CONTEXT TEGELDEPOT:
- Doelgroep: Nederlandse consumenten die tegels of badkamerproducten zoeken
- Producten: vloertegels, wandtegels, buitentegels, badkamers, sanitair, kranen, accessoires
- Focus: kwaliteit, keuze, service, scherpe prijzen

GENEREER ZOEKWOORDEN DIE:
1. Relevant zijn voor de Nederlandse markt
2. Aansluiten bij zoekintentie (informational, commercial, transactional)
3. Praktisch bruikbaar zijn voor content en SEO

TYPES ZOEKWOORDEN:
- Productgerichte zoekwoorden (bijv. "betonlook tegels 60x60")
- Vraag-gebaseerde zoekwoorden (bijv. "welke tegels voor badkamer")
- Vergelijkingszoekwoorden (bijv. "verschil keramische en porseleinen tegels")
- Lokale zoekwoorden (bijv. "tegels kopen amsterdam")
- Long-tail variaties (3-5 woorden)

JSON formaat:
{
  "keywords": [
    {
      "keyword": "zoekwoord",
      "searchVolume": 100-50000,
      "difficulty": 0-100,
      "category": "product|vraag|vergelijking|lokaal|long-tail",
      "intent": "informational|commercial|transactional|navigational",
      "contentSuggestion": "korte suggestie voor content",
      "priority": "high|medium|low"
    }
  ],
  "categories": ["categorie1", "categorie2"],
  "contentIdeas": [
    {"title": "artikel titel", "keywords": ["kw1", "kw2"], "type": "blog|category|product"}
  ],
  "insights": "korte analyse en aanbevelingen"
}`;

    const userPrompt = `Genereer 15-20 relevante zoekwoorden voor Tegeldepot.nl gebaseerd op:

Basis zoekwoord: ${seedKeyword}
${category ? `Categorie focus: ${category}` : ''}

Inclusief:
- Exacte en gerelateerde variaties
- Long-tail zoekwoorden (3-5 woorden)
- Vraag-zoekwoorden ("hoe kies ik", "wat is het verschil", "welke")
- Vergelijkingszoekwoorden
- Koopintentie zoekwoorden ("kopen", "bestellen", "prijs")
- Praktische zoekwoorden ("leggen", "onderhoud", "kitten")

Geef ook 3-5 content ideeën die passen bij de gevonden zoekwoorden.`;

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
        temperature: 0.5,
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

    let keywordData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        keywordData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      keywordData = {
        keywords: [],
        categories: [],
        contentIdeas: [],
        insights: 'Parsing error occurred'
      };
    }

    console.log('Keyword research completed, found:', keywordData.keywords?.length || 0, 'keywords');

    return new Response(
      JSON.stringify({ success: true, data: keywordData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Keyword research error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Keyword research failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
