import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { researchKeywords } from '@/lib/api';
import { Loader2, TrendingUp, Plus, Trash2, Lightbulb, ArrowUpDown } from 'lucide-react';

interface Keyword {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  category: string;
  intent: string;
  contentSuggestion?: string;
  priority?: string;
}

interface ContentIdea {
  title: string;
  keywords: string[];
  type: string;
}

export default function KeywordResearch() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [seedKeyword, setSeedKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  const [insights, setInsights] = useState('');
  const [savedKeywords, setSavedKeywords] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'volume' | 'difficulty'>('volume');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadSavedKeywords();
  }, [user]);

  const loadSavedKeywords = async () => {
    try {
      const { data } = await supabase
        .from('keywords')
        .select('*')
        .eq('is_tracking', true)
        .order('created_at', { ascending: false });
      setSavedKeywords(data || []);
    } catch (error) {
      console.error('Failed to load keywords:', error);
    }
  };

  const handleResearch = async () => {
    if (!seedKeyword.trim()) {
      toast({ title: 'Fout', description: 'Vul een zoekwoord in', variant: 'destructive' });
      return;
    }

    setIsResearching(true);
    setKeywords([]);
    setContentIdeas([]);
    setInsights('');

    try {
      const result = await researchKeywords(seedKeyword, category || undefined);

      if (result.success && result.data) {
        setKeywords(result.data.keywords || []);
        setContentIdeas(result.data.contentIdeas || []);
        setInsights(result.data.insights || '');

        // Log activity
        await supabase.from('activity_log').insert({
          user_id: user!.id,
          action_type: 'keyword_research',
          action_description: `Keyword research: ${seedKeyword}`,
          resource_type: 'keywords',
        });

        toast({ title: 'Research voltooid!', description: `${result.data.keywords?.length || 0} zoekwoorden gevonden` });
      } else {
        throw new Error(result.error || 'Research mislukt');
      }
    } catch (error: any) {
      console.error('Research error:', error);
      toast({ 
        title: 'Research mislukt', 
        description: error.message || 'Er ging iets mis.',
        variant: 'destructive' 
      });
    } finally {
      setIsResearching(false);
    }
  };

  const saveKeyword = async (kw: Keyword) => {
    try {
      await supabase.from('keywords').insert({
        user_id: user!.id,
        keyword: kw.keyword,
        search_volume: kw.searchVolume,
        difficulty: kw.difficulty,
        category: kw.category,
        is_tracking: true,
      });
      loadSavedKeywords();
      toast({ title: 'Opgeslagen!', description: `"${kw.keyword}" toegevoegd aan je lijst` });
    } catch (error) {
      console.error('Failed to save keyword:', error);
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      await supabase.from('keywords').delete().eq('id', id);
      loadSavedKeywords();
    } catch (error) {
      console.error('Failed to remove keyword:', error);
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 30) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (difficulty <= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const getIntentColor = (intent: string) => {
    if (intent === 'transactional') return 'default';
    if (intent === 'commercial') return 'secondary';
    return 'outline';
  };

  const sortedKeywords = [...keywords].sort((a, b) => {
    if (sortBy === 'volume') return b.searchVolume - a.searchVolume;
    return a.difficulty - b.difficulty;
  });

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Keyword Research</h1>
          <p className="text-muted-foreground mt-1">
            Vind relevante zoekwoorden voor de Nederlandse tegels en badkamer markt
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Search Form */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="bijv. betonlook tegels, badkamer renovatie, vloertegels"
                      value={seedKeyword}
                      onChange={(e) => setSeedKeyword(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <Input
                    placeholder="Categorie (optioneel)"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-48 h-12"
                  />
                  <Button 
                    onClick={handleResearch} 
                    disabled={isResearching}
                    size="lg"
                    className="h-12"
                  >
                    {isResearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {keywords.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Zoekwoorden ({keywords.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortBy(sortBy === 'volume' ? 'difficulty' : 'volume')}
                    >
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Sorteer op {sortBy === 'volume' ? 'moeilijkheid' : 'volume'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sortedKeywords.map((kw, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{kw.keyword}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getIntentColor(kw.intent)}>{kw.intent}</Badge>
                            <Badge variant="outline">{kw.category}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold">{kw.searchVolume.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">maand</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(kw.difficulty)}`}>
                            {kw.difficulty}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveKeyword(kw)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content Ideas */}
            {contentIdeas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-accent" />
                    Content Ideeën
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {contentIdeas.map((idea, i) => (
                      <div key={i} className="p-4 rounded-lg border">
                        <p className="font-medium">{idea.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge>{idea.type}</Badge>
                          {idea.keywords?.slice(0, 3).map((kw, j) => (
                            <Badge key={j} variant="outline">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Insights */}
            {insights && (
              <Card>
                <CardHeader>
                  <CardTitle>Inzichten</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{insights}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Saved Keywords Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Opgeslagen Zoekwoorden</CardTitle>
                <CardDescription>{savedKeywords.length} zoekwoorden</CardDescription>
              </CardHeader>
              <CardContent>
                {savedKeywords.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nog geen zoekwoorden opgeslagen
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {savedKeywords.map((kw) => (
                      <div 
                        key={kw.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-sm">{kw.keyword}</p>
                          <p className="text-xs text-muted-foreground">
                            {kw.search_volume?.toLocaleString() || '?'}/maand
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeKeyword(kw.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
