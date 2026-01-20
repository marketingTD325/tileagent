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
    const { contentType, productName, keywords, context, tone } = await req.json();

    if (!contentType || !productName) {
      return new Response(
        JSON.stringify({ error: 'Content type and product name are required' }),
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

    console.log('Generating content:', contentType, 'for:', productName);

    const prompts: Record<string, { system: string; user: string }> = {
      product_description: {
        system: `Je bent een expert copywriter gespecialiseerd in SEO-geoptimaliseerde productbeschrijvingen voor de Nederlandse tegels en badkamer e-commerce markt.

Schrijf productbeschrijvingen die:
- Informatief en overtuigend zijn
- Relevante zoekwoorden natuurlijk bevatten
- De voordelen en kenmerken duidelijk beschrijven
- Een call-to-action bevatten
- 150-300 woorden lang zijn

Schrijf in het Nederlands met een ${tone || 'professionele'} toon.`,
        user: `Schrijf een SEO-geoptimaliseerde productbeschrijving voor:

Product: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Geef de beschrijving in het volgende formaat:
1. Een pakkende openingszin
2. Productkenmerken en voordelen
3. Technische specificaties (indien van toepassing)
4. Call-to-action`
      },
      blog_post: {
        system: `Je bent een expert content creator gespecialiseerd in SEO-geoptimaliseerde blogartikelen voor de Nederlandse badkamer en tegels markt.

Schrijf blogposts die:
- Informatief en waardevol zijn voor de lezer
- Goed gestructureerd zijn met headers (H2, H3)
- Zoekwoorden natuurlijk bevatten
- 500-800 woorden lang zijn
- Interne linking mogelijkheden suggereren

Schrijf in het Nederlands.`,
        user: `Schrijf een SEO-geoptimaliseerd blogartikel over:

Onderwerp: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Structuur:
1. Pakkende titel met zoekwoord
2. Introductie
3. 3-4 hoofdsecties met H2 headers
4. Praktische tips
5. Conclusie met call-to-action`
      },
      meta_tags: {
        system: `Je bent een SEO-specialist gespecialiseerd in het schrijven van effectieve meta tags voor de Nederlandse e-commerce markt.

Regels:
- Title tag: 50-60 karakters, zoekwoord vooraan
- Meta description: 150-160 karakters, call-to-action, zoekwoord
- Overtuigend en clickbaar

Schrijf in het Nederlands.`,
        user: `Genereer meta tags voor:

Pagina: ${productName}
${keywords?.length ? `Primair zoekwoord: ${keywords[0]}` : ''}
${keywords?.length > 1 ? `Secundaire zoekwoorden: ${keywords.slice(1).join(', ')}` : ''}
${context ? `Context: ${context}` : ''}

Geef terug:
1. Title tag (max 60 karakters)
2. Meta description (max 160 karakters)
3. 3 alternatieve versies van elk`
      },
      category_description: {
        system: `Je bent een e-commerce SEO-specialist die categoriebeschrijvingen schrijft voor de Nederlandse tegels en badkamer markt.

Schrijf beschrijvingen die:
- De categorie duidelijk introduceren
- Relevante zoekwoorden bevatten
- Subcoategoriën linken
- 200-400 woorden lang zijn
- SEO-vriendelijk zijn

Schrijf in het Nederlands.`,
        user: `Schrijf een SEO-geoptimaliseerde categoriebeschrijving voor:

Categorie: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Structuur:
1. Inleidende paragraaf
2. Voordelen van producten in deze categorie
3. Populaire subcategorieën of producttypes
4. Kooptips
5. Call-to-action`
      }
    };

    const promptConfig = prompts[contentType];
    if (!promptConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: promptConfig.system },
          { role: 'user', content: promptConfig.user }
        ],
        temperature: 0.7,
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

    console.log('Content generated successfully');

    return new Response(
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Content generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Content generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
