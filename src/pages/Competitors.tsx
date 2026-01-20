import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function Competitors() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Concurrent Analyse</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5" />
              Binnenkort beschikbaar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">De concurrent analyse tool wordt geladen. Analyseer en vergelijk SEO-prestaties van concurrenten.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
