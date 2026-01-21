import { supabase } from '@/integrations/supabase/client';

export interface RankCheckResult {
  keyword: string;
  position: number | null;
  url: string | null;
  title: string | null;
  snippet: string | null;
  found: boolean;
}

export interface RankHistory {
  id: string;
  keyword_id: string;
  position: number | null;
  url: string | null;
  title: string | null;
  checked_at: string;
}

export interface KeywordWithRanking {
  id: string;
  keyword: string;
  position: number | null;
  previous_position: number | null;
  target_domain: string | null;
  last_checked: string | null;
  is_tracking: boolean;
  category: string | null;
}

/**
 * Check ranking for a single keyword
 */
export async function checkKeywordRanking(
  keywordId: string,
  keyword: string,
  targetDomain: string,
  location = 'Netherlands',
  device = 'desktop'
): Promise<{ success: boolean; result?: RankCheckResult; error?: string }> {
  const { data, error } = await supabase.functions.invoke('check-rankings', {
    body: {
      keywordId,
      keyword,
      targetDomain,
      location,
      device,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Get ranking history for a keyword
 */
export async function getKeywordRankingHistory(
  keywordId: string,
  limit = 30
): Promise<RankHistory[]> {
  const { data, error } = await supabase
    .from('rank_tracking_history')
    .select('*')
    .eq('keyword_id', keywordId)
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching ranking history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all tracked keywords with their current rankings
 */
export async function getTrackedKeywords(): Promise<KeywordWithRanking[]> {
  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .eq('is_tracking', true)
    .order('keyword', { ascending: true });

  if (error) {
    console.error('Error fetching tracked keywords:', error);
    return [];
  }

  return data || [];
}

/**
 * Add a keyword for tracking
 */
export async function addTrackedKeyword(
  keyword: string,
  targetDomain: string,
  category?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('keywords')
    .insert([{
      user_id: user.id,
      keyword,
      target_domain: targetDomain,
      category,
      is_tracking: true,
    }])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * Remove a keyword from tracking
 */
export async function removeTrackedKeyword(keywordId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', keywordId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update target domain for a keyword
 */
export async function updateKeywordDomain(
  keywordId: string,
  targetDomain: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('keywords')
    .update({ target_domain: targetDomain })
    .eq('id', keywordId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Batch check rankings for multiple keywords
 */
export async function batchCheckRankings(
  keywords: { id: string; keyword: string; targetDomain: string }[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{ success: number; failed: number; results: RankCheckResult[] }> {
  const results: RankCheckResult[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    onProgress?.(i, keywords.length, kw.keyword);

    const result = await checkKeywordRanking(kw.id, kw.keyword, kw.targetDomain);
    
    if (result.success && result.result) {
      results.push(result.result);
      success++;
    } else {
      failed++;
    }

    // Delay between requests to avoid rate limiting
    if (i < keywords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { success, failed, results };
}

/**
 * Calculate position change
 */
export function getPositionChange(current: number | null, previous: number | null): {
  direction: 'up' | 'down' | 'same' | 'new' | 'lost';
  change: number;
} {
  if (current === null && previous === null) {
    return { direction: 'same', change: 0 };
  }
  if (current === null) {
    return { direction: 'lost', change: 0 };
  }
  if (previous === null) {
    return { direction: 'new', change: 0 };
  }
  
  const change = previous - current; // Positive means improved (lower position is better)
  
  if (change > 0) {
    return { direction: 'up', change };
  }
  if (change < 0) {
    return { direction: 'down', change: Math.abs(change) };
  }
  return { direction: 'same', change: 0 };
}
