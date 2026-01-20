import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { analyzeCompetitor, scrapePage } from '@/lib/api';
import { Loader2, Users, Plus, Trash2, ExternalLink, TrendingUp, AlertTriangle } from 'lucide-react';

interface CompetitorAnalysis {
  visibilityScore: number;
  strengths: string[];
  weaknesses: string[];
  topKeywords: Array<{ keyword: string; estimatedPosition: number; searchVolume: number }>;
  contentGaps: Array<{ topic: string; opportunity: string; description: string }>;
  recommendations: Array<{ action: string; priority: string; impact: string }>;
}

export default function Competitors() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [newCompetitorDomain, setNewCompetitorDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadCompetitors();
  }, [user]);

  const loadCompetitors = async () => {
    try {
      const { data } = await supabase
        .from('competitors')
        .select('*, competitor_analyses(*)')
        .order('created_at', { ascending: false });
      setCompetitors(data || []);
    } catch (error) {
      console.error('Failed to load competitors:', error);
    }
  };

  const addCompetitor = async () => {
    if (!newCompetitorName.trim() || !newCompetitorDomain.trim()) {
      toast({ title: 'Fout', description: 'Vul naam en domein in', variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
      await supabase.from('competitors').insert({
        user_id: user!.id,
        name: newCompetitorName,
        domain: newCompetitorDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      });
      
      setNewCompetitorName('');
      setNewCompetitorDomain('');
      setDialogOpen(false);
      loadCompetitors();
      toast({ title: 'Concurrent toegevoegd!' });
    } catch (error) {
      console.error('Failed to add competitor:', error);
      toast({ title: 'Fout', description: 'Kon concurrent niet toevoegen', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const deleteCompetitor = async (id: string) => {
    try {
      await supabase.from('competitors').delete().eq('id', id);
      loadCompetitors();
      toast({ title: 'Concurrent verwijderd' });
    } catch (error) {
      console.error('Failed to delete competitor:', error);
    }
  };

  const analyzeCompetitorFn = async (competitor: any) => {
    setIsAnalyzing(competitor.id);

    try {
      // Try to scrape the competitor's homepage
      toast({ title: 'Analyseren...', description: 'Concurrent website ophalen' });
      let pageContent = '';
      
      try {
        const scrapeResult = await scrapePage(`https://${competitor.domain}`);
        if (scrapeResult.success) {
          pageContent = scrapeResult.data?.markdown || '';
        }
      } catch (e) {
        console.log('Could not scrape competitor, analyzing based on domain only');
      }

      const result = await analyzeCompetitor(competitor.domain, pageContent, competitor.name);

      if (result.success && result.data) {
        // Save analysis
        await supabase.from('competitor_analyses').insert({
          competitor_id: competitor.id,
          user_id: user!.id,
          visibility_score: result.data.visibilityScore,
          keyword_overlap: result.data.keywordOverlap,
          content_gaps: result.data.contentGaps,
          top_keywords: result.data.topKeywords,
          analysis_data: result.data,
        });

        // Log activity
        await supabase.from('activity_log').insert({
          user_id: user!.id,
          action_type: 'competitor_analysis',
          action_description: `Concurrent geanalyseerd: ${competitor.name}`,
          resource_type: 'competitor',
          resource_id: competitor.id,
        });

        loadCompetitors();
        setSelectedAnalysis(result.data);
        toast({ title: 'Analyse voltooid!' });
      } else {
        throw new Error(result.error || 'Analyse mislukt');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({ 
        title: 'Analyse mislukt', 
        description: error.message || 'Er ging iets mis.',
        variant: 'destructive' 
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const getLatestAnalysis = (competitor: any): CompetitorAnalysis | null => {
    const analyses = competitor.competitor_analyses || [];
    if (analyses.length === 0) return null;
    return analyses[0].analysis_data;
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Concurrent Analyse</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Analyseer en vergelijk SEO-prestaties van concurrenten
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="sm:hidden">Toevoegen</span>
                <span className="hidden sm:inline">Concurrent Toevoegen</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nieuwe Concurrent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Naam</Label>
                  <Input
                    placeholder="bijv. Tegeloutlet"
                    value={newCompetitorName}
                    onChange={(e) => setNewCompetitorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    placeholder="bijv. tegeloutlet.nl"
                    value={newCompetitorDomain}
                    onChange={(e) => setNewCompetitorDomain(e.target.value)}
                  />
                </div>
                <Button onClick={addCompetitor} disabled={isAdding} className="w-full">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Toevoegen'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {competitors.length === 0 ? (
          <Card>
            <CardContent className="py-8 md:py-12 text-center">
              <Users className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-base md:text-lg font-semibold mb-2">Nog geen concurrenten</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Voeg concurrenten toe om hun SEO-prestaties te analyseren
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Eerste Concurrent Toevoegen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {competitors.map((competitor) => {
              const analysis = getLatestAnalysis(competitor);
              
              return (
                <Card key={competitor.id}>
                  <CardHeader className="pb-2 md:pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base md:text-lg truncate">{competitor.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs md:text-sm">
                          <span className="truncate">{competitor.domain}</span>
                          <a 
                            href={`https://${competitor.domain}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-primary shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => deleteCompetitor(competitor.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 md:space-y-4">
                    {analysis ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs md:text-sm text-muted-foreground">Visibility Score</span>
                            <span className="font-bold text-sm md:text-base">{analysis.visibilityScore}</span>
                          </div>
                          <Progress value={analysis.visibilityScore} />
                        </div>
                        
                        {analysis.contentGaps?.slice(0, 2).map((gap, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs md:text-sm">
                            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-accent shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{gap.topic}</span>
                          </div>
                        ))}
                        
                        <Button 
                          variant="outline" 
                          className="w-full text-sm"
                          onClick={() => setSelectedAnalysis(analysis)}
                        >
                          Bekijk Volledige Analyse
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground text-center py-3 md:py-4">
                        Nog niet geanalyseerd
                      </p>
                    )}
                    
                    <Button 
                      className="w-full text-sm"
                      onClick={() => analyzeCompetitorFn(competitor)}
                      disabled={isAnalyzing === competitor.id}
                    >
                      {isAnalyzing === competitor.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          <span className="hidden sm:inline">Analyseren...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          {analysis ? 'Opnieuw' : 'Analyseren'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Analysis Detail Modal */}
        {selectedAnalysis && (
          <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Concurrent Analyse</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 pt-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">{selectedAnalysis.visibilityScore}</p>
                  <p className="text-muted-foreground">Visibility Score</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-green-600">Sterke Punten</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedAnalysis.strengths?.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Zwakke Punten</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedAnalysis.weaknesses?.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Content Gaps (Kansen)</h4>
                  <div className="space-y-2">
                    {selectedAnalysis.contentGaps?.map((gap, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{gap.topic}</span>
                          <Badge variant={gap.opportunity === 'hoog' ? 'default' : 'secondary'}>
                            {gap.opportunity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{gap.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Aanbevelingen</h4>
                  <div className="space-y-2">
                    {selectedAnalysis.recommendations?.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg border">
                        <Badge variant={rec.priority === 'hoog' ? 'destructive' : 'outline'}>
                          {rec.priority}
                        </Badge>
                        <p className="text-sm">{rec.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
