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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { scrapePage } from '@/lib/api';
import { computeQuickScan, getPageTypeLabel, getPageTypeColor, type QuickScanResult, type PageType } from '@/lib/quick-scan';
import { 
  Loader2, Search, AlertTriangle, CheckCircle2, Info, 
  ExternalLink, FileText, Image, Link2, Clock, Zap,
  BookOpen, Type, AlignLeft, Code, MapPin, Gauge
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
  headingStructure?: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
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

interface KeywordAnalysis {
  inTitle: boolean;
  inH1: boolean;
  inMeta: boolean;
  density: string;
  feedback?: string;
}

interface SeoIssue {
  type: string;
  category: string;
  message: string;
  priority: string;
  explanation?: string;
  location?: string;
}

interface ImageIssue {
  src: string;
  alt: string | null;
  issue?: string;
}

interface TruncationInfo {
  contentTruncated: boolean;
  originalWordCount: number;
  analyzedWordCount: number;
}

interface MetadataSources {
  titleSource?: 'title-tag' | 'og:title' | 'firecrawl' | 'none';
  descriptionSource?: 'meta-name' | 'og:description' | 'firecrawl' | 'none';
}

interface SeoIssue {
  type: string;
  category: string;
  message: string;
  priority: string;
  explanation?: string;
  location?: string;
}

interface ImageIssue {
  src: string;
  alt: string | null;
}

interface SeoAnalysis {
  score: number;
  title: string;
  metaDescription: string | null;
  metaDescriptionMissing?: boolean;
  issues: SeoIssue[];
  recommendations: Array<{ category: string; action: string; impact: string; effort: string }>;
  toneOfVoiceScore?: {
    pragmatisch: number;
    oplossingsgericht: number;
    concreet: number;
    autoritair: number;
    feedback: string;
  };
  keywordAnalysis?: KeywordAnalysis;
  contentQuality?: ContentQuality;
  linkAnalysis?: LinkAnalysis;
  imageIssues?: ImageIssue[];
  schemaTypes?: string[];
  truncationInfo?: TruncationInfo;
  metadataSources?: MetadataSources;
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
  pageType?: PageType;
  isQuickScan?: boolean;
}

// Helper function for safe value display - DEFENSIVE with optional chaining
const displayValue = (value: number | string | undefined | null, suffix = '', fallback = 'N/A'): string => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return `${value}${suffix}`;
};

// Safe number display with default 0
const displayNumber = (value: number | undefined | null, fallback = 0): number => {
  if (value === undefined || value === null || isNaN(value) || !isFinite(value)) return fallback;
  return value;
};

// Helper to get readability color
const getReadabilityColor = (level: string | null | undefined): string => {
  if (!level) return 'text-muted-foreground';
  const lower = level.toLowerCase();
  if (lower === 'eenvoudig' || lower === 'simple' || lower === 'easy') return 'text-green-600';
  if (lower === 'gemiddeld' || lower === 'medium' || lower === 'average') return 'text-blue-600';
  if (lower === 'complex' || lower === 'difficult' || lower === 'hard') return 'text-orange-600';
  return 'text-muted-foreground';
};

