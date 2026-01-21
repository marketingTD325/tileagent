import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Loader2, Sparkles, Calendar as CalendarIcon, CheckCircle, Clock,
  Trash2, ArrowRight, Target, TrendingUp, FileText, Lightbulb,
  RefreshCw, Play, ChevronRight
} from 'lucide-react';

interface ContentSuggestion {
  id: string;
  title: string;
  description: string;
  content_type: string;
  target_keywords: string[];
  priority: string;
  opportunity_score: number;
  source: string;
  source_data: any;
  status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function ContentCalendar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadSuggestions();
  }, [user]);

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('content_calendar')
        .select('*')
        .order('opportunity_score', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      toast({ title: 'AI analyseert data...', description: 'Suggesties worden gegenereerd op basis van concurrenten en keywords' });

      const { data, error } = await supabase.functions.invoke('generate-content-suggestions');

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Suggesties gegenereerd!',
          description: `${data.new_added} nieuwe ideeën toegevoegd`
        });
        loadSuggestions();
      } else {
        throw new Error(data.error || 'Genereren mislukt');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: 'Fout',
        description: error.message || 'Kon suggesties niet genereren',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('content_calendar')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      loadSuggestions();
      toast({ title: status === 'completed' ? 'Content afgerond!' : 'Status bijgewerkt' });
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const scheduleItem = async (id: string, date: Date) => {
    try {
      const { error } = await supabase
        .from('content_calendar')
        .update({ 
          scheduled_date: format(date, 'yyyy-MM-dd'),
          status: 'scheduled'
        })
        .eq('id', id);

      if (error) throw error;
      setSchedulingId(null);
      setSelectedDate(undefined);
      loadSuggestions();
      toast({ title: 'Ingepland!', description: `Content gepland voor ${format(date, 'd MMMM', { locale: nl })}` });
    } catch (error) {
      console.error('Schedule error:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('content_calendar')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadSuggestions();
      toast({ title: 'Verwijderd' });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const startContent = (suggestion: ContentSuggestion) => {
    // Navigate to content generator with pre-filled data
    const params = new URLSearchParams({
      title: suggestion.title,
      keywords: suggestion.target_keywords.join(','),
      type: suggestion.content_type
    });
    navigate(`/content?${params.toString()}`);
    updateStatus(suggestion.id, 'in_progress');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'category': return <Target className="h-4 w-4" />;
      case 'blog': return <FileText className="h-4 w-4" />;
      case 'landing_page': return <TrendingUp className="h-4 w-4" />;
      case 'guide': return <Lightbulb className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'category': return 'Categorie';
      case 'blog': return 'Blog';
      case 'landing_page': return 'Landingspagina';
      case 'guide': return 'Gids';
      default: return type;
    }
  };

  const suggestedItems = suggestions.filter(s => s.status === 'suggested');
  const scheduledItems = suggestions.filter(s => s.status === 'scheduled');
  const inProgressItems = suggestions.filter(s => s.status === 'in_progress');
  const completedItems = suggestions.filter(s => s.status === 'completed');

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Content Kalender
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              AI-gestuurde content suggesties op basis van concurrentie en keywords
            </p>
          </div>

          <Button onClick={generateSuggestions} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Genereer Suggesties
              </>
            )}
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{suggestedItems.length}</p>
                  <p className="text-xs text-muted-foreground">Suggesties</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{scheduledItems.length}</p>
                  <p className="text-xs text-muted-foreground">Ingepland</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inProgressItems.length}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedItems.length}</p>
                  <p className="text-xs text-muted-foreground">Afgerond</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Laden...</p>
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nog geen content suggesties</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Laat de AI analyseren welke content je moet maken op basis van concurrentie-analyse en keyword data.
              </p>
              <Button onClick={generateSuggestions} disabled={isGenerating}>
                <Sparkles className="h-4 w-4 mr-2" />
                Genereer Eerste Suggesties
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="suggested" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="suggested">
                Suggesties ({suggestedItems.length})
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Ingepland ({scheduledItems.length})
              </TabsTrigger>
              <TabsTrigger value="in_progress">
                In Progress ({inProgressItems.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Afgerond ({completedItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggested" className="mt-4">
              <div className="grid gap-3">
                {suggestedItems.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    onStart={() => startContent(item)}
                    onSchedule={() => setSchedulingId(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    getPriorityColor={getPriorityColor}
                    getContentTypeIcon={getContentTypeIcon}
                    getContentTypeLabel={getContentTypeLabel}
                  />
                ))}
                {suggestedItems.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Geen nieuwe suggesties. Klik op "Genereer Suggesties" voor nieuwe ideeën.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="mt-4">
              <div className="grid gap-3">
                {scheduledItems.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    onStart={() => startContent(item)}
                    onDelete={() => deleteItem(item.id)}
                    getPriorityColor={getPriorityColor}
                    getContentTypeIcon={getContentTypeIcon}
                    getContentTypeLabel={getContentTypeLabel}
                    showDate
                  />
                ))}
                {scheduledItems.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Geen ingeplande content.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="in_progress" className="mt-4">
              <div className="grid gap-3">
                {inProgressItems.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    onComplete={() => updateStatus(item.id, 'completed')}
                    onDelete={() => deleteItem(item.id)}
                    getPriorityColor={getPriorityColor}
                    getContentTypeIcon={getContentTypeIcon}
                    getContentTypeLabel={getContentTypeLabel}
                  />
                ))}
                {inProgressItems.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Geen content in progress.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              <div className="grid gap-3">
                {completedItems.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    onDelete={() => deleteItem(item.id)}
                    getPriorityColor={getPriorityColor}
                    getContentTypeIcon={getContentTypeIcon}
                    getContentTypeLabel={getContentTypeLabel}
                    completed
                  />
                ))}
                {completedItems.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nog geen afgeronde content.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Schedule Popover */}
        {schedulingId && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setSchedulingId(null)}>
            <Card className="w-auto" onClick={e => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="text-base">Inplannen</CardTitle>
                <CardDescription>Kies een datum</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  locale={nl}
                />
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setSchedulingId(null)}>
                    Annuleren
                  </Button>
                  <Button 
                    className="flex-1" 
                    disabled={!selectedDate}
                    onClick={() => selectedDate && scheduleItem(schedulingId, selectedDate)}
                  >
                    Inplannen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

interface SuggestionCardProps {
  item: ContentSuggestion;
  onStart?: () => void;
  onSchedule?: () => void;
  onComplete?: () => void;
  onDelete: () => void;
  getPriorityColor: (priority: string) => string;
  getContentTypeIcon: (type: string) => React.ReactNode;
  getContentTypeLabel: (type: string) => string;
  showDate?: boolean;
  completed?: boolean;
}

function SuggestionCard({
  item,
  onStart,
  onSchedule,
  onComplete,
  onDelete,
  getPriorityColor,
  getContentTypeIcon,
  getContentTypeLabel,
  showDate,
  completed
}: SuggestionCardProps) {
  return (
    <Card className={completed ? 'opacity-70' : ''}>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Score */}
          <div className="hidden sm:flex flex-col items-center justify-center w-16 shrink-0">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${(item.opportunity_score / 100) * 150.8} 150.8`}
                  className="text-primary"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {item.opportunity_score}
              </span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">Score</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="outline" className="shrink-0 gap-1">
                {getContentTypeIcon(item.content_type)}
                {getContentTypeLabel(item.content_type)}
              </Badge>
              <Badge className={`shrink-0 ${getPriorityColor(item.priority)}`}>
                {item.priority === 'high' ? 'Hoog' : item.priority === 'medium' ? 'Medium' : 'Laag'}
              </Badge>
              {showDate && item.scheduled_date && (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(new Date(item.scheduled_date), 'd MMM', { locale: nl })}
                </Badge>
              )}
            </div>

            <h3 className="font-semibold mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>

            <div className="flex flex-wrap gap-1.5">
              {item.target_keywords.slice(0, 4).map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
              {item.target_keywords.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{item.target_keywords.length - 4}
                </Badge>
              )}
            </div>

            {item.source_data?.reasoning && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                💡 {item.source_data.reasoning}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex sm:flex-col gap-2 shrink-0">
            {onStart && (
              <Button size="sm" onClick={onStart}>
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            )}
            {onSchedule && (
              <Button size="sm" variant="outline" onClick={onSchedule}>
                <CalendarIcon className="h-4 w-4 mr-1" />
                Plan
              </Button>
            )}
            {onComplete && (
              <Button size="sm" variant="outline" onClick={onComplete}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Klaar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
