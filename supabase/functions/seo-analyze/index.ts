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
    // Accept metadata object explicitly from scraper
    const { url, pageContent, metadata, linkAnalysis, contentMetrics } = await req.json();

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

    // Build link analysis context if available
    let linkContext = '';
    if (linkAnalysis) {
      linkContext = `
LINK ANALYSE (vooraf berekend):
- Totaal links: ${linkAnalysis.total || 0}
- Interne links: ${linkAnalysis.internal || 0}
- Externe links: ${linkAnalysis.external || 0}
- Footer links: ${linkAnalysis.footerLinks || 0}
- ABC-index/alphabet links: ${linkAnalysis.abcIndexLinks || 0}
- Content links (excl. navigatie): ${linkAnalysis.contentLinks || 0}

BELANGRIJK: Tel voor de SEO-score alleen de "Content links" mee, niet de footer/ABC-index links!
`;
    }

    // Build content metrics context if available
    let metricsContext = '';
    if (contentMetrics) {
      metricsContext = `
CONTENT METRICS (vooraf berekend):
- Woorden: ${contentMetrics.wordCount || 0}
- Paragrafen: ${contentMetrics.paragraphCount || 0}
- Gemiddelde paragraaflengte: ${contentMetrics.avgParagraphLength || 0} woorden
- Zinnen: ${contentMetrics.sentenceCount || 0}
- Gemiddelde zinslengte: ${contentMetrics.avgSentenceLength || 0} woorden
- Headings: H1=${contentMetrics.headingStructure?.h1 || 0}, H2=${contentMetrics.headingStructure?.h2 || 0}, H3=${contentMetrics.headingStructure?.h3 || 0}
`;
    }

    const systemPrompt = `Je bent een expert SEO-analist voor Tegeldepot.nl.

${TEGELDEPOT_CONTEXT}

Analyseer de gegeven pagina-inhoud en geef een gedetailleerde SEO-audit.

BELANGRIJK: Antwoord ALLEEN met valid JSON, geen andere tekst.

${linkContext}
${metricsContext}

BEOORDEEL OP:
1. Title tag (lengte 50-60 karakters, zoekwoord vooraan)
2. Meta description (lengte 150-160 karakters, call-to-action)
   - LET OP: Als de meta description null of leeg is, geef dit expliciet aan als probleem!
   - Gebruik NOOIT body tekst als vervanging voor een ontbrekende meta description
3. Heading structuur (H1-H6 hiërarchie)
4. Content kwaliteit:
   - Volgt het de Tegeldepot tone of voice?
   - Is het oplossingsgericht met keuzehulp?
   - Geen vage algemeenheden?
   - Concrete praktische info?
5. Interne linking (voldoende voor de tekstlengte? Gebruik de CONTENT links, niet footer/abc)
6. E-E-A-T elementen (expertise, FAQ, etc.)
7. Afbeeldingen (alt-tags)
8. URL structuur
9. Schema markup mogelijkheden

SCOOR STRENG: Tegeldepot wil pragmatische, no-nonsense content die de klant echt helpt.

JSON formaat:
{
  "score": 0-100,
  "title": "gevonden title",
  "metaDescription": "gevonden meta description (null als niet gevonden)",
  "metaDescriptionMissing": true/false,
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
  "contentQuality": {
    "wordCount": ${contentMetrics?.wordCount || 0},
    "paragraphCount": ${contentMetrics?.paragraphCount || 0},
    "avgParagraphLength": ${contentMetrics?.avgParagraphLength || 0},
    "sentenceCount": ${contentMetrics?.sentenceCount || 0},
    "avgSentenceLength": ${contentMetrics?.avgSentenceLength || 0},
    "readabilityScore": 0-100,
    "readabilityLevel": "eenvoudig|gemiddeld|complex",
    "headingStructureValid": true/false,
    "headingIssues": ["lijst van heading problemen"]
  },
  "linkAnalysis": {
    "totalLinks": ${linkAnalysis?.total || 0},
    "internalLinks": ${linkAnalysis?.internal || 0},
    "externalLinks": ${linkAnalysis?.external || 0},
    "footerLinks": ${linkAnalysis?.footerLinks || 0},
    "abcIndexLinks": ${linkAnalysis?.abcIndexLinks || 0},
    "contentLinks": ${linkAnalysis?.contentLinks || 0},
    "isLinkingAdequate": true/false,
    "linkingFeedback": "feedback over de interne linking strategie"
  },
  "technicalData": {
    "titleLength": 0,
    "metaDescriptionLength": 0,
    "h1Count": ${contentMetrics?.headingStructure?.h1 || 0},
    "h2Count": ${contentMetrics?.headingStructure?.h2 || 0},
    "h3Count": ${contentMetrics?.headingStructure?.h3 || 0},
    "imageCount": 0,
    "imagesWithoutAlt": 0,
    "internalLinks": ${linkAnalysis?.contentLinks || linkAnalysis?.internal || 0},
    "externalLinks": ${linkAnalysis?.external || 0},
    "wordCount": ${contentMetrics?.wordCount || 0},
    "estimatedReadTime": "X min",
    "hasFaq": false,
    "hasStructuredData": false
  }
}`;

    // Truncate page content to avoid token limits (max ~4000 words)
    const truncatedContent = pageContent 
      ? pageContent.split(/\s+/).slice(0, 4000).join(' ') + (pageContent.split(/\s+/).length > 4000 ? '\n\n[Content truncated for analysis...]' : '')
      : 'Geen inhoud beschikbaar - analyseer alleen de URL structuur';

    console.log('Content stats:', {
      originalWords: pageContent?.split(/\s+/).length || 0,
      truncatedWords: truncatedContent.split(/\s+/).length,
      hasMetadata: !!metadata,
      metaTitle: metadata?.title?.substring(0, 30) || 'none',
      metaDesc: metadata?.description ? 'found' : 'missing'
    });

    const userPrompt = `Analyseer deze Tegeldepot.nl pagina voor SEO optimalisatie:

URL: ${url}

Gevonden Meta Data (via Scraper - NIET uit body text):
- Title: ${metadata?.title || 'Niet gevonden'}
- Description: ${metadata?.description || 'ONTBREEKT - geen meta description tag gevonden!'}

Pagina inhoud (Body):
${truncatedContent}

Wees kritisch en concreet. Geef specifieke verbeterpunten in de Tegeldepot tone of voice.
BELANGRIJK: De hierboven vermelde Title en Description komen rechtstreeks uit de HTML meta tags. Als Description "ONTBREEKT" is, dan heeft de pagina GEEN meta description tag en moet dit als kritiek probleem worden gerapporteerd.`;

    console.log('Sending request to AI gateway, prompt length:', userPrompt.length);

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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
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
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received:', {
      hasChoices: !!aiResponse.choices,
      choicesLength: aiResponse.choices?.length,
      hasContent: !!aiResponse.choices?.[0]?.message?.content,
      finishReason: aiResponse.choices?.[0]?.finish_reason
    });

    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Empty AI response:', JSON.stringify(aiResponse));
      // Return a fallback analysis instead of throwing
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            score: 0,
            title: metadata?.title || 'Onbekend',
            metaDescription: metadata?.description || null,
            metaDescriptionMissing: !metadata?.description,
            issues: [{ type: 'error', category: 'Analyse', message: 'AI analyse kon niet worden voltooid - probeer het opnieuw', priority: 'high' }],
            recommendations: [],
            toneOfVoiceScore: { pragmatisch: 0, oplossingsgericht: 0, concreet: 0, autoritair: 0, feedback: 'Analyse niet beschikbaar' },
            contentQuality: {
              wordCount: contentMetrics?.wordCount || 0,
              paragraphCount: contentMetrics?.paragraphCount || 0,
              avgParagraphLength: contentMetrics?.avgParagraphLength || 0,
              sentenceCount: contentMetrics?.sentenceCount || 0,
              avgSentenceLength: contentMetrics?.avgSentenceLength || 0,
              readabilityScore: null,
              readabilityLevel: null,
              headingStructureValid: null,
              headingIssues: []
            },
            linkAnalysis: linkAnalysis || null,
            technicalData: {
              titleLength: metadata?.title?.length || 0,
              metaDescriptionLength: metadata?.description?.length || 0,
              h1Count: contentMetrics?.headingStructure?.h1 || 0,
              h2Count: contentMetrics?.headingStructure?.h2 || 0,
              h3Count: contentMetrics?.headingStructure?.h3 || 0,
              wordCount: contentMetrics?.wordCount || 0
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        metaDescription: null,
        metaDescriptionMissing: true,
        issues: [{ type: 'error', category: 'Analyse', message: 'Kon de analyse niet voltooien', priority: 'high' }],
        recommendations: [],
        toneOfVoiceScore: { pragmatisch: 0, oplossingsgericht: 0, concreet: 0, autoritair: 0, feedback: '' },
        contentQuality: {
          wordCount: contentMetrics?.wordCount || 0,
          paragraphCount: contentMetrics?.paragraphCount || 0,
          avgParagraphLength: contentMetrics?.avgParagraphLength || 0,
          sentenceCount: contentMetrics?.sentenceCount || 0,
          avgSentenceLength: contentMetrics?.avgSentenceLength || 0,
          readabilityScore: null,
          readabilityLevel: null,
          headingStructureValid: null,
          headingIssues: []
        },
        linkAnalysis: linkAnalysis || null,
        technicalData: {}
      };
    }

    // ENFORCE HARD DATA: Overwrite AI's metrics with calculated values from scraper
    // This prevents AI "hallucinations" on quantitative data - AI only provides qualitative advice
    
    // 1. Overwrite contentQuality with hard facts from scraper
    analysis.contentQuality = {
      ...analysis.contentQuality, // Keep AI's qualitative fields (readabilityScore, readabilityLevel, etc.)
      // HARD DATA from scraper - never trust AI for these numbers:
      wordCount: contentMetrics?.wordCount || 0,
      paragraphCount: contentMetrics?.paragraphCount || 0,
      avgParagraphLength: contentMetrics?.avgParagraphLength || 0,
      sentenceCount: contentMetrics?.sentenceCount || 0,
      avgSentenceLength: contentMetrics?.avgSentenceLength || 0,
      headingStructure: contentMetrics?.headingStructure || { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    };
    
    // 2. Overwrite linkAnalysis with hard facts from Cheerio-based scraper
    if (linkAnalysis) {
      analysis.linkAnalysis = {
        // HARD DATA from Cheerio scraper:
        totalLinks: linkAnalysis.total,
        internalLinks: linkAnalysis.internal,
        externalLinks: linkAnalysis.external,
        footerLinks: linkAnalysis.footerLinks,
        abcIndexLinks: linkAnalysis.abcIndexLinks,
        contentLinks: linkAnalysis.contentLinks,
        // Keep AI's qualitative opinion on linking:
        isLinkingAdequate: analysis.linkAnalysis?.isLinkingAdequate ?? null,
        linkingFeedback: analysis.linkAnalysis?.linkingFeedback ?? null,
      };
    }
    
    // 3. Overwrite technicalData with hard facts
    analysis.technicalData = {
      ...analysis.technicalData,
      // Hard data from scraper:
      wordCount: contentMetrics?.wordCount || 0,
      h1Count: contentMetrics?.headingStructure?.h1 || 0,
      h2Count: contentMetrics?.headingStructure?.h2 || 0,
      h3Count: contentMetrics?.headingStructure?.h3 || 0,
      internalLinks: linkAnalysis?.contentLinks || linkAnalysis?.internal || 0,
      externalLinks: linkAnalysis?.external || 0,
      titleLength: metadata?.title?.length || analysis.title?.length || 0,
      metaDescriptionLength: metadata?.description?.length || analysis.metaDescription?.length || 0,
    };

    console.log('Hard data enforced - AI qualitative, Scraper quantitative:', {
      wordCount: analysis.contentQuality.wordCount,
      contentLinks: analysis.linkAnalysis?.contentLinks,
      h1Count: analysis.technicalData.h1Count
    });

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
