import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ContentGenerator() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Content Generator</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5" />
              Binnenkort beschikbaar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">De content generator wordt geladen. Genereer SEO-geoptimaliseerde productbeschrijvingen, blogposts en meta tags.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
