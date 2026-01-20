import { supabase } from '@/integrations/supabase/client';

// SEO Analyze API
export async function analyzePageSeo(url: string, pageContent?: string) {
  const { data, error } = await supabase.functions.invoke('seo-analyze', {
    body: { url, pageContent }
  });
  
  if (error) throw error;
  return data;
}

// Content Generation API
export async function generateContent(params: {
  contentType: 'product_description' | 'blog_post' | 'meta_tags' | 'category_description' | 'category_with_links';
  productName: string;
  keywords?: string[];
  context?: string;
  tone?: string;
  internalLinks?: { anchor: string; url: string }[];
  existingContent?: string;
  mode?: 'full' | 'inject_links';
}) {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: params
  });
  
  if (error) throw error;
  return data;
}

// Keyword Research API
export async function researchKeywords(seedKeyword: string, category?: string) {
  const { data, error } = await supabase.functions.invoke('keyword-research', {
    body: { seedKeyword, category }
  });
  
  if (error) throw error;
  return data;
}

// Competitor Analysis API
export async function analyzeCompetitor(competitorDomain: string, pageContent?: string, competitorName?: string) {
  const { data, error } = await supabase.functions.invoke('analyze-competitor', {
    body: { competitorDomain, pageContent, competitorName }
  });
  
  if (error) throw error;
  return data;
}

// Scrape Page API
export async function scrapePage(url: string) {
  const { data, error } = await supabase.functions.invoke('scrape-page', {
    body: { url }
  });
  
  if (error) throw error;
  return data;
}

// Fetch Sitemap API
export interface SitemapUrl {
  url: string;
  path: string;
  suggestedAnchor: string;
}

export async function fetchSitemap(domain: string, search?: string, limit?: number) {
  const { data, error } = await supabase.functions.invoke('fetch-sitemap', {
    body: { domain, search, limit }
  });
  
  if (error) throw error;
  return data as { success: boolean; urls: SitemapUrl[]; total: number; error?: string };
}
