import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, TrendingUp, TrendingDown, Minus, BarChart3, Globe,
  FileText, Settings, Target, Zap, Download, ExternalLink,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

interface CompetitorWithAnalysis {
  id: string;
  name: string;
  domain: string;
  competitor_analyses?: Array<{
    visibility_score: number;
    analysis_data: any;
    top_keywords: any[];
    content_gaps: any[];
    created_at: string;
  }>;
}

interface ComparisonReportProps {
  competitors: CompetitorWithAnalysis[];
  onClose: () => void;
}

export default function ComparisonReport({ competitors, onClose }: ComparisonReportProps) {
  const [sortBy, setSortBy] = useState<'visibility' | 'technical' | 'content' | 'traffic'>('visibility');

  // Filter competitors with analysis data
  const analyzedCompetitors = useMemo(() => {
    return competitors
      .filter(c => c.competitor_analyses && c.competitor_analyses.length > 0)
      .map(c => {
        const analysis = c.competitor_analyses![0].analysis_data;
        return {
          id: c.id,
          name: c.name,
          domain: c.domain,
          visibilityScore: analysis?.visibilityScore || 0,
          technicalScore: analysis?.analysisData?.technicalSeoScore || 0,
          contentScore: analysis?.analysisData?.contentQualityScore || 0,
          traffic: analysis?.analysisData?.estimatedMonthlyTraffic || 0,
          keywords: analysis?.analysisData?.estimatedKeywordCount || 0,
          domainAuthority: analysis?.analysisData?.domainAuthority || 0,
          mobileScore: analysis?.analysisData?.mobileScore || 0,
          pageSpeed: analysis?.analysisData?.pageSpeedIndicator || '-',
          strengths: analysis?.strengths || [],
          weaknesses: analysis?.weaknesses || [],
          topKeywords: analysis?.topKeywords || [],
          contentGaps: analysis?.contentGaps || [],
          technicalSeo: analysis?.technicalSeo || {},
          contentStrategy: analysis?.contentStrategy || {},
          competitivePosition: analysis?.competitivePosition || {},
          metadata: analysis?._metadata || {},
          analysisDate: c.competitor_analyses![0].created_at,
        };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'visibility': return b.visibilityScore - a.visibilityScore;
          case 'technical': return b.technicalScore - a.technicalScore;
          case 'content': return b.contentScore - a.contentScore;
          case 'traffic': return b.traffic - a.traffic;
          default: return 0;
        }
      });
  }, [competitors, sortBy]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white"><Trophy className="h-3 w-3 mr-1" />#1</Badge>;
    if (rank === 2) return <Badge variant="secondary">#2</Badge>;
    if (rank === 3) return <Badge variant="outline">#3</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const exportReport = () => {
    const headers = ['Ranking', 'Naam', 'Domein', 'Visibility Score', 'Technical SEO', 'Content Score', 'Traffic (geschat)', 'Keywords (geschat)', 'Domain Authority'];
    const rows = analyzedCompetitors.map((c, i) => [
      i + 1,
      c.name,
      c.domain,
      c.visibilityScore,
      c.technicalScore,
      c.contentScore,
      c.traffic,
      c.keywords,
      c.domainAuthority
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competitor-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (analyzedCompetitors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Geen geanalyseerde concurrenten</h3>
          <p className="text-muted-foreground mb-4">
            Voer eerst analyses uit om een vergelijkingsrapport te genereren.
          </p>
          <Button onClick={onClose}>Sluiten</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Vergelijkingsrapport
          </h2>
          <p className="text-muted-foreground text-sm">
            {analyzedCompetitors.length} concurrenten geanalyseerd
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Sluiten
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={sortBy === 'visibility' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSortBy('visibility')}
        >
          Visibility
        </Button>
        <Button 
          variant={sortBy === 'technical' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSortBy('technical')}
        >
          Technical SEO
        </Button>
        <Button 
          variant={sortBy === 'content' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSortBy('content')}
        >
          Content
        </Button>
        <Button 
          variant={sortBy === 'traffic' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSortBy('traffic')}
        >
          Traffic
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="technical">Technisch</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Vergelijking</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="py-3 px-2 font-medium">Rank</th>
                        <th className="py-3 px-2 font-medium">Concurrent</th>
                        <th className="py-3 px-2 font-medium text-center">Visibility</th>
                        <th className="py-3 px-2 font-medium text-center">Tech SEO</th>
                        <th className="py-3 px-2 font-medium text-center">Content</th>
                        <th className="py-3 px-2 font-medium text-right">Traffic</th>
                        <th className="py-3 px-2 font-medium text-right">Keywords</th>
                        <th className="py-3 px-2 font-medium text-right">DA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyzedCompetitors.map((comp, index) => (
                        <tr key={comp.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-2">
                            {getRankBadge(index + 1)}
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">{comp.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {comp.domain}
                                <a href={`https://${comp.domain}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${getScoreBgColor(comp.visibilityScore)}`}>
                              <span className={`text-lg font-bold ${getScoreColor(comp.visibilityScore)}`}>
                                {comp.visibilityScore}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${getScoreBgColor(comp.technicalScore)}`}>
                              <span className={`text-lg font-bold ${getScoreColor(comp.technicalScore)}`}>
                                {comp.technicalScore}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${getScoreBgColor(comp.contentScore)}`}>
                              <span className={`text-lg font-bold ${getScoreColor(comp.contentScore)}`}>
                                {comp.contentScore}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {formatNumber(comp.traffic)}
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {formatNumber(comp.keywords)}
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {comp.domainAuthority || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Score Bars Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Visibility Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analyzedCompetitors.slice(0, 5).map((comp, i) => (
                  <div key={comp.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[150px]">{comp.name}</span>
                      <span className={`font-medium ${getScoreColor(comp.visibilityScore)}`}>
                        {comp.visibilityScore}
                      </span>
                    </div>
                    <Progress value={comp.visibilityScore} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Technical SEO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...analyzedCompetitors].sort((a, b) => b.technicalScore - a.technicalScore).slice(0, 5).map((comp) => (
                  <div key={comp.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[150px]">{comp.name}</span>
                      <span className={`font-medium ${getScoreColor(comp.technicalScore)}`}>
                        {comp.technicalScore}
                      </span>
                    </div>
                    <Progress value={comp.technicalScore} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Content Kwaliteit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...analyzedCompetitors].sort((a, b) => b.contentScore - a.contentScore).slice(0, 5).map((comp) => (
                  <div key={comp.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[150px]">{comp.name}</span>
                      <span className={`font-medium ${getScoreColor(comp.contentScore)}`}>
                        {comp.contentScore}
                      </span>
                    </div>
                    <Progress value={comp.contentScore} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Technische SEO Vergelijking</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="min-w-[900px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="py-3 px-2 font-medium">Concurrent</th>
                        <th className="py-3 px-2 font-medium text-center">Score</th>
                        <th className="py-3 px-2 font-medium text-center">HTTPS</th>
                        <th className="py-3 px-2 font-medium text-center">Sitemap</th>
                        <th className="py-3 px-2 font-medium text-center">Robots.txt</th>
                        <th className="py-3 px-2 font-medium text-center">Structured Data</th>
                        <th className="py-3 px-2 font-medium text-center">Mobile</th>
                        <th className="py-3 px-2 font-medium text-center">Speed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyzedCompetitors.map((comp) => (
                        <tr key={comp.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{comp.name}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`font-bold ${getScoreColor(comp.technicalScore)}`}>
                              {comp.technicalScore}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {comp.technicalSeo?.hasHttps !== undefined ? (
                              comp.technicalSeo.hasHttps ? 
                                <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : 
                                <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                            ) : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {comp.technicalSeo?.hasSitemap !== undefined ? (
                              comp.technicalSeo.hasSitemap ? 
                                <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : 
                                <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                            ) : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {comp.technicalSeo?.hasRobotsTxt !== undefined ? (
                              comp.technicalSeo.hasRobotsTxt ? 
                                <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : 
                                <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                            ) : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {comp.technicalSeo?.structuredData !== undefined ? (
                              comp.technicalSeo.structuredData ? 
                                <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : 
                                <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                            ) : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`font-medium ${getScoreColor(comp.mobileScore)}`}>
                              {comp.mobileScore || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant={comp.pageSpeed === 'snel' ? 'default' : comp.pageSpeed === 'gemiddeld' ? 'secondary' : 'outline'}>
                              {comp.pageSpeed}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Content Strategie Vergelijking</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="min-w-[800px]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="py-3 px-2 font-medium">Concurrent</th>
                          <th className="py-3 px-2 font-medium text-center">Content Score</th>
                          <th className="py-3 px-2 font-medium text-center">Blog</th>
                          <th className="py-3 px-2 font-medium">Update Freq.</th>
                          <th className="py-3 px-2 font-medium text-right">Pagina's</th>
                          <th className="py-3 px-2 font-medium">Positionering</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyzedCompetitors.map((comp) => (
                          <tr key={comp.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">{comp.name}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`font-bold ${getScoreColor(comp.contentScore)}`}>
                                {comp.contentScore}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {comp.contentStrategy?.blogPresent !== undefined ? (
                                comp.contentStrategy.blogPresent ? 
                                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : 
                                  <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                              ) : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="outline">{comp.contentStrategy?.updateFrequency || '-'}</Badge>
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              {comp.metadata?.totalPagesFound ? formatNumber(comp.metadata.totalPagesFound) : '-'}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary">{comp.competitivePosition?.marketPosition || '-'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Strengths & Weaknesses Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    Top Sterktes per Concurrent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {analyzedCompetitors.slice(0, 5).map((comp) => (
                      <div key={comp.id} className="mb-4 last:mb-0">
                        <p className="font-medium text-sm mb-2">{comp.name}</p>
                        <ul className="space-y-1">
                          {(comp.strengths || []).slice(0, 2).map((s: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    Top Zwaktes per Concurrent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {analyzedCompetitors.slice(0, 5).map((comp) => (
                      <div key={comp.id} className="mb-4 last:mb-0">
                        <p className="font-medium text-sm mb-2">{comp.name}</p>
                        <ul className="space-y-1">
                          {(comp.weaknesses || []).slice(0, 2).map((w: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <XCircle className="h-3 w-3 text-red-600 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Keyword Overlap & Kansen</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="min-w-[700px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="py-3 px-2 font-medium">Concurrent</th>
                        <th className="py-3 px-2 font-medium text-right">Keywords</th>
                        <th className="py-3 px-2 font-medium">Top Keywords</th>
                        <th className="py-3 px-2 font-medium">Content Gaps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyzedCompetitors.map((comp) => (
                        <tr key={comp.id} className="border-b last:border-0 hover:bg-muted/50 align-top">
                          <td className="py-3 px-2 font-medium">{comp.name}</td>
                          <td className="py-3 px-2 text-right font-bold">
                            {formatNumber(comp.keywords)}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {(comp.topKeywords || []).slice(0, 3).map((kw: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {kw.keyword}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {(comp.contentGaps || []).slice(0, 2).map((gap: any, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {gap.topic}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* All Content Gaps Aggregated */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Alle Content Gaps (Kansen)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {analyzedCompetitors
                    .flatMap(c => (c.contentGaps || []).map((gap: any) => ({ ...gap, competitor: c.name })))
                    .slice(0, 20)
                    .map((gap: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Zap className={`h-5 w-5 shrink-0 mt-0.5 ${gap.opportunity === 'hoog' ? 'text-green-600' : gap.opportunity === 'medium' ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{gap.topic}</p>
                            <Badge variant={gap.opportunity === 'hoog' ? 'default' : 'secondary'} className="text-xs">
                              {gap.opportunity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{gap.description}</p>
                          <p className="text-xs text-primary mt-1">Van: {gap.competitor}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
