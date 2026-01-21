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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { analyzeCompetitor } from '@/lib/api';
import { 
  Loader2, Users, Plus, Trash2, ExternalLink, TrendingUp, AlertTriangle,
  Target, FileText, Settings, BarChart3, Zap, CheckCircle, XCircle,
  Globe, Search, Lightbulb, ArrowRight, PlayCircle
} from 'lucide-react';

interface ExtendedCompetitorAnalysis {
  visibilityScore: number;
  strengths: string[];
  weaknesses: string[];
  topKeywords: Array<{ keyword: string; estimatedPosition: number; searchVolume: number; difficulty?: string }>;
  contentGaps: Array<{ topic: string; opportunity: string; description: string; suggestedAction?: string }>;
  keywordOverlap: Array<{ keyword: string; competitorPosition: number; ourEstimatedPosition: number }>;
  recommendations: Array<{ action: string; priority: string; impact: string; effort?: string }>;
  analysisData: {
    estimatedMonthlyTraffic: number;
    estimatedKeywordCount: number;
    contentQualityScore: number;
    technicalSeoScore: number;
    mobileScore?: number;
    pageSpeedIndicator?: string;
    contentFreshness?: string;
    domainAuthority?: number;
    totalPages?: number;
    avgContentLength?: number;
  };
  technicalSeo?: {
    hasHttps: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    metaDescriptions: number;
    h1Tags: number;
    imageAltTags: string;
    structuredData: boolean;
    canonicalTags: boolean;
  };
  contentStrategy?: {
    blogPresent: boolean;
    productCategories: string[];
    contentTypes: string[];
    updateFrequency: string;
    avgWordCount: number;
    uniqueSellingPoints: string[];
  };
  competitivePosition?: {
    marketPosition: string;
    pricePositioning: string;
    targetAudience: string;
    geographicFocus: string;
    brandStrength: string;
  };
  _metadata?: {
    analysisDate: string;
    pagesScraped: number;
    totalPagesFound: number;
    deepAnalysis: boolean;
  };
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
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [selectedAnalysis, setSelectedAnalysis] = useState<ExtendedCompetitorAnalysis | null>(null);
  const [selectedCompetitorName, setSelectedCompetitorName] = useState('');
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
      await supabase.from('competitor_analyses').delete().eq('competitor_id', id);
      await supabase.from('competitors').delete().eq('id', id);
      loadCompetitors();
      toast({ title: 'Concurrent verwijderd' });
    } catch (error) {
      console.error('Failed to delete competitor:', error);
    }
  };

  const analyzeCompetitorFn = async (competitor: any, showToast = true) => {
    setIsAnalyzing(competitor.id);

    try {
      if (showToast) {
        toast({ title: 'Uitgebreide analyse gestart...', description: `${competitor.name} wordt gescraped en geanalyseerd` });
      }

      const result = await analyzeCompetitor(competitor.domain, '', competitor.name);

      if (result.success && result.data) {
        // Delete old analyses first
        await supabase.from('competitor_analyses').delete().eq('competitor_id', competitor.id);
        
        // Save new analysis
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
          action_description: `Uitgebreide analyse: ${competitor.name}`,
          resource_type: 'competitor',
          resource_id: competitor.id,
        });

        loadCompetitors();
        
        if (showToast) {
          toast({ title: 'Analyse voltooid!', description: `${result.data._metadata?.pagesScraped || 0} pagina's geanalyseerd` });
        }
        
        return result.data;
      } else {
        throw new Error(result.error || 'Analyse mislukt');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      if (showToast) {
        toast({ 
          title: 'Analyse mislukt', 
          description: error.message || 'Er ging iets mis.',
          variant: 'destructive' 
        });
      }
      return null;
    } finally {
      setIsAnalyzing(null);
    }
  };

  const runBulkAnalysis = async () => {
    const competitorsToAnalyze = competitors.filter(c => c.domain !== 'www.tegeldepot.nl');
    
    if (competitorsToAnalyze.length === 0) {
      toast({ title: 'Geen concurrenten', description: 'Voeg eerst concurrenten toe om te analyseren', variant: 'destructive' });
      return;
    }

    setIsBulkAnalyzing(true);
    setBulkProgress({ current: 0, total: competitorsToAnalyze.length, currentName: '' });

    toast({ 
      title: 'Bulk analyse gestart', 
      description: `${competitorsToAnalyze.length} concurrenten worden geanalyseerd. Dit kan enkele minuten duren.` 
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < competitorsToAnalyze.length; i++) {
      const competitor = competitorsToAnalyze[i];
      setBulkProgress({ current: i + 1, total: competitorsToAnalyze.length, currentName: competitor.name });
      
      const result = await analyzeCompetitorFn(competitor, false);
      
      if (result) {
        successCount++;
      } else {
        failCount++;
      }

      // Wait between analyses to avoid rate limiting
      if (i < competitorsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsBulkAnalyzing(false);
    setBulkProgress({ current: 0, total: 0, currentName: '' });

    toast({ 
      title: 'Bulk analyse voltooid!', 
      description: `${successCount} geslaagd, ${failCount} mislukt` 
    });
  };

  const getLatestAnalysis = (competitor: any): ExtendedCompetitorAnalysis | null => {
    const analyses = competitor.competitor_analyses || [];
    if (analyses.length === 0) return null;
    return analyses[0].analysis_data;
  };

  const openAnalysisDetail = (competitor: any) => {
    const analysis = getLatestAnalysis(competitor);
    if (analysis) {
      setSelectedAnalysis(analysis);
      setSelectedCompetitorName(competitor.name);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBadgeVariant = (value: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (value === 'hoog' || value === 'sterk' || value === 'premium') return 'default';
    if (value === 'laag' || value === 'zwak' || value === 'budget') return 'destructive';
    return 'secondary';
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Concurrent Analyse</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Uitgebreide SEO-analyse van {competitors.length} concurrenten
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={runBulkAnalysis}
              disabled={isBulkAnalyzing || competitors.length === 0}
              className="w-full sm:w-auto"
            >
              {isBulkAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Analyseer Alles
                </>
              )}
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Toevoegen</span>
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
        </div>

        {/* Bulk Progress Indicator */}
        {isBulkAnalyzing && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Analyseren: {bulkProgress.currentName}</p>
                  <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="mt-2" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {competitors.map((competitor) => {
              const analysis = getLatestAnalysis(competitor);
              
              return (
                <Card key={competitor.id} className={analysis ? 'border-l-4 border-l-primary' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{competitor.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
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
                        className="h-7 w-7 shrink-0"
                        onClick={() => deleteCompetitor(competitor.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className={`text-lg font-bold ${getScoreColor(analysis.visibilityScore)}`}>
                              {analysis.visibilityScore}
                            </p>
                            <p className="text-xs text-muted-foreground">Visibility</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className={`text-lg font-bold ${getScoreColor(analysis.analysisData?.technicalSeoScore || 0)}`}>
                              {analysis.analysisData?.technicalSeoScore || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">Tech SEO</p>
                          </div>
                        </div>
                        
                        {analysis._metadata && (
                          <p className="text-xs text-muted-foreground text-center">
                            {analysis._metadata.pagesScraped} pagina's • {new Date(analysis._metadata.analysisDate).toLocaleDateString('nl-NL')}
                          </p>
                        )}
                        
                        <Button 
                          variant="outline" 
                          className="w-full text-sm"
                          onClick={() => openAnalysisDetail(competitor)}
                        >
                          Bekijk Details
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nog niet geanalyseerd
                      </p>
                    )}
                    
                    <Button 
                      className="w-full text-sm"
                      size="sm"
                      onClick={() => analyzeCompetitorFn(competitor)}
                      disabled={isAnalyzing === competitor.id || isBulkAnalyzing}
                    >
                      {isAnalyzing === competitor.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Analyseren...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-3.5 w-3.5 mr-2" />
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

        {/* Extended Analysis Detail Modal */}
        {selectedAnalysis && (
          <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl">Analyse: {selectedCompetitorName}</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mx-6 grid grid-cols-5">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">
                    <BarChart3 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                    Overzicht
                  </TabsTrigger>
                  <TabsTrigger value="technical" className="text-xs sm:text-sm">
                    <Settings className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                    Technisch
                  </TabsTrigger>
                  <TabsTrigger value="content" className="text-xs sm:text-sm">
                    <FileText className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="keywords" className="text-xs sm:text-sm">
                    <Search className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                    Keywords
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="text-xs sm:text-sm">
                    <Lightbulb className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                    Acties
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[60vh] px-6 pb-6">
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className={`text-3xl font-bold ${getScoreColor(selectedAnalysis.visibilityScore)}`}>
                            {selectedAnalysis.visibilityScore}
                          </p>
                          <p className="text-sm text-muted-foreground">Visibility Score</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className={`text-3xl font-bold ${getScoreColor(selectedAnalysis.analysisData?.technicalSeoScore || 0)}`}>
                            {selectedAnalysis.analysisData?.technicalSeoScore || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Tech SEO</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className={`text-3xl font-bold ${getScoreColor(selectedAnalysis.analysisData?.contentQualityScore || 0)}`}>
                            {selectedAnalysis.analysisData?.contentQualityScore || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Content</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-primary">
                            {selectedAnalysis.analysisData?.domainAuthority || '-'}
                          </p>
                          <p className="text-sm text-muted-foreground">Authority</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Sterke Punten
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {selectedAnalysis.strengths?.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Zap className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-red-600 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Zwakke Punten
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {selectedAnalysis.weaknesses?.map((w, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedAnalysis.competitivePosition && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Marktpositie</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Segment</p>
                              <Badge variant={getBadgeVariant(selectedAnalysis.competitivePosition.marketPosition)}>
                                {selectedAnalysis.competitivePosition.marketPosition}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Prijsniveau</p>
                              <Badge variant={getBadgeVariant(selectedAnalysis.competitivePosition.pricePositioning)}>
                                {selectedAnalysis.competitivePosition.pricePositioning}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Merksterkte</p>
                              <Badge variant={getBadgeVariant(selectedAnalysis.competitivePosition.brandStrength)}>
                                {selectedAnalysis.competitivePosition.brandStrength}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Focus</p>
                              <Badge variant="outline">{selectedAnalysis.competitivePosition.geographicFocus}</Badge>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-muted-foreground">Doelgroep</p>
                              <p className="text-xs mt-1">{selectedAnalysis.competitivePosition.targetAudience}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Technical Tab */}
                  <TabsContent value="technical" className="space-y-6 mt-4">
                    {selectedAnalysis.technicalSeo && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Technische SEO Checks</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                              {selectedAnalysis.technicalSeo.hasHttps ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-sm">HTTPS</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedAnalysis.technicalSeo.hasSitemap ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-sm">Sitemap</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedAnalysis.technicalSeo.hasRobotsTxt ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-sm">Robots.txt</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedAnalysis.technicalSeo.structuredData ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-sm">Schema.org</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedAnalysis.technicalSeo.canonicalTags ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-sm">Canonicals</span>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Meta Desc.</p>
                              <Progress value={selectedAnalysis.technicalSeo.metaDescriptions} className="h-2 mt-1" />
                              <p className="text-xs text-right">{selectedAnalysis.technicalSeo.metaDescriptions}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">H1 Tags</p>
                              <Progress value={selectedAnalysis.technicalSeo.h1Tags} className="h-2 mt-1" />
                              <p className="text-xs text-right">{selectedAnalysis.technicalSeo.h1Tags}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Alt Tags</p>
                              <Badge variant={getBadgeVariant(selectedAnalysis.technicalSeo.imageAltTags)}>
                                {selectedAnalysis.technicalSeo.imageAltTags}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Performance Indicatoren</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Page Speed</p>
                            <Badge variant={getBadgeVariant(selectedAnalysis.analysisData?.pageSpeedIndicator || 'gemiddeld')}>
                              {selectedAnalysis.analysisData?.pageSpeedIndicator || 'onbekend'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Mobile Score</p>
                            <p className={`text-xl font-bold ${getScoreColor(selectedAnalysis.analysisData?.mobileScore || 0)}`}>
                              {selectedAnalysis.analysisData?.mobileScore || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Totaal Pagina's</p>
                            <p className="text-xl font-bold">{selectedAnalysis.analysisData?.totalPages || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Est. Keywords</p>
                            <p className="text-xl font-bold">{selectedAnalysis.analysisData?.estimatedKeywordCount || '-'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Content Tab */}
                  <TabsContent value="content" className="space-y-6 mt-4">
                    {selectedAnalysis.contentStrategy && (
                      <>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Content Strategie</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Blog Aanwezig</p>
                                {selectedAnalysis.contentStrategy.blogPresent ? (
                                  <Badge variant="default">Ja</Badge>
                                ) : (
                                  <Badge variant="secondary">Nee</Badge>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Update Frequentie</p>
                                <Badge variant="outline">{selectedAnalysis.contentStrategy.updateFrequency}</Badge>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Gem. Woorden</p>
                                <p className="text-xl font-bold">{selectedAnalysis.contentStrategy.avgWordCount || '-'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Content Versheid</p>
                                <Badge variant={getBadgeVariant(selectedAnalysis.analysisData?.contentFreshness || 'redelijk')}>
                                  {selectedAnalysis.analysisData?.contentFreshness || 'onbekend'}
                                </Badge>
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <p className="text-sm font-medium mb-2">Content Types</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedAnalysis.contentStrategy.contentTypes?.map((type, i) => (
                                  <Badge key={i} variant="outline">{type}</Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-medium mb-2">Product Categorieën</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedAnalysis.contentStrategy.productCategories?.map((cat, i) => (
                                  <Badge key={i} variant="secondary">{cat}</Badge>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Unique Selling Points</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {selectedAnalysis.contentStrategy.uniqueSellingPoints?.map((usp, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <span>{usp}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Content Gaps (Kansen voor jou)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {selectedAnalysis.contentGaps?.map((gap, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-muted/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{gap.topic}</span>
                                <Badge variant={getBadgeVariant(gap.opportunity)}>
                                  {gap.opportunity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{gap.description}</p>
                              {gap.suggestedAction && (
                                <p className="text-sm text-primary mt-2 flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  {gap.suggestedAction}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Keywords Tab */}
                  <TabsContent value="keywords" className="space-y-6 mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Top Keywords</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedAnalysis.topKeywords?.map((kw, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-muted-foreground w-6">#{kw.estimatedPosition}</span>
                                <span className="font-medium">{kw.keyword}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                  {kw.searchVolume?.toLocaleString()} zoekvolume
                                </span>
                                {kw.difficulty && (
                                  <Badge variant={getBadgeVariant(kw.difficulty)} className="text-xs">
                                    {kw.difficulty}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {selectedAnalysis.keywordOverlap && selectedAnalysis.keywordOverlap.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Keyword Overlap met Tegeldepot</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedAnalysis.keywordOverlap.map((kw, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                                <span className="font-medium">{kw.keyword}</span>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className={kw.competitorPosition < kw.ourEstimatedPosition ? 'text-red-500' : 'text-green-500'}>
                                    Concurrent: #{kw.competitorPosition}
                                  </span>
                                  <span className={kw.ourEstimatedPosition < kw.competitorPosition ? 'text-green-500' : 'text-red-500'}>
                                    Wij: #{kw.ourEstimatedPosition}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Actions Tab */}
                  <TabsContent value="actions" className="space-y-6 mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Aanbevelingen</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {selectedAnalysis.recommendations?.map((rec, i) => (
                            <div key={i} className="p-3 rounded-lg border">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-medium">{rec.action}</p>
                                <div className="flex gap-1 shrink-0">
                                  <Badge variant={rec.priority === 'hoog' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                                    {rec.priority}
                                  </Badge>
                                  {rec.effort && (
                                    <Badge variant="outline">
                                      {rec.effort} effort
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{rec.impact}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {selectedAnalysis._metadata && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Analyse Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Datum</p>
                              <p className="font-medium">
                                {new Date(selectedAnalysis._metadata.analysisDate).toLocaleDateString('nl-NL', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Pagina's Gescraped</p>
                              <p className="font-medium">{selectedAnalysis._metadata.pagesScraped}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Totaal Gevonden</p>
                              <p className="font-medium">{selectedAnalysis._metadata.totalPagesFound}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Analyse Type</p>
                              <Badge variant={selectedAnalysis._metadata.deepAnalysis ? 'default' : 'secondary'}>
                                {selectedAnalysis._metadata.deepAnalysis ? 'Uitgebreid' : 'Basis'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
