import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Search,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  getTrackedKeywords,
  addTrackedKeyword,
  removeTrackedKeyword,
  checkKeywordRanking,
  getKeywordRankingHistory,
  batchCheckRankings,
  getPositionChange,
  KeywordWithRanking,
  RankHistory,
} from '@/lib/rank-tracking-api';

export default function RankTracking() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [keywords, setKeywords] = useState<KeywordWithRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0, keyword: '' });
  
  // Add keyword dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [targetDomain, setTargetDomain] = useState('tegeldepot.nl');
  const [category, setCategory] = useState('');

  // History dialog
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordWithRanking | null>(null);
  const [historyData, setHistoryData] = useState<RankHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load keywords
  const loadKeywords = useCallback(async () => {
    setLoading(true);
    const data = await getTrackedKeywords();
    setKeywords(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      loadKeywords();
    }
  }, [user, loadKeywords]);

  // Add keyword
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({ title: 'Voer een keyword in', variant: 'destructive' });
      return;
    }

    const result = await addTrackedKeyword(newKeyword, targetDomain, category || undefined);
    
    if (result.success) {
      toast({ title: 'Keyword toegevoegd' });
      setShowAddDialog(false);
      setNewKeyword('');
      setCategory('');
      loadKeywords();
    } else {
      toast({ title: 'Fout bij toevoegen', description: result.error, variant: 'destructive' });
    }
  };

  // Remove keyword
  const handleRemoveKeyword = async (id: string) => {
    const result = await removeTrackedKeyword(id);
    if (result.success) {
      toast({ title: 'Keyword verwijderd' });
      loadKeywords();
    } else {
      toast({ title: 'Fout bij verwijderen', description: result.error, variant: 'destructive' });
    }
  };

  // Check single keyword
  const handleCheckKeyword = async (keyword: KeywordWithRanking) => {
    if (!keyword.target_domain) {
      toast({ title: 'Target domain ontbreekt', variant: 'destructive' });
      return;
    }

    setChecking(true);
    setCheckProgress({ current: 0, total: 1, keyword: keyword.keyword });

    const result = await checkKeywordRanking(
      keyword.id,
      keyword.keyword,
      keyword.target_domain
    );

    setChecking(false);

    if (result.success) {
      toast({ 
        title: result.result?.found ? `Positie: ${result.result.position}` : 'Niet gevonden in top 100',
      });
      loadKeywords();
    } else {
      toast({ title: 'Fout bij controle', description: result.error, variant: 'destructive' });
    }
  };

  // Check all keywords
  const handleCheckAll = async () => {
    const keywordsToCheck = keywords.filter(k => k.target_domain);
    
    if (keywordsToCheck.length === 0) {
      toast({ title: 'Geen keywords met target domain', variant: 'destructive' });
      return;
    }

    setChecking(true);

    await batchCheckRankings(
      keywordsToCheck.map(k => ({
        id: k.id,
        keyword: k.keyword,
        targetDomain: k.target_domain!,
      })),
      (completed, total, current) => {
        setCheckProgress({ current: completed + 1, total, keyword: current });
      }
    );

    setChecking(false);
    toast({ title: 'Alle rankings gecontroleerd' });
    loadKeywords();
  };

  // View history
  const handleViewHistory = async (keyword: KeywordWithRanking) => {
    setSelectedKeyword(keyword);
    setShowHistoryDialog(true);
    setLoadingHistory(true);

    const history = await getKeywordRankingHistory(keyword.id);
    setHistoryData(history);
    setLoadingHistory(false);
  };

  // Get position change badge
  const getPositionBadge = (current: number | null, previous: number | null) => {
    const { direction, change } = getPositionChange(current, previous);

    switch (direction) {
      case 'up':
        return (
          <Badge variant="default" className="bg-primary gap-1">
            <ChevronUp className="h-3 w-3" />
            +{change}
          </Badge>
        );
      case 'down':
        return (
          <Badge variant="destructive" className="gap-1">
            <ChevronDown className="h-3 w-3" />
            -{change}
          </Badge>
        );
      case 'new':
        return <Badge variant="secondary">Nieuw</Badge>;
      case 'lost':
        return <Badge variant="outline">Verloren</Badge>;
      default:
        return <Badge variant="outline"><Minus className="h-3 w-3" /></Badge>;
    }
  };

  // Prepare chart data
  const chartData = historyData
    .slice()
    .reverse()
    .map(h => ({
      date: format(new Date(h.checked_at), 'd MMM', { locale: nl }),
      position: h.position || 101, // Use 101 for "not found" to show on chart
    }));

  if (authLoading) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Rank Tracking</h1>
            <p className="text-muted-foreground">
              Monitor je Google posities voor belangrijke keywords
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckAll} disabled={checking || keywords.length === 0}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Bezig...' : 'Check Alle'}
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Keyword Toevoegen
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {checking && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Controleren: {checkProgress.keyword}</span>
                  <span>{checkProgress.current} / {checkProgress.total}</span>
                </div>
                <Progress value={(checkProgress.current / checkProgress.total) * 100} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Totaal Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{keywords.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top 10
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {keywords.filter(k => k.position && k.position <= 10).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gestegen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary flex items-center gap-1">
                <TrendingUp className="h-5 w-5" />
                {keywords.filter(k => {
                  const { direction } = getPositionChange(k.position, k.previous_position);
                  return direction === 'up';
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gedaald
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive flex items-center gap-1">
                <TrendingDown className="h-5 w-5" />
                {keywords.filter(k => {
                  const { direction } = getPositionChange(k.position, k.previous_position);
                  return direction === 'down';
                }).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Keywords Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tracked Keywords</CardTitle>
            <CardDescription>
              Klik op een keyword om de positiegeschiedenis te bekijken
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Laden...</div>
            ) : keywords.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nog geen keywords toegevoegd</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Eerste Keyword Toevoegen
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Positie</TableHead>
                      <TableHead>Verandering</TableHead>
                      <TableHead>Laatst Gecontroleerd</TableHead>
                      <TableHead className="w-[120px]">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((kw) => (
                      <TableRow 
                        key={kw.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewHistory(kw)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{kw.keyword}</p>
                            {kw.category && (
                              <p className="text-xs text-muted-foreground">{kw.category}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {kw.position ? (
                            <span className={`font-bold ${kw.position <= 10 ? 'text-primary' : ''}`}>
                              #{kw.position}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getPositionBadge(kw.position, kw.previous_position)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {kw.last_checked
                            ? format(new Date(kw.last_checked), 'd MMM HH:mm', { locale: nl })
                            : 'Nooit'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCheckKeyword(kw)}
                              disabled={checking}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveKeyword(kw.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Keyword Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyword Toevoegen</DialogTitle>
              <DialogDescription>
                Voeg een keyword toe om de Google positie te monitoren
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  placeholder="bijv. wandtegels badkamer"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Target Domain</Label>
                <Input
                  id="domain"
                  placeholder="bijv. tegeldepot.nl"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categorie (optioneel)</Label>
                <Input
                  id="category"
                  placeholder="bijv. Tegels, Kranen"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Annuleren
              </Button>
              <Button onClick={handleAddKeyword}>Toevoegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Positie Geschiedenis</DialogTitle>
              <DialogDescription>
                Ranking trend voor: {selectedKeyword?.keyword}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nog geen geschiedenis beschikbaar
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Chart */}
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          reversed 
                          domain={[1, 100]}
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [
                            value > 100 ? 'Niet gevonden' : `#${value}`,
                            'Positie'
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="position"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent History */}
                  <div className="max-h-[200px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Positie</TableHead>
                          <TableHead>URL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.slice(0, 10).map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(h.checked_at), 'd MMM yyyy HH:mm', { locale: nl })}
                            </TableCell>
                            <TableCell>
                              {h.position ? (
                                <span className="font-medium">#{h.position}</span>
                              ) : (
                                <span className="text-muted-foreground">Niet gevonden</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {h.url || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
