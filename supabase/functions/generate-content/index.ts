import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tegeldepot Tone of Voice & Brand Guidelines
const TEGELDEPOT_GUIDELINES = `
## TONE OF VOICE TEGELDEPOT

Je bent de SEO-tekstschrijver van Tegeldepot.

### TAAL & TOON
- Schrijf in het Nederlands
- Spreek de klant informeel aan met "je" (nooit "u")
- Schrijf menselijk, professioneel en stabiel
- Vermijd "AI-woorden" en meta-teksten over hoe je schrijft
- Schrijf autoritair vanuit Tegeldepot: duidelijk, zeker, behulpzaam

### KERNWAARDEN
- Pragmatisch en no-nonsense: zeg waar het op staat, zonder omwegen
- Oplossingsgericht: help de klant snel naar de juiste tegel, info of vervolgstap
- Duidelijk en concreet: geen vakjargon; wel uitleg in normale mensentaal
- Autoritair vanuit expertise: spreek met zekerheid op basis van feiten en productkennis
- Eerlijk en transparant: beloof geen dingen die niet zeker zijn

### DO'S
- Kort en concreet taalgebruik
- Duidelijke keuzehulp per situatie
- Technische én praktische kennis tonen
- Eerlijke nuances ("let op bij hard water", "controleer je waterdruk")

### DON'TS
- Geen verzonnen specificaties, prijzen, levertijden, garanties of productclaims
- Geen vage algemeenheden of overbodige inleiding
- Geen langdradige wervende zinnen als "maak vandaag nog de stap…"
- Geen loze commerciële zinnen
`;

const SEO_CATEGORY_GUIDELINES = `
## SEO CATEGORIEPAGINA RICHTLIJNEN

### ESSENTIËLE ELEMENTEN
1. Sterke H1 + introductietekst: Kort, duidelijk, beschrijvend. Benoemt het doel van de pagina.

2. SEO-tekst (700-1000 woorden):
   - Unieke, originele tekst
   - Focus zoekwoorden en gerelateerde termen
   - Écht behulpzame content voor oriënterende bezoekers
   - Geen keyword stuffing
   - Goede H2, H3 structuur

3. Interne linking richtlijn:
   - 300 woorden → 1-2 interne links
   - 600 woorden → 3-4 interne links
   - 800-1000 woorden → 5-6 interne links

4. Meta title & description:
   - Overtuigend, aansluitend bij zoekintentie
   - Geen clickbait

### E-E-A-T SIGNALEN (VERPLICHT)
- Schrijf vanuit Tegeldepot als expert: "Bij Tegeldepot adviseren we...", "Onze tegelspecialisten raden aan..."
- Voeg ervaringstips toe: "In onze showrooms zien we vaak dat klanten...", "Uit ervaring weten we..."
- Gebruik concrete expertise: noem specifieke situaties, veelgemaakte fouten, professionele inzichten
- Toon autoriteit door nuance: "Let op bij [situatie]...", "Belangrijk om te weten is..."

### SFEER & BEELDSPRAAK
- Voeg subtiele sfeervolle beschrijvingen toe (bijv. "een ovale spiegel maakt van jouw badkamer een oase van rust")
- Wees niet té commercieel, maar wel inspirerend
- Help de lezer zich de situatie voor te stellen

### KLANT/SPECIALIST TIPS SECTIE
- Voeg een sectie toe met praktische tips vanuit klant- of specialistperspectief
- Bijv. "Tip van onze tegelspecialist:", "Veel van onze klanten kiezen voor..."

### AFSLUITENDE CTA (VERPLICHT)
- Sluit altijd af met een paragraaf die bezoekers richting producten leidt
- Bijv. "Bekijk ons assortiment...", "In onze collectie vind je...", "Ontdek de mogelijkheden..."
- Maak de vervolgstap duidelijk en laagdrempelig

### FAQ SECTIE (2-3 UNIEKE VRAGEN)
- Focus op echte klantvragen, niet generieke vragen
- Beantwoord concreet en behulpzaam
- Vermijd herhaling van informatie die al in de tekst staat
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentType, productName, keywords, context, tone, internalLinks, existingContent, mode } = await req.json();

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

    // Handle inject_links mode - add missing links to existing content
    if (mode === 'inject_links' && existingContent && internalLinks?.length) {
      console.log('Injecting', internalLinks.length, 'missing links into existing content');
      
      const injectPrompt = {
        system: `${TEGELDEPOT_GUIDELINES}

Je bent een SEO-specialist die interne links toevoegt aan bestaande content.

TAAK:
- Je krijgt een bestaande HTML-tekst en een lijst met links die MOETEN worden toegevoegd
- Verwerk ELKE link als een HTML anchor: <a href="URL">ankertekst</a>
- Plaats de links op logische, natuurlijke plekken in de tekst
- Pas de ankertekst aan zodat deze natuurlijk in de zin past
- Behoud de rest van de content exact zoals het is
- Voeg GEEN nieuwe content toe, alleen de links

