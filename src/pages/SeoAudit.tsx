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
import { scrapePage } from '@/lib/api';
import { 
  Loader2, Search, AlertTriangle, CheckCircle2, Info, 
  ExternalLink, FileText, Image, Link2, Clock, Zap,
  BookOpen, Type, AlignLeft
} from 'lucide-react';

interface ContentQuality {
  wordCount: number;
  paragraphCount: number;
  avgParagraphLength: number;
  sentenceCount?: number;
  avgSentenceLength?: number;
  readabilityScore?: number | null;
  readabilityLevel?: string | null;
  headingStructureValid?: boolean | null;
  headingIssues?: string[];
}

interface LinkAnalysis {
  totalLinks?: number;
  total?: number;
  internalLinks?: number;
  internal?: number;
  externalLinks?: number;
  external?: number;
  footerLinks?: number;
  abcIndexLinks?: number;
  contentLinks?: number;
  isLinkingAdequate?: boolean | null;
  linkingFeedback?: string | null;
}

interface SeoAnalysis {
  score: number;
  title: string;
  metaDescription: string | null;
  metaDescriptionMissing?: boolean;
  issues: Array<{ type: string; category: string; message: string; priority: string }>;
  recommendations: Array<{ category: string; action: string; impact: string; effort: string }>;
  toneOfVoiceScore?: {
    pragmatisch: number;
    oplossingsgericht: number;
    concreet: number;
    autoritair: number;
    feedback: string;
  };
  contentQuality?: ContentQuality;
  linkAnalysis?: LinkAnalysis;
  technicalData: {
    titleLength?: number;
    metaDescriptionLength?: number;
    h1Count?: number;
    h2Count?: number;
    h3Count?: number;
    wordCount?: number;
    imageCount?: number;
    imagesWithoutAlt?: number;
    internalLinks?: number;
    externalLinks?: number;
    estimatedReadTime?: string;
    hasFaq?: boolean;
    hasStructuredData?: boolean;
  };
}

// Helper function for safe value display
const displayValue = (value: number | string | undefined | null, suffix = ''): string => {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'number' && isNaN(value)) return 'N/A';
  return `${value}${suffix}`;
};

