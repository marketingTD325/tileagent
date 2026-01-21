import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

interface BulkProgressTrackerProps {
  total: number;
  processed: number;
  failed: number;
  isRunning: boolean;
  currentItem?: string;
}

export function BulkProgressTracker({
  total,
  processed,
  failed,
  isRunning,
  currentItem,
}: BulkProgressTrackerProps) {
  const completed = processed - failed;
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Content genereren...
            </>
          ) : processed === total && total > 0 ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              Voltooid
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-muted-foreground" />
              Klaar om te starten
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="h-3" />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">Totaal</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{completed}</p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Succesvol
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{failed}</p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" />
              Mislukt
            </p>
          </div>
        </div>

        {isRunning && currentItem && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Bezig met:</p>
            <p className="text-sm font-medium truncate">{currentItem}</p>
          </div>
        )}

        {!isRunning && processed > 0 && processed === total && (
          <div className="pt-2 border-t text-center">
            <p className="text-sm text-muted-foreground">
              {failed === 0 
                ? 'Alle items succesvol gegenereerd!'
                : `${completed} items gegenereerd, ${failed} mislukt`
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
