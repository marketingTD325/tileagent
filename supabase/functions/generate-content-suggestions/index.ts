import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating content suggestions for user: ${user.id}`);

    // Fetch competitor content gaps
    const { data: analyses } = await supabaseClient
      .from('competitor_analyses')
      .select('content_gaps, top_keywords, analysis_data')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch tracked keywords without good rankings
    const { data: keywords } = await supabaseClient
      .from('keywords')
      .select('keyword, search_volume, position, category')
      .eq('is_tracking', true)
      .or('position.is.null,position.gt.10')
      .order('search_volume', { ascending: false })
      .limit(20);

    // Fetch existing calendar items to avoid duplicates
    const { data: existingItems } = await supabaseClient
      .from('content_calendar')
      .select('title, target_keywords')
      .eq('user_id', user.id);

    const existingTitles = new Set((existingItems || []).map(i => i.title.toLowerCase()));

    // Collect all content gaps and keywords
    const contentGaps: any[] = [];
    const topKeywords: any[] = [];
    
    for (const analysis of (analyses || [])) {
      if (analysis.content_gaps) {
        const gaps = Array.isArray(analysis.content_gaps) ? analysis.content_gaps : [];
        contentGaps.push(...gaps);
      }
      if (analysis.top_keywords) {
        const kws = Array.isArray(analysis.top_keywords) ? analysis.top_keywords : [];
        topKeywords.push(...kws);
      }
    }

    // Current date for context
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('nl-NL', { month: 'long' });
    const currentSeason = getSeasonNL();

    // Build AI prompt
    const prompt = `Je bent een senior SEO-strateeg voor tegeldepot.nl, een Nederlandse webshop voor tegels en badkamerproducten.

BELANGRIJK: Het is nu ${currentMonth} ${currentYear}. Gebruik ALLEEN ${currentYear} in alle titels en content. Gebruik NOOIT oude jaartallen.

## Jouw Taak
Analyseer de data en genereer 8-12 strategische content-suggesties die maximale SEO-impact opleveren.

## Beschikbare Data

### Content Gaps van Concurrenten:
${contentGaps.slice(0, 15).map(g => `- ${g.topic}: ${g.description} (kans: ${g.opportunity})`).join('\n') || '- Geen data beschikbaar'}

### Keywords waar we niet top 10 op staan:
${(keywords || []).slice(0, 15).map(k => `- "${k.keyword}" (volume: ${k.search_volume}, positie: ${k.position || 'niet gevonden'})`).join('\n') || '- Geen data beschikbaar'}

### Top Keywords van Concurrenten:
${topKeywords.slice(0, 15).map(k => `- "${k.keyword}" (geschat volume: ${k.searchVolume})`).join('\n') || '- Geen data beschikbaar'}

## Seizoenscontext
${currentMonth} ${currentYear} (${currentSeason}):
- Voorjaar: badkamer renovatie, voorjaarsschoonmaak
- Zomer: buitentegels, terras aanleggen
- Herfst: binnen verbouwen, voorbereiding winter
- Winter: inspiratie verzamelen, planning nieuw jaar

## Analyse Framework

### 1. Search Intent Classificatie
Classificeer elk keyword/topic naar zoekintentie:
- **Informational**: Gebruiker zoekt kennis ("hoe tegels leggen", "welke tegel voor badkamer")
- **Commercial Investigation**: Gebruiker vergelijkt opties ("beste badkamertegels", "tegels vergelijken")
- **Transactional**: Gebruiker wil kopen ("tegels kopen", "badkamertegels bestellen")
- **Navigational**: Gebruiker zoekt specifiek merk/product

### 2. Content Format Matching
Koppel het juiste format aan de intentie:
- **How-to Guide**: Voor "hoe..." vragen, stapsgewijze uitleg
- **Comparison/Versus**: Voor "beste...", "vs", vergelijkingsvragen
- **Listicle**: Voor "X tips", "X ideeën" onderwerpen
- **Buying Guide**: Voor aankoop-georiënteerde zoektermen
- **Inspiration Gallery**: Voor visuele onderwerpen ("badkamer inspiratie")
- **FAQ Page**: Voor veel gestelde vragen clusters
- **Category Description**: Voor product-gerelateerde hoofdtermen

### 3. Featured Snippet Kansen
Identificeer kansen voor Google featured snippets:
- **Paragraph snippet**: Definitie-vragen ("wat is...")
- **List snippet**: Stappen of opsommingen ("hoe...", "tips")
- **Table snippet**: Vergelijkingen, specificaties
- Markeer als featured_snippet_type in je output

### 4. ROI & Effort Scoring
Bereken voor elke suggestie:
- **effort_score** (1-10): Hoeveel werk kost het?
  - 1-3: Korte blogpost, simpele update
  - 4-6: Uitgebreide guide, meerdere secties
  - 7-10: Diepgaand onderzoek, veel visuals nodig
