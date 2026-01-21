import { ContentSuggestion } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Target, FileText, TrendingUp, Lightbulb, Play, Calendar as CalendarIcon,
  CheckCircle, Trash2, Clock, Sparkles
} from 'lucide-react';

interface ContentKanbanBoardProps {
  items: ContentSuggestion[];
  onStart: (item: ContentSuggestion) => void;
  onSchedule: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ContentKanbanBoard({
  items,
  onStart,
  onSchedule,
  onComplete,
  onDelete
}: ContentKanbanBoardProps) {
  const suggestedItems = items.filter(s => s.status === 'suggested');
  const scheduledItems = items.filter(s => s.status === 'scheduled');
  const inProgressItems = items.filter(s => s.status === 'in_progress');
  const completedItems = items.filter(s => s.status === 'completed');

  const columns = [
    { id: 'suggested', title: 'Suggesties', items: suggestedItems, icon: <Sparkles className="h-4 w-4" />, color: 'bg-primary/10 text-primary' },
    { id: 'scheduled', title: 'Ingepland', items: scheduledItems, icon: <CalendarIcon className="h-4 w-4" />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    { id: 'in_progress', title: 'In Progress', items: inProgressItems, icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' },
    { id: 'completed', title: 'Afgerond', items: completedItems, icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columns.map((column) => (
          <div key={column.id} className="w-72 shrink-0">
            {/* Column Header */}
            <div className={`flex items-center gap-2 p-3 rounded-t-lg ${column.color}`}>
              {column.icon}
              <span className="font-semibold text-sm">{column.title}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {column.items.length}
              </Badge>
            </div>

            {/* Column Content */}
            <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
              {column.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Geen items
                </div>
              ) : (
                column.items.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    columnId={column.id}
                    onStart={() => onStart(item)}
                    onSchedule={() => onSchedule(item.id)}
                    onComplete={() => onComplete(item.id)}
                    onDelete={() => onDelete(item.id)}
                    getPriorityColor={getPriorityColor}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

interface KanbanCardProps {
  item: ContentSuggestion;
  columnId: string;
  onStart: () => void;
  onSchedule: () => void;
  onComplete: () => void;
  onDelete: () => void;
  getPriorityColor: (priority: string) => string;
}

function KanbanCard({
  item,
  columnId,
  onStart,
  onSchedule,
  onComplete,
  onDelete,
  getPriorityColor
}: KanbanCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        {/* Score & Priority */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{item.opportunity_score}</span>
            </div>
          </div>
          <Badge className={`text-xs ${getPriorityColor(item.priority)}`}>
            {item.priority === 'high' ? 'Hoog' : item.priority === 'medium' ? 'Med' : 'Laag'}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm mb-1 line-clamp-2">{item.title}</h4>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1 mb-2">
          {item.target_keywords.slice(0, 2).map((kw, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
              {kw}
            </Badge>
          ))}
          {item.target_keywords.length > 2 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{item.target_keywords.length - 2}
            </Badge>
          )}
        </div>

        {/* Scheduled Date */}
        {item.scheduled_date && columnId === 'scheduled' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <CalendarIcon className="h-3 w-3" />
            {format(new Date(item.scheduled_date), 'd MMM yyyy', { locale: nl })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t">
          {columnId === 'suggested' && (
            <>
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onStart}>
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onSchedule}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                Plan
              </Button>
            </>
          )}
          {columnId === 'scheduled' && (
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onStart}>
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {columnId === 'in_progress' && (
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onComplete}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Klaar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