// Helper to get readability color
const getReadabilityColor = (level: string | null | undefined): string => {
  if (!level) return 'text-muted-foreground';
  const lower = level.toLowerCase();
  if (lower === 'eenvoudig' || lower === 'simple') return 'text-green-600';
  if (lower === 'gemiddeld' || lower === 'medium') return 'text-blue-600';
  if (lower === 'complex') return 'text-orange-600';
  return 'text-muted-foreground';
};

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

      // Then analyze with AI - pass linkAnalysis and contentMetrics
      toast({ title: 'Stap 2/2', description: 'SEO analyseren...' });
      const pageContent = scrapeResult.data?.markdown || '';
      const linkAnalysis = scrapeResult.data?.linkAnalysis || null;
      const contentMetrics = scrapeResult.data?.contentMetrics || null;
      
      // Call seo-analyze with extra data
      const { data: analyzeResult, error: analyzeError } = await supabase.functions.invoke('seo-analyze', {
        body: { 
          url, 
          pageContent,
          linkAnalysis,
          contentMetrics
        }
      });

      if (analyzeError) throw analyzeError;

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
      metaDescription: audit.meta_description || null,
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
          <div className="space-y-4 md:space-y-6">
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
                  
                  {/* Meta Description Warning */}
                  {analysis.metaDescriptionMissing && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-left">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Meta description ontbreekt!</span>
                      </div>
                    </div>
                  )}
                  
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
                    <TabsList className="mb-4 w-full grid grid-cols-4">
                      <TabsTrigger value="issues" className="text-xs md:text-sm">
                        <span className="hidden sm:inline">Problemen</span>
                        <span className="sm:hidden">Issues</span>
                        <span className="ml-1">({analysis.issues?.length || 0})</span>
                      </TabsTrigger>
                      <TabsTrigger value="recommendations" className="text-xs md:text-sm">
                        <span className="hidden sm:inline">Aanbevelingen</span>
                        <span className="sm:hidden">Tips</span>
                      </TabsTrigger>
                      <TabsTrigger value="content" className="text-xs md:text-sm">
                        Content
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
                      {analysis.recommendations?.length === 0 ? (
                        <div className="text-center py-6 md:py-8 text-muted-foreground">
                          Geen aanbevelingen
                        </div>
                      ) : (
                        analysis.recommendations?.map((rec, i) => (
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
                        ))
                      )}
                    </TabsContent>

                    {/* Content Quality Tab */}
                    <TabsContent value="content">
                      <div className="space-y-4">
                        {/* Content Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <FileText className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis.contentQuality?.wordCount || analysis.technicalData?.wordCount)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Woorden</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <AlignLeft className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis.contentQuality?.paragraphCount)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Paragrafen</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <Type className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis.contentQuality?.avgSentenceLength)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Gem. zinslengte</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <BookOpen className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className={`text-xl md:text-2xl font-bold ${getReadabilityColor(analysis.contentQuality?.readabilityLevel)}`}>
                              {displayValue(analysis.contentQuality?.readabilityLevel)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Leesbaarheid</p>
                          </div>
                        </div>

                        {/* Readability Score */}
                        {analysis.contentQuality?.readabilityScore !== undefined && analysis.contentQuality?.readabilityScore !== null && (
                          <div className="p-4 rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">Leesbaarheid Score</span>
                              <span className="font-bold">{analysis.contentQuality.readabilityScore}/100</span>
                            </div>
                            <Progress value={analysis.contentQuality.readabilityScore} />
                          </div>
                        )}

                        {/* Heading Structure */}
                        <div className="p-4 rounded-lg border">
                          <h4 className="font-medium mb-3 text-sm">Heading Structuur</h4>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis.technicalData?.h1Count)}</p>
                              <p className="text-xs text-muted-foreground">H1</p>
                            </div>
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis.technicalData?.h2Count)}</p>
                              <p className="text-xs text-muted-foreground">H2</p>
                            </div>
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis.technicalData?.h3Count)}</p>
                              <p className="text-xs text-muted-foreground">H3</p>
                            </div>
                          </div>
                          {analysis.contentQuality?.headingIssues && analysis.contentQuality.headingIssues.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {analysis.contentQuality.headingIssues.map((issue, i) => (
                                <p key={i} className="text-xs text-orange-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {issue}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Link Analysis */}
                        {analysis.linkAnalysis && (
                          <div className="p-4 rounded-lg border">
                            <h4 className="font-medium mb-3 text-sm">Link Analyse</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-lg font-bold text-blue-600">
                                  {displayValue(analysis.linkAnalysis.contentLinks ?? analysis.linkAnalysis.internalLinks ?? analysis.linkAnalysis.internal)}
                                </p>
                                <p className="text-xs text-muted-foreground">Content Links</p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-lg font-bold">
                                  {displayValue(analysis.linkAnalysis.footerLinks)}
                                </p>
                                <p className="text-xs text-muted-foreground">Footer Links</p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-lg font-bold">
                                  {displayValue(analysis.linkAnalysis.abcIndexLinks)}
                                </p>
                                <p className="text-xs text-muted-foreground">ABC-index</p>
                              </div>
                            </div>
                            {analysis.linkAnalysis.linkingFeedback && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                {analysis.linkAnalysis.linkingFeedback}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="technical">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <FileText className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                          <p className="text-xl md:text-2xl font-bold">
                            {displayValue(analysis.technicalData?.wordCount)}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">Woorden</p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <Image className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                          <p className="text-xl md:text-2xl font-bold">
                            {displayValue(analysis.technicalData?.imageCount)}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">Afbeeldingen</p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <Link2 className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                          <p className="text-xl md:text-2xl font-bold">
                            {displayValue(analysis.technicalData?.internalLinks)}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">Interne links</p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">Title length</p>
                          <p className="text-lg md:text-xl font-bold">
                            {displayValue(analysis.technicalData?.titleLength)}
                          </p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">Meta desc length</p>
                          <p className="text-lg md:text-xl font-bold">
                            {displayValue(analysis.technicalData?.metaDescriptionLength)}
                          </p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">Leestijd</p>
                          <p className="text-lg md:text-xl font-bold">
                            {displayValue(analysis.technicalData?.estimatedReadTime)}
                          </p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">FAQ aanwezig</p>
                          <p className="text-lg md:text-xl font-bold">
                            {analysis.technicalData?.hasFaq ? 'Ja' : 'Nee'}
                          </p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">Schema.org</p>
                          <p className="text-lg md:text-xl font-bold">
                            {analysis.technicalData?.hasStructuredData ? 'Ja' : 'Nee'}
                          </p>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">Imgs zonder alt</p>
                          <p className="text-lg md:text-xl font-bold">
                            {displayValue(analysis.technicalData?.imagesWithoutAlt)}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
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