- **roi_potential** (1-10): Wat is de verwachte opbrengst?
  - Factoren: zoekvolume, commerciële waarde, huidige concurrentie, seizoensrelevantie
- **priority_score**: (roi_potential * 2 - effort_score) / 2, afgerond

### 5. Interne Linking Strategie
Suggereer per content-item:
- Welke bestaande categorieën/producten gelinkt moeten worden
- Welke gerelateerde content onderling gelinkt moet worden (content clusters)

## Output Vereisten
Elke suggestie moet bevatten:
- title: Pakkende titel met ${currentYear} waar relevant
- description: 2-3 zinnen over inhoud en aanpak
- content_type: "category" | "blog" | "landing_page" | "guide"
- content_format: "how-to" | "comparison" | "listicle" | "buying-guide" | "inspiration" | "faq" | "category-description"
- search_intent: "informational" | "commercial" | "transactional" | "navigational"
- target_keywords: array van 3-5 relevante keywords
- priority: "high" | "medium" | "low"
- opportunity_score: 1-100 (overall kans op succes)
- effort_score: 1-10 (benodigde effort)
- roi_potential: 1-10 (verwachte ROI)
- featured_snippet_type: "paragraph" | "list" | "table" | null
- internal_links: array van relevante interne link-suggesties (categorieën/producten)
- reasoning: Strategische onderbouwing van deze suggestie

## Prioritering
Sorteer output op impact:
1. Hoge ROI + lage effort eerst
2. Featured snippet kansen
3. Seizoensrelevante content
4. Content gaps waar concurrenten scoren`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling AI for content suggestions...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Je bent een SEO-strateeg. Geef alleen valid JSON terug, geen markdown of tekst eromheen.' },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'save_content_suggestions',
            description: 'Sla de gegenereerde content suggesties op',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      content_type: { type: 'string', enum: ['category', 'blog', 'landing_page', 'guide'] },
                      content_format: { type: 'string', enum: ['how-to', 'comparison', 'listicle', 'buying-guide', 'inspiration', 'faq', 'category-description'] },
                      search_intent: { type: 'string', enum: ['informational', 'commercial', 'transactional', 'navigational'] },
                      target_keywords: { type: 'array', items: { type: 'string' } },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      opportunity_score: { type: 'number' },
                      effort_score: { type: 'number' },
                      roi_potential: { type: 'number' },
                      featured_snippet_type: { type: 'string', enum: ['paragraph', 'list', 'table'], nullable: true },
                      internal_links: { type: 'array', items: { type: 'string' } },
                      reasoning: { type: 'string' }
                    },
                    required: ['title', 'description', 'content_type', 'content_format', 'search_intent', 'target_keywords', 'priority', 'opportunity_score', 'effort_score', 'roi_potential']
                  }
                }
              },
              required: ['suggestions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'save_content_suggestions' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit bereikt, probeer later opnieuw' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    let suggestions: any[] = [];
    
    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    if (suggestions.length === 0) {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          suggestions = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse content JSON:', e);
        }
      }
    }

    console.log(`Generated ${suggestions.length} suggestions`);

    // Filter out duplicates and insert new suggestions
    const newSuggestions = suggestions.filter(s => 
      !existingTitles.has(s.title.toLowerCase())
    );

    if (newSuggestions.length > 0) {
      const insertData = newSuggestions.map(s => ({
        user_id: user.id,
        title: s.title,
        description: s.description,
        content_type: s.content_type,
        target_keywords: s.target_keywords,
        priority: s.priority,
        opportunity_score: s.opportunity_score,
        source: 'ai_suggestion',
        source_data: { 
          reasoning: s.reasoning, 
          generated_at: new Date().toISOString(),
          content_format: s.content_format,
          search_intent: s.search_intent,
          effort_score: s.effort_score,
          roi_potential: s.roi_potential,
          featured_snippet_type: s.featured_snippet_type,
          internal_links: s.internal_links
        },
        status: 'suggested'
      }));

      const { error: insertError } = await supabaseClient
        .from('content_calendar')
        .insert(insertData);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      console.log(`Inserted ${newSuggestions.length} new suggestions`);
    }

    // Log activity
    await supabaseClient.from('activity_log').insert({
      user_id: user.id,
      action_type: 'content_suggestions',
      action_description: `AI genereerde ${newSuggestions.length} nieuwe content-suggesties`,
      metadata: { total: suggestions.length, new: newSuggestions.length, duplicates: suggestions.length - newSuggestions.length }
    });

    return new Response(JSON.stringify({
      success: true,
      total_generated: suggestions.length,
      new_added: newSuggestions.length,
      duplicates_skipped: suggestions.length - newSuggestions.length,
      suggestions: newSuggestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSeasonNL(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'lente';
  if (month >= 5 && month <= 7) return 'zomer';
  if (month >= 8 && month <= 10) return 'herfst';
  return 'winter';
}