export default function SeoAudit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [url, setUrl] = useState('https://www.tegeldepot.nl/');
  const [keyword, setKeyword] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<SeoIssue | null>(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

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

      // Then analyze with AI - pass metadata, linkAnalysis and contentMetrics
      toast({ title: 'Stap 2/2', description: 'SEO analyseren...' });
      const pageContent = scrapeResult.data?.markdown || '';
      const metadata = scrapeResult.data?.metadata || null;
      const linkAnalysis = scrapeResult.data?.linkAnalysis || null;
      const contentMetrics = scrapeResult.data?.contentMetrics || null;
      const imageIssues = scrapeResult.data?.imageIssues || [];
      const schemaTypes = scrapeResult.data?.schemaTypes || [];
      
      // Call seo-analyze with metadata explicitly passed, including page type
      const pageType = scrapeResult.data?.pageType || 'other';
      const pageTypeRequirements = scrapeResult.data?.pageTypeRequirements || null;
      
      const { data: analyzeResult, error: analyzeError } = await supabase.functions.invoke('seo-analyze', {
        body: { 
          url, 
          keyword: keyword.trim() || null, // Pass focus keyword
          pageContent,
          metadata, // Pass title and description from scraper
          linkAnalysis,
          contentMetrics,
          imageIssues, // Pass image issues
          schemaTypes, // Pass schema types
          pageType, // NEW: Pass page type
          pageTypeRequirements // NEW: Pass requirements
        }
      });

      if (analyzeError) throw analyzeError;

      if (analyzeResult.success && analyzeResult.data) {
        setAnalysis(analyzeResult.data);

        // Save complete audit data to database
        await supabase.from('seo_audits').insert({
          user_id: user!.id,
          url,
          title: analyzeResult.data.title,
          meta_description: analyzeResult.data.metaDescription,
          score: analyzeResult.data.score,
          issues: analyzeResult.data.issues,
          recommendations: analyzeResult.data.recommendations,
          technical_data: analyzeResult.data.technicalData,
          // NEW: Save complete analysis data
          content_quality: analyzeResult.data.contentQuality,
          link_analysis: analyzeResult.data.linkAnalysis,
          keyword_analysis: analyzeResult.data.keywordAnalysis,
          tone_of_voice_score: analyzeResult.data.toneOfVoiceScore,
          image_issues: analyzeResult.data.imageIssues,
          schema_types: analyzeResult.data.schemaTypes,
          focus_keyword: keyword.trim() || null,
          metadata_sources: scrapeResult.data?.metadata ? {
            titleSource: scrapeResult.data.metadata.titleSource,
            descriptionSource: scrapeResult.data.metadata.descriptionSource
          } : null,
          truncation_info: analyzeResult.data.truncationInfo
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

  // Quick Scan - No AI, just technical checks
  const handleQuickScan = async () => {
    if (!url.trim()) {
      toast({ title: 'Fout', description: 'Vul een URL in', variant: 'destructive' });
      return;
    }

    setIsQuickScanning(true);
    setAnalysis(null);

    try {
      toast({ title: 'Quick Scan', description: 'Pagina ophalen...' });
      const scrapeResult = await scrapePage(url);
      
      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Kon pagina niet ophalen');
      }

      // Compute Quick Scan locally (no AI call)
      const quickScanResult = computeQuickScan(scrapeResult.data || {});
      
      // Convert to SeoAnalysis format
      const quickAnalysis: SeoAnalysis = {
        score: quickScanResult.score,
        title: scrapeResult.data?.metadata?.title || '',
        metaDescription: scrapeResult.data?.metadata?.description || null,
        metaDescriptionMissing: quickScanResult.metrics.metaDescriptionMissing,
        issues: quickScanResult.issues.map(issue => ({
          type: issue.type,
          category: issue.category,
          message: issue.message,
          priority: issue.priority,
        })),
        recommendations: [], // No AI recommendations in quick scan
        technicalData: {
          titleLength: quickScanResult.metrics.titleLength,
          metaDescriptionLength: quickScanResult.metrics.metaDescriptionLength,
          h1Count: quickScanResult.metrics.h1Count,
          wordCount: quickScanResult.metrics.wordCount,
          imagesWithoutAlt: quickScanResult.metrics.imagesWithoutAlt,
          internalLinks: quickScanResult.metrics.internalLinksCount,
          hasStructuredData: quickScanResult.metrics.schemaTypesCount > 0,
        },
        contentQuality: {
          wordCount: quickScanResult.metrics.wordCount,
          paragraphCount: scrapeResult.data?.contentMetrics?.paragraphCount || 0,
          avgParagraphLength: scrapeResult.data?.contentMetrics?.avgParagraphLength || 0,
          headingStructure: scrapeResult.data?.contentMetrics?.headingStructure,
        },
        linkAnalysis: scrapeResult.data?.linkAnalysis,
        imageIssues: scrapeResult.data?.imageIssues,
        schemaTypes: scrapeResult.data?.schemaTypes,
        pageType: quickScanResult.pageType,
        isQuickScan: true,
      };

      setAnalysis(quickAnalysis);

      // Save quick scan to database (cast to any for new columns not yet in types)
      await supabase.from('seo_audits').insert({
        user_id: user!.id,
        url,
        title: quickAnalysis.title,
        meta_description: quickAnalysis.metaDescription,
        score: quickAnalysis.score,
        issues: quickAnalysis.issues as any,
        recommendations: [] as any,
        technical_data: quickAnalysis.technicalData as any,
        content_quality: quickAnalysis.contentQuality as any,
        link_analysis: quickAnalysis.linkAnalysis as any,
        image_issues: quickAnalysis.imageIssues as any,
        schema_types: quickAnalysis.schemaTypes,
        // New columns added by migration - types will update on next sync
      } as any);

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user!.id,
        action_type: 'quick_scan',
        action_description: `Quick Scan uitgevoerd: ${url}`,
        resource_type: 'seo_audit',
      });

      loadRecentAudits();
      toast({ 
        title: 'Quick Scan voltooid!', 
        description: `Score: ${quickScanResult.score}/100 (${getPageTypeLabel(quickScanResult.pageType)})` 
      });
    } catch (error: any) {
      console.error('Quick scan error:', error);
      toast({ 
        title: 'Quick Scan mislukt', 
        description: error.message || 'Er ging iets mis.',
        variant: 'destructive' 
      });
    } finally {
      setIsQuickScanning(false);
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
    if (type === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const handleIssueClick = (issue: SeoIssue) => {
    setSelectedIssue(issue);
    setIssueDialogOpen(true);
  };

  const getSchemaColor = (schema: string): string => {
    const goodSchemas = ['Product', 'FAQPage', 'BreadcrumbList', 'Organization', 'LocalBusiness'];
    return goodSchemas.includes(schema) ? 'default' : 'secondary';
  };

  const loadSavedAudit = (audit: any) => {
    setUrl(audit.url);
    // Restore focus keyword if saved
    if (audit.focus_keyword) {
      setKeyword(audit.focus_keyword);
    }
    // Convert database format to analysis format with ALL saved fields
    const savedAnalysis: SeoAnalysis = {
      score: audit.score || 0,
      title: audit.title || '',
      metaDescription: audit.meta_description || null,
      issues: (audit.issues as any[]) || [],
      recommendations: (audit.recommendations as any[]) || [],
      technicalData: (audit.technical_data as any) || {},
      // Restore complete analysis data
      contentQuality: (audit.content_quality as ContentQuality) || undefined,
      linkAnalysis: (audit.link_analysis as LinkAnalysis) || undefined,
      keywordAnalysis: (audit.keyword_analysis as KeywordAnalysis) || undefined,
      toneOfVoiceScore: audit.tone_of_voice_score || undefined,
      imageIssues: (audit.image_issues as ImageIssue[]) || undefined,
      schemaTypes: audit.schema_types || undefined,
      truncationInfo: audit.truncation_info || undefined,
      metadataSources: audit.metadata_sources || undefined,
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
            <div className="space-y-3 md:space-y-4">
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
                <div className="flex gap-2">
                  <Button 
                    onClick={handleQuickScan} 
                    disabled={isAnalyzing || isQuickScanning}
                    variant="outline"
                    size="lg"
                    className="h-10 md:h-12 px-4 md:px-6"
                    title="Snelle technische check zonder AI (gratis)"
                  >
                    {isQuickScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Scannen...</span>
                      </>
                    ) : (
                      <>
                        <Gauge className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Quick Scan</span>
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || isQuickScanning}
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
                        <span className="hidden sm:inline">AI Analyse</span>
                        <span className="sm:hidden">Scan</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Label htmlFor="keyword" className="text-sm font-medium whitespace-nowrap">
                  Focus Keyword:
                </Label>
                <Input
                  id="keyword"
                  type="text"
                  placeholder="bijv. badkamermeubel, vloertegels, wandtegel..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-9 text-sm flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <Gauge className="h-3 w-3 inline mr-1" />
                Quick Scan = technische check (gratis) | 
                <Search className="h-3 w-3 inline mx-1" />
                AI Analyse = volledige SEO analyse met AI aanbevelingen
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4 md:space-y-6">
            {/* Quick Scan / Page Type Badges */}
            <div className="flex flex-wrap gap-2">
              {analysis.isQuickScan && (
                <Badge variant="secondary" className="text-sm">
                  <Gauge className="h-3 w-3 mr-1" />
                  Quick Scan
                </Badge>
              )}
              {analysis.pageType && (
                <Badge variant={getPageTypeColor(analysis.pageType)}>
                  {getPageTypeLabel(analysis.pageType)}
                </Badge>
              )}
              {analysis.metadataSources?.titleSource && (
                <Badge variant="outline" className="font-normal text-xs">
                  Title: {analysis.metadataSources.titleSource}
                </Badge>
              )}
              {analysis.metadataSources?.descriptionSource && (
                <Badge variant="outline" className="font-normal text-xs">
                  Desc: {analysis.metadataSources.descriptionSource}
                </Badge>
              )}
            </div>

            {/* Content Truncation Warning */}
            {analysis.truncationInfo?.contentTruncated && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-amber-800 dark:text-amber-300">Content afgekapt voor analyse: </span>
                  <span className="text-amber-700 dark:text-amber-400">
                    De pagina bevat {analysis.truncationInfo.originalWordCount.toLocaleString('nl-NL')} woorden, 
                    maar alleen de eerste {analysis.truncationInfo.analyzedWordCount.toLocaleString('nl-NL')} zijn geanalyseerd om AI-limieten te respecteren.
                  </span>
                </div>
              </div>
            )}

            {/* Metadata source indicators already shown in badges above */}
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

                  {/* Keyword Analysis */}
                  {analysis.keywordAnalysis && keyword && (
                    <div className="mt-4 p-3 rounded-lg border text-left">
                      <h4 className="font-semibold mb-2 text-sm">Focus Keyword: "{keyword}"</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          {analysis.keywordAnalysis.inTitle ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span>In Title</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {analysis.keywordAnalysis.inH1 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span>In H1</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {analysis.keywordAnalysis.inMeta ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span>In Meta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-500" />
                          <span>Density: {analysis.keywordAnalysis.density}</span>
                        </div>
                      </div>
                      {analysis.keywordAnalysis.feedback && (
                        <p className="mt-2 text-xs text-muted-foreground">{analysis.keywordAnalysis.feedback}</p>
                      )}
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
                          <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 text-green-600" />
                          Geen problemen gevonden!
                        </div>
                      ) : (
                        analysis.issues?.map((issue, i) => (
                          <div 
                            key={i} 
                            className="flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleIssueClick(issue)}
                          >
                            {getIssueIcon(issue.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1 md:gap-2">
                                <Badge variant="outline" className="text-xs">{issue.category}</Badge>
                                <Badge variant={getPriorityColor(issue.priority)} className="text-xs">
                                  {issue.priority}
                                </Badge>
                                {(issue.explanation || issue.location) && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Info className="h-3 w-3 mr-1" />
                                    Details
                                  </Badge>
                                )}
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
                        {/* Content Metrics Grid - Defensive rendering */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <FileText className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis?.contentQuality?.wordCount ?? analysis?.technicalData?.wordCount ?? null)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Woorden</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <AlignLeft className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis?.contentQuality?.paragraphCount ?? null)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Paragrafen</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <Type className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className="text-xl md:text-2xl font-bold">
                              {displayValue(analysis?.contentQuality?.avgSentenceLength ?? null)}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">Gem. zinslengte</p>
                          </div>
                          <div className="p-3 md:p-4 rounded-lg bg-muted">
                            <BookOpen className="h-4 w-4 md:h-5 md:w-5 mb-1 md:mb-2 text-muted-foreground" />
                            <p className={`text-xl md:text-2xl font-bold ${getReadabilityColor(analysis?.contentQuality?.readabilityLevel ?? null)}`}>
                              {displayValue(analysis?.contentQuality?.readabilityLevel ?? null)}
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

                        {/* Heading Structure - Defensive rendering */}
                        <div className="p-4 rounded-lg border">
                          <h4 className="font-medium mb-3 text-sm">Heading Structuur</h4>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis?.technicalData?.h1Count ?? null)}</p>
                              <p className="text-xs text-muted-foreground">H1</p>
                            </div>
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis?.technicalData?.h2Count ?? null)}</p>
                              <p className="text-xs text-muted-foreground">H2</p>
                            </div>
                            <div className="text-center p-2 bg-muted rounded">
                              <p className="text-lg font-bold">{displayValue(analysis?.technicalData?.h3Count ?? null)}</p>
                              <p className="text-xs text-muted-foreground">H3</p>
                            </div>
                          </div>
                          {analysis?.contentQuality?.headingIssues && Array.isArray(analysis.contentQuality.headingIssues) && analysis.contentQuality.headingIssues.length > 0 && (
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

                        {/* Link Analysis - Defensive rendering with total count */}
                        <div className="p-4 rounded-lg border">
                          <h4 className="font-medium mb-3 text-sm">Link Analyse</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="p-2 bg-muted rounded text-center">
                              <p className="text-lg font-bold text-primary">
                                {displayValue(analysis?.linkAnalysis?.internal ?? analysis?.linkAnalysis?.internalLinks ?? analysis?.technicalData?.internalLinks ?? null)}
                              </p>
                              <p className="text-xs text-muted-foreground">Totaal Intern</p>
                            </div>
                            <div className="p-2 bg-muted rounded text-center">
                              <p className="text-lg font-bold text-blue-600">
                                {displayValue(analysis?.linkAnalysis?.contentLinks ?? null)}
                              </p>
                              <p className="text-xs text-muted-foreground">Content Links</p>
                            </div>
                            <div className="p-2 bg-muted rounded text-center">
                              <p className="text-lg font-bold">
                                {displayValue(analysis?.linkAnalysis?.footerLinks ?? null)}
                              </p>
                              <p className="text-xs text-muted-foreground">Footer Links</p>
                            </div>
                            <div className="p-2 bg-muted rounded text-center">
                              <p className="text-lg font-bold">
                                {displayValue(analysis?.linkAnalysis?.abcIndexLinks ?? null)}
                              </p>
                              <p className="text-xs text-muted-foreground">ABC-index</p>
                            </div>
                          </div>
                          {analysis?.linkAnalysis?.linkingFeedback && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {analysis.linkAnalysis.linkingFeedback}
                            </p>
                          )}
                        </div>
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

                      {/* Schema.org Types Badges */}
                      <div className="mt-6 p-4 rounded-lg border">
                        <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                          <Code className="h-4 w-4" /> Gevonden Schema.org Types
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.schemaTypes && analysis.schemaTypes.length > 0 ? (
                            analysis.schemaTypes.map((type, i) => (
                              <Badge key={i} variant={getSchemaColor(type) as 'default' | 'secondary'}>
                                {type}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Geen structured data gevonden.</span>
                          )}
                        </div>
                      </div>

                      {/* Image Issues List */}
                      {analysis.imageIssues && analysis.imageIssues.length > 0 && (
                        <div className="mt-4 p-4 rounded-lg border bg-destructive/5 border-destructive/20">
                          <h4 className="font-medium mb-3 text-sm flex items-center gap-2 text-destructive">
                            <Image className="h-4 w-4" /> 
                            Afbeeldingen zonder Alt-tekst ({analysis.imageIssues.length})
                          </h4>
                          <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                            {analysis.imageIssues.slice(0, 10).map((img, i) => (
                              <div key={i} className="text-xs font-mono bg-background p-2 rounded border truncate" title={img.src}>
                                {img.src.split('/').pop()} 
                                <span className="block text-[10px] text-muted-foreground opacity-70 truncate">{img.src}</span>
                              </div>
                            ))}
                            {analysis.imageIssues.length > 10 && (
                              <p className="text-xs text-muted-foreground italic">
                                ... en {analysis.imageIssues.length - 10} meer
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Issue Details Dialog */}
        <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                {selectedIssue && getIssueIcon(selectedIssue.type)}
                <DialogTitle className="text-lg">{selectedIssue?.message}</DialogTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedIssue && (
                  <>
                    <Badge variant="outline">{selectedIssue.category}</Badge>
                    <Badge variant={getPriorityColor(selectedIssue.priority)}>{selectedIssue.priority}</Badge>
                  </>
                )}
              </div>
            </DialogHeader>
            {selectedIssue?.explanation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span>Waarom is dit belangrijk?</span>
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{selectedIssue.explanation}</p>
              </div>
            )}
            {selectedIssue?.location && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>Waar op te lossen?</span>
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{selectedIssue.location}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Sluiten</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