KRITISCH:
- ALLE opgegeven links MOETEN in de output verschijnen
- Gebruik het exacte URL-pad zoals opgegeven
- De output moet valide HTML zijn`,
        user: `Voeg de volgende interne links toe aan deze content:

=== LINKS OM TOE TE VOEGEN ===
${internalLinks.map((link: { anchor: string; url: string }, index: number) => `${index + 1}. "${link.anchor}" → ${link.url}`).join('\n')}

=== BESTAANDE CONTENT ===
${existingContent}

=== INSTRUCTIES ===
1. Zoek voor elke link een logische plek in de tekst
2. Voeg de link toe als <a href="URL">tekst</a>
3. Pas de ankertekst aan zodat het natuurlijk leest in de context
4. Geef de VOLLEDIGE content terug met de links erin verwerkt

⚠️ ALLE ${internalLinks.length} links MOETEN als <a href="...">...</a> in de output staan!`
      };

      // Use the same retry logic for inject mode
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`AI inject request attempt ${attempt}/${maxRetries}`);
          
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: injectPrompt.system },
                { role: 'user', content: injectPrompt.user }
              ],
              temperature: 0.3, // Lower temperature for more consistent output
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

          console.log('Links injected successfully');

          return new Response(
            JSON.stringify({ success: true, content }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Inject attempt ${attempt} failed:`, lastError.message);
          
          if (lastError.message.includes('Connection reset') || 
              lastError.message.includes('connection') ||
              lastError.message.includes('network')) {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
          }
          break;
        }
      }

      console.error('Link injection error after retries:', lastError);
      return new Response(
        JSON.stringify({ error: lastError?.message || 'Link injection failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating content:', contentType, 'for:', productName);

    const prompts: Record<string, { system: string; user: string }> = {
      product_description: {
        system: `${TEGELDEPOT_GUIDELINES}

Je schrijft productbeschrijvingen voor Tegeldepot.nl.

PRODUCTBESCHRIJVING EISEN:
- 150-300 woorden
- Begin direct met de kern, geen overbodige intro
- Benoem materiaal, afmetingen, toepassing concreet
- Geef keuzehulp: voor welke ruimte/stijl geschikt?
- Praktische tips (onderhoud, combinaties)
- Sluit af met duidelijke volgende stap
- VERZIN GEEN specificaties, prijzen of levertijden`,
        user: `Schrijf een productbeschrijving voor Tegeldepot.nl:

Product: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Lever direct de tekst. Geen intro over wat je gaat doen.`
      },
      blog_post: {
        system: `${TEGELDEPOT_GUIDELINES}

Je schrijft blogartikelen voor Tegeldepot.nl.

BLOGARTIKEL EISEN:
- 600-900 woorden
- Oplossingsgericht: help de lezer een keuze maken
- Concrete tips en keuzehulp per situatie
- H2 en H3 structuur voor leesbaarheid
- Interne links naar relevante categorieën/producten
- Expert-toon: spreek vanuit productkennis
- Geen vage algemeenheden, wel specifieke voorbeelden`,
        user: `Schrijf een blogartikel voor Tegeldepot.nl:

Onderwerp: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Lever direct het artikel. Begin met de H1 titel.`
      },
      meta_tags: {
        system: `${TEGELDEPOT_GUIDELINES}

Je schrijft meta tags voor Tegeldepot.nl.

META TAG EISEN:
- Title tag: 50-60 karakters, zoekwoord vooraan, geen clickbait
- Meta description: 150-160 karakters, concreet en behulpzaam
- Sluit aan bij de werkelijke pagina-inhoud
- Overtuigend maar eerlijk`,
        user: `Genereer meta tags voor Tegeldepot.nl:

Pagina: ${productName}
${keywords?.length ? `Primair zoekwoord: ${keywords[0]}` : ''}
${keywords?.length > 1 ? `Secundaire zoekwoorden: ${keywords.slice(1).join(', ')}` : ''}
${context ? `Context: ${context}` : ''}

Geef:
1. Title tag (max 60 karakters)
2. Meta description (max 160 karakters)
3. 2 alternatieve versies van elk`
      },
      category_description: {
        system: `${TEGELDEPOT_GUIDELINES}
${SEO_CATEGORY_GUIDELINES}

Je schrijft categoriebeschrijvingen voor Tegeldepot.nl.

CATEGORIEBESCHRIJVING EISEN:
- 700-1000 woorden (bruikbare inhoud, niet opvullen)
- Sterke H1 + korte intro die direct het doel beschrijft
- Goede H2/H3 structuur
- 5-6 interne links naar subcategorieën of gerelateerde pagina's
- Keuzehulp: help de bezoeker kiezen
- Praktische tips per situatie/ruimte
- FAQ sectie met 3-5 echte klantvragen
- Geen keyword stuffing, wel natuurlijk zoekwoordgebruik`,
        user: `Schrijf een SEO-categoriebeschrijving voor Tegeldepot.nl:

Categorie: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

Structuur:
1. H1 + korte intro (doel van de pagina)
2. Keuzehulp secties met H2/H3
3. Praktische tips per toepassing
4. Interne links naar subcategorieën (suggereer placeholders als [link naar X])
5. FAQ sectie (3-5 vragen)

Lever direct de tekst.`
      },
      category_with_links: {
        system: `${TEGELDEPOT_GUIDELINES}
${SEO_CATEGORY_GUIDELINES}

Je schrijft categoriebeschrijvingen met ECHTE interne links voor Tegeldepot.nl.

CATEGORIEBESCHRIJVING MET LINKS EISEN:
- 700-1000 woorden (bruikbare inhoud, niet opvullen)
- Sterke H1 + korte intro die direct het doel beschrijft
- Goede H2/H3 structuur
- VERPLICHT: GEBRUIK ALLE INTERNE LINKS die worden opgegeven - verwerk ze als HTML anchors
- Keuzehulp: help de bezoeker kiezen
- Praktische tips per situatie/ruimte
- FAQ sectie met 2-3 UNIEKE klantvragen (geen herhaling van tekst)
- Geen keyword stuffing, wel natuurlijk zoekwoordgebruik

E-E-A-T VERPLICHTINGEN:
- Schrijf ALTIJD vanuit Tegeldepot expertise: "Bij Tegeldepot adviseren we...", "Onze specialisten zien vaak..."
- Voeg minstens 1 tip van een specialist toe: "Tip van onze tegelexpert: ..."
- Toon ervaring: "Veel van onze klanten kiezen voor...", "In onze showrooms merken we..."

SFEER & BEELDSPRAAK:
- Voeg subtiele sfeervolle zinnen toe die de lezer helpen visualiseren
- Niet té commercieel, wel inspirerend

AFSLUITENDE CTA (VERPLICHT):
- Sluit AF met een paragraaf die bezoekers naar producten leidt
- Bijv. "Bekijk ons assortiment...", "Ontdek de mogelijkheden in onze collectie..."

KRITISCH - INTERNE LINKING REGELS:
1. ELKE opgegeven link MOET als HTML anchor in de tekst verschijnen
2. Format: <a href="/pad/naar/pagina">ankertekst</a>
3. Verwerk links op logische plekken (in keuzehulp, tips, of beschrijvende tekst)
4. De ankertekst mag aangepast worden om natuurlijk te lezen, maar de URL moet exact blijven
5. Controleer dat ALLE links zijn verwerkt voordat je de tekst aflevert`,
        user: `Schrijf een SEO-categoriebeschrijving voor Tegeldepot.nl.

Categorie: ${productName}
${keywords?.length ? `Zoekwoorden: ${keywords.join(', ')}` : ''}
${context ? `Extra context: ${context}` : ''}

=== VERPLICHTE INTERNE LINKS (ALLEMAAL VERWERKEN) ===
${internalLinks?.length ? internalLinks.map((link: { anchor: string; url: string }, index: number) => `${index + 1}. Ankertekst: "${link.anchor}" | URL: ${link.url}`).join('\n') : 'Geen links opgegeven'}

=== VEREISTE STRUCTUUR ===
1. <h1> + Intro (spreek vanuit Tegeldepot expertise)
2. Keuzehulp secties met <h2>/<h3> (help bezoeker kiezen)
3. Specialist tip sectie ("Tip van onze tegelexpert:")
4. Praktische tips (met sfeervolle beeldspraak)
5. VERWERK ELKE LINK als: <a href="URL">tekst</a>
6. FAQ sectie (2-3 unieke vragen, GEEN herhaling)
7. Afsluitende CTA paragraaf (leid naar producten)

⚠️ CONTROLE CHECKLIST:
- [ ] Alle ${internalLinks?.length || 0} links als <a href="...">...</a> verwerkt
- [ ] E-E-A-T: Expertise van Tegeldepot duidelijk
- [ ] Specialist tip aanwezig
- [ ] Sfeervolle beeldspraak toegevoegd
- [ ] Afsluitende CTA naar producten

Lever direct de HTML tekst.`
      }
    };

    const promptConfig = prompts[contentType];
    if (!promptConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retry logic for transient connection errors
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`AI request attempt ${attempt}/${maxRetries}`);
        
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
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt} failed:`, lastError.message);
        
        // Only retry on connection errors
        if (lastError.message.includes('Connection reset') || 
            lastError.message.includes('connection') ||
            lastError.message.includes('network')) {
          if (attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
        
        // Don't retry on other errors
        break;
      }
    }

    // All retries failed
    console.error('Content generation error after retries:', lastError);
    return new Response(
      JSON.stringify({ error: lastError?.message || 'Content generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Content generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Content generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
