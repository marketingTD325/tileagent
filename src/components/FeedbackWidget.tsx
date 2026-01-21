import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  MessageSquare, X, Lightbulb, Bug, Zap, Copy, Check, Send,
  Trash2, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  type: 'idea' | 'tip' | 'bug';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'submitted' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

export function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    type: 'idea' as 'idea' | 'tip' | 'bug',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });

  useEffect(() => {
    if (user && isOpen) {
      loadFeedback();
    }
  }, [user, isOpen]);

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sharons_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbackItems((data || []) as FeedbackItem[]);
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFeedback = async () => {
    if (!newFeedback.title.trim() || !newFeedback.description.trim()) {
      toast({ title: 'Vul titel en beschrijving in', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('sharons_feedback')
        .insert({
          user_id: user!.id,
          type: newFeedback.type,
          title: newFeedback.title,
          description: newFeedback.description,
          priority: newFeedback.priority
        });

      if (error) throw error;

      setNewFeedback({ type: 'idea', title: '', description: '', priority: 'medium' });
      loadFeedback();
      toast({ title: 'Feedback toegevoegd!' });
    } catch (error) {
      console.error('Add feedback error:', error);
      toast({ title: 'Fout bij toevoegen', variant: 'destructive' });
    }
  };

  const updateStatus = async (id: string, status: 'open' | 'submitted' | 'resolved') => {
    try {
      const updates: any = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sharons_feedback')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      loadFeedback();
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sharons_feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFeedback();
      toast({ title: 'Verwijderd' });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const copyToClipboard = async (item: FeedbackItem) => {
    const typeLabel = item.type === 'bug' ? 'BUG' : item.type === 'tip' ? 'TIP' : 'IDEE';
    const text = `[${typeLabel}] ${item.title}\n\n${item.description}`;
    
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Gekopieerd!', description: 'Plak in Lovable chat' });
      
      if (item.status === 'open') {
        updateStatus(item.id, 'submitted');
      }
    } catch (error) {
      toast({ title: 'Kopiëren mislukt', variant: 'destructive' });
    }
  };

  const getTypeConfig = (type: 'idea' | 'tip' | 'bug') => {
    switch (type) {
      case 'idea': return { icon: <Lightbulb className="h-3 w-3" />, label: 'Idee', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
      case 'tip': return { icon: <Zap className="h-3 w-3" />, label: 'Tip', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'bug': return { icon: <Bug className="h-3 w-3" />, label: 'Bug', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'submitted': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return '';
    }
  };

  const openItems = feedbackItems.filter(f => f.status !== 'resolved');
  const resolvedItems = feedbackItems.filter(f => f.status === 'resolved');

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all duration-200 ${
          isOpen 
            ? 'bg-muted text-muted-foreground hover:bg-muted/80' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!isOpen && openItems.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {openItems.length}
          </span>
        )}
      </button>

      {/* Widget Panel */}
      {isOpen && (
        <Card className={`fixed bottom-16 right-4 z-50 shadow-2xl transition-all duration-200 ${
          isExpanded ? 'w-[400px] h-[600px]' : 'w-[340px] h-[480px]'
        }`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Sharon's Feedback
              </CardTitle>
              <CardDescription className="text-xs">
                Noteer ideeën, tips & bugs
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CardHeader>

          <CardContent className="p-3 pt-0 flex flex-col h-[calc(100%-70px)]">
            {/* Quick Add Form */}
            <div className="space-y-2 pb-3 border-b">
              {/* Type Buttons */}
              <div className="flex gap-1">
                {(['idea', 'tip', 'bug'] as const).map(type => {
                  const config = getTypeConfig(type);
                  return (
                    <Button
                      key={type}
                      variant={newFeedback.type === type ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs h-7 gap-1"
                      onClick={() => setNewFeedback(prev => ({ ...prev, type }))}
                    >
                      {config.icon}
                      {config.label}
                    </Button>
                  );
                })}
              </div>

              {/* Priority */}
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map(priority => (
                  <Button
                    key={priority}
                    variant={newFeedback.priority === priority ? 'secondary' : 'ghost'}
                    size="sm"
                    className="flex-1 text-xs h-6"
                    onClick={() => setNewFeedback(prev => ({ ...prev, priority }))}
                  >
                    {priority === 'low' ? 'Laag' : priority === 'medium' ? 'Medium' : 'Hoog'}
                  </Button>
                ))}
              </div>

              <Input
                placeholder="Titel..."
                value={newFeedback.title}
                onChange={e => setNewFeedback(prev => ({ ...prev, title: e.target.value }))}
                className="h-8 text-sm"
              />

              <Textarea
                placeholder="Beschrijving..."
                value={newFeedback.description}
                onChange={e => setNewFeedback(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="text-sm resize-none"
              />

              <Button onClick={addFeedback} size="sm" className="w-full h-8">
                Toevoegen
              </Button>
            </div>

            {/* Feedback List */}
            <ScrollArea className="flex-1 mt-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : openItems.length === 0 && resolvedItems.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nog geen feedback
                </p>
              ) : (
                <div className="space-y-2 pr-2">
                  {/* Open Items */}
                  {openItems.map(item => {
                    const typeConfig = getTypeConfig(item.type);
                    return (
                      <div key={item.id} className="p-2 rounded-lg border bg-card">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1 mb-1">
                              <Badge className={`text-[10px] h-5 gap-0.5 ${typeConfig.color}`}>
                                {typeConfig.icon}
                                {typeConfig.label}
                              </Badge>
                              <Badge className={`text-[10px] h-5 ${getStatusColor(item.status)}`}>
                                {item.status === 'open' ? 'Open' : 'Ingediend'}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(item)}
                              title="Kopieer naar clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateStatus(item.id, 'resolved')}
                              title="Markeer als opgelost"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => deleteFeedback(item.id)}
                              title="Verwijderen"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Resolved Items (collapsed by default) */}
                  {resolvedItems.length > 0 && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground py-2 flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                        {resolvedItems.length} opgelost
                      </summary>
                      <div className="space-y-2 pt-1">
                        {resolvedItems.map(item => {
                          const typeConfig = getTypeConfig(item.type);
                          return (
                            <div key={item.id} className="p-2 rounded-lg border bg-muted/30 opacity-60">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] h-5 gap-0.5 ${typeConfig.color}`}>
                                  {typeConfig.icon}
                                </Badge>
                                <p className="text-xs font-medium truncate flex-1">{item.title}</p>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => deleteFeedback(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </>
  );
}
