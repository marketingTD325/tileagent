import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ContentScoreResult } from '@/lib/api';

interface ContentScoreCardProps {
  score: ContentScoreResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  hasContent: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-green-600 dark:text-green-400';
  if (score >= 6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const getProgressColor = (score: number) => {
  if (score >= 8) return 'bg-green-500';
  if (score >= 6) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getOverallBadge = (score: number) => {
  if (score >= 8) return { label: 'Uitstekend', variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' };
  if (score >= 7) return { label: 'Goed', variant: 'default' as const, className: 'bg-blue-500 hover:bg-blue-600' };
  if (score >= 6) return { label: 'Voldoende', variant: 'default' as const, className: 'bg-yellow-500 hover:bg-yellow-600' };
  return { label: 'Verbetering nodig', variant: 'destructive' as const, className: '' };
};

const categoryLabels: Record<string, string> = {
  eeat: 'E-E-A-T',
  helpfulness: 'Helpfulness',
  seo: 'Basic SEO',
  readability: 'Leesbaarheid',
};

export default function ContentScoreCard({ score, isAnalyzing, onAnalyze, hasContent }: ContentScoreCardProps) {
  if (!hasContent) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Content Score
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Analyseren...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-1" />
                {score ? 'Opnieuw analyseren' : 'Analyseer kwaliteit'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      {score && (
        <CardContent className="space-y-4">
          {/* Overall Score */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Totaalscore</p>
              <p className={`text-2xl font-bold ${getScoreColor(score.overallScore)}`}>
                {score.overallScore.toFixed(1)}/10
              </p>
            </div>
            <Badge className={getOverallBadge(score.overallScore).className}>
              {getOverallBadge(score.overallScore).label}
            </Badge>
          </div>

          {/* Individual Scores */}
          <div className="space-y-3">
            {Object.entries(score.scores).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{categoryLabels[key] || key}</span>
                  <span className={`font-semibold ${getScoreColor(value.score)}`}>
                    {value.score}/10
                  </span>
                </div>
                <div className="relative">
                  <Progress value={value.score * 10} className="h-2" />
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${getProgressColor(value.score)}`}
                    style={{ width: `${value.score * 10}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{value.feedback}</p>
              </div>
            ))}
          </div>

          {/* Top Priority */}
          {score.topPriority && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Hoogste prioriteit
              </p>
              <p className="text-sm text-destructive/80 mt-1">{score.topPriority}</p>
            </div>
          )}

          {/* Strengths */}
          {score.strengths && score.strengths.length > 0 && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Sterke punten
              </p>
              <ul className="mt-1 space-y-1">
                {score.strengths.map((strength, idx) => (
                  <li key={idx} className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
                    <span>•</span> {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
