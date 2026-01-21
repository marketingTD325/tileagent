import { ContentSuggestion } from './types';
import { ContentKanbanBoard } from './ContentKanbanBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar as CalendarIcon, Clock, CheckCircle } from 'lucide-react';

interface ContentTypeTabProps {
  items: ContentSuggestion[];
  contentType: string;
  onStart: (item: ContentSuggestion) => void;
  onSchedule: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ContentTypeTab({
  items,
  contentType,
  onStart,
  onSchedule,
  onComplete,
  onDelete
}: ContentTypeTabProps) {
  const typeItems = items.filter(item => item.content_type === contentType);
  
  const stats = {
    suggested: typeItems.filter(s => s.status === 'suggested').length,
    scheduled: typeItems.filter(s => s.status === 'scheduled').length,
    in_progress: typeItems.filter(s => s.status === 'in_progress').length,
    completed: typeItems.filter(s => s.status === 'completed').length,
  };

  if (typeItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            Nog geen content suggesties voor dit type.
            <br />
            <span className="text-sm">Klik op "Genereer Suggesties" voor nieuwe ideeën.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mini Stats */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{stats.suggested}</span> Suggesties
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-semibold">{stats.scheduled}</span> Ingepland
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <Clock className="h-3.5 w-3.5 text-yellow-500" />
          <span className="font-semibold">{stats.in_progress}</span> In Progress
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold">{stats.completed}</span> Afgerond
        </Badge>
      </div>

      {/* Kanban Board */}
      <ContentKanbanBoard
        items={typeItems}
        onStart={onStart}
        onSchedule={onSchedule}
        onComplete={onComplete}
        onDelete={onDelete}
      />
    </div>
  );
}
