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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { analyzePageSeo, scrapePage } from '@/lib/api';
import { 
  Loader2, Search, AlertTriangle, CheckCircle2, Info, 
  ExternalLink, FileText, Image, Link2, Clock, Zap
} from 'lucide-react';

interface SeoAnalysis {
  score: number;
  title: string;
  metaDescription: string;
  issues: Array<{ type: string; category: string; message: string; priority: string }>;
  recommendations: Array<{ category: string; action: string; impact: string; effort: string }>;
  toneOfVoiceScore?: {
    pragmatisch: number;
    oplossingsgericht: number;
    concreet: number;
    autoritair: number;
    feedback: string;
  };
  technicalData: {
    titleLength?: number;
    metaDescriptionLength?: number;
    h1Count?: number;
    h2Count?: number;
    wordCount?: number;
    imageCount?: number;
    internalLinks?: number;
    hasFaq?: boolean;
  };
}

export default function SeoAudit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [url, setUrl] = useState('https://www.tegeldepot.nl/');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadRecentAudits();
  }, [user]);

  const loadRecentAudits = async () => {
    try {
      const { data } = await supabase
        .from('seo_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentAudits(data || []);
    } catch (error) {
      console.error('Failed to load audits:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast({ title: 'Fout', description: 'Vul een URL in', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // First scrape the page
      toast({ title: 'Stap 1/2', description: 'Pagina ophalen...' });
      const scrapeResult = await scrapePage(url);
      
      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Kon pagina niet ophalen');
      }

      // Then analyze with AI
      toast({ title: 'Stap 2/2', description: 'SEO analyseren...' });
      const pageContent = scrapeResult.data?.markdown || '';
      const analyzeResult = await analyzePageSeo(url, pageContent);

      if (analyzeResult.success && analyzeResult.data) {
        setAnalysis(analyzeResult.data);

        // Save to database
        await supabase.from('seo_audits').insert({
          user_id: user!.id,
          url,
          title: analyzeResult.data.title,
          meta_description: analyzeResult.data.metaDescription,
          score: analyzeResult.data.score,
          issues: analyzeResult.data.issues,
          recommendations: analyzeResult.data.recommendations,
          technical_data: analyzeResult.data.technicalData,
        });

        // Log activity
        await supabase.from('activity_log').insert({
          user_id: user!.id,
          action_type: 'seo_audit',
          action_description: `SEO audit uitgevoerd: ${url}`,
          resource_type: 'seo_audit',
        });

        loadRecentAudits();
        toast({ title: 'Analyse voltooid!', description: `Score: ${analyzeResult.data.score}/100` });
      } else {
        throw new Error(analyzeResult.error || 'Analyse mislukt');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({ 
        title: 'Analyse mislukt', 
        description: error.message || 'Er ging iets mis.',
        variant: 'destructive' 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Goed';
    if (score >= 40) return 'Matig';
    return 'Moet verbeteren';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'destructive';
    if (priority === 'medium') return 'secondary';
    return 'outline';
  };

  const getIssueIcon = (type: string) => {
    if (type === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const loadSavedAudit = (audit: any) => {
    setUrl(audit.url);
    // Convert database format to analysis format
    const savedAnalysis: SeoAnalysis = {
      score: audit.score || 0,
      title: audit.title || '',
      metaDescription: audit.meta_description || '',
      issues: (audit.issues as any[]) || [],
      recommendations: (audit.recommendations as any[]) || [],
      technicalData: (audit.technical_data as any) || {},
    };
    setAnalysis(savedAnalysis);
    toast({ title: 'Audit geladen', description: `Score: ${audit.score}/100` });
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">SEO Audit</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Analyseer pagina's van Tegeldepot.nl op SEO en tone of voice
          </p>
        </div>

        {/* URL Input */}
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <div className="flex-1">
                <Label htmlFor="url" className="sr-only">URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://www.tegeldepot.nl/categorie/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-10 md:h-12 text-sm md:text-lg"
                />
              </div>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                size="lg"
                className="h-10 md:h-12 px-6 md:px-8"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Analyseren...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Analyseer</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Score Card */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">SEO Score</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className={`text-5xl md:text-6xl font-bold ${getScoreColor(analysis.score)}`}>
                  {analysis.score}
                </div>
                <p className="text-muted-foreground mt-2 text-sm md:text-base">{getScoreLabel(analysis.score)}</p>
                <Progress value={analysis.score} className="mt-4" />
                
                {analysis.toneOfVoiceScore && (
                  <div className="mt-6 text-left">
                    <h4 className="font-semibold mb-3 text-sm md:text-base">Tone of Voice</h4>
                    <div className="space-y-2 text-xs md:text-sm">
                      {Object.entries(analysis.toneOfVoiceScore)
                        .filter(([key]) => key !== 'feedback')
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="capitalize">{key}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={value as number} className="w-16 md:w-20 h-2" />
                              <span className="w-6 md:w-8 text-right">{value}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Details */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Analyse Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="issues">
                  <TabsList className="mb-4 w-full grid grid-cols-3">
                    <TabsTrigger value="issues" className="text-xs md:text-sm">
                      <span className="hidden sm:inline">Problemen</span>
                      <span className="sm:hidden">Issues</span>
                      <span className="ml-1">({analysis.issues?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="text-xs md:text-sm">
                      <span className="hidden sm:inline">Aanbevelingen</span>
                      <span className="sm:hidden">Tips</span>
                      <span className="ml-1">({analysis.recommendations?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="technical" className="text-xs md:text-sm">
                      Tech
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="issues" className="space-y-2 md:space-y-3">
                    {analysis.issues?.length === 0 ? (
                      <div className="text-center py-6 md:py-8 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 text-green-500" />
                        Geen problemen gevonden!
                      </div>
                    ) : (
                      analysis.issues?.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg border">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 md:gap-2">
                              <Badge variant="outline" className="text-xs">{issue.category}</Badge>
                              <Badge variant={getPriorityColor(issue.priority)} className="text-xs">
                                {issue.priority}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs md:text-sm">{issue.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="recommendations" className="space-y-2 md:space-y-3">
                    {analysis.recommendations?.map((rec, i) => (
                      <div key={i} className="p-2 md:p-3 rounded-lg border">
                        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                          <Badge variant={rec.impact === 'high' ? 'default' : 'secondary'} className="text-xs">
                            Impact: {rec.impact}
                          </Badge>
                          <Badge variant="outline" className="text-xs">Effort: {rec.effort}</Badge>
                        </div>
                        <p className="text-xs md:text-sm">{rec.action}</p>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="technical">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                        <p className="text-xl md:text-2xl font-bold">{analysis.technicalData?.wordCount || 0}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Woorden</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <Image className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                        <p className="text-xl md:text-2xl font-bold">{analysis.technicalData?.imageCount || 0}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Afbeeldingen</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <Link2 className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                        <p className="text-xl md:text-2xl font-bold">{analysis.technicalData?.internalLinks || 0}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Interne links</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground mb-1">Title length</p>
                        <p className="text-lg md:text-xl font-bold">{analysis.technicalData?.titleLength || 0}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground mb-1">H1 count</p>
                        <p className="text-lg md:text-xl font-bold">{analysis.technicalData?.h1Count || 0}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground mb-1">H2 count</p>
                        <p className="text-lg md:text-xl font-bold">{analysis.technicalData?.h2Count || 0}</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Audits */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-lg">Recente Audits</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAudits.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                Nog geen audits uitgevoerd
              </p>
            ) : (
              <div className="space-y-2">
                {recentAudits.map((audit) => (
                  <div 
                    key={audit.id}
                    className="flex items-center justify-between p-2 md:p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors gap-2"
                    onClick={() => loadSavedAudit(audit)}
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className={`text-lg md:text-xl font-bold shrink-0 ${getScoreColor(audit.score)}`}>
                        {audit.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs md:text-sm truncate">{audit.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(audit.created_at).toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 hidden sm:flex">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Bekijk
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
