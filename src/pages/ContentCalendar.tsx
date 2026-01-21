import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Loader2, Sparkles, Calendar as CalendarIcon, CheckCircle, Clock,
  Target, TrendingUp, FileText, Lightbulb, RefreshCw
} from 'lucide-react';
import { ContentTypeTab, ContentSuggestion } from '@/components/content-calendar';

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
    const params = new URLSearchParams({
      title: suggestion.title,
      keywords: suggestion.target_keywords.join(','),
      type: suggestion.content_type
    });
    navigate(`/content?${params.toString()}`);
    updateStatus(suggestion.id, 'in_progress');
  };

  // Content type configurations
  const contentTypes = [
    { id: 'category', label: 'Categorieën', icon: <Target className="h-4 w-4" />, description: 'Product categoriepagina\'s' },
    { id: 'blog', label: 'Blogs', icon: <FileText className="h-4 w-4" />, description: 'Informatieve blogartikelen' },
    { id: 'landing_page', label: 'Landingspagina\'s', icon: <TrendingUp className="h-4 w-4" />, description: 'Conversie-gerichte pagina\'s' },
    { id: 'guide', label: 'Gidsen', icon: <Lightbulb className="h-4 w-4" />, description: 'Uitgebreide handleidingen' },
  ];

  // Calculate stats per type
  const getTypeStats = (type: string) => {
    const typeItems = suggestions.filter(s => s.content_type === type);
    return {
      total: typeItems.length,
      suggested: typeItems.filter(s => s.status === 'suggested').length,
      in_progress: typeItems.filter(s => s.status === 'in_progress').length,
    };
  };

  // Global stats
  const globalStats = {
    suggested: suggestions.filter(s => s.status === 'suggested').length,
    scheduled: suggestions.filter(s => s.status === 'scheduled').length,
    in_progress: suggestions.filter(s => s.status === 'in_progress').length,
    completed: suggestions.filter(s => s.status === 'completed').length,
  };

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
              AI-gestuurde content suggesties per type met eigen Kanban-bord
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

        {/* Global Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.suggested}</p>
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
                  <p className="text-2xl font-bold">{globalStats.scheduled}</p>
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
                  <p className="text-2xl font-bold">{globalStats.in_progress}</p>
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
                  <p className="text-2xl font-bold">{globalStats.completed}</p>
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
          <Tabs defaultValue="category" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-grid h-auto">
              {contentTypes.map((type) => {
                const stats = getTypeStats(type.id);
                return (
                  <TabsTrigger 
                    key={type.id} 
                    value={type.id}
                    className="flex items-center gap-2 py-2.5"
                  >
                    {type.icon}
                    <span className="hidden sm:inline">{type.label}</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {stats.total}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {contentTypes.map((type) => (
              <TabsContent key={type.id} value={type.id} className="mt-4">
                <ContentTypeTab
                  items={suggestions}
                  contentType={type.id}
                  onStart={startContent}
                  onSchedule={(id) => setSchedulingId(id)}
                  onComplete={(id) => updateStatus(id, 'completed')}
                  onDelete={deleteItem}
                />
              </TabsContent>
            ))}
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
