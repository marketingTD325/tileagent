import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Search, TrendingUp, Users, ArrowRight, Loader2, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ audits: 0, content: 0, keywords: 0, competitors: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
      loadRecentActivity();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const [audits, content, keywords, competitors] = await Promise.all([
        supabase.from('seo_audits').select('id', { count: 'exact', head: true }),
        supabase.from('generated_content').select('id', { count: 'exact', head: true }),
        supabase.from('keywords').select('id', { count: 'exact', head: true }),
        supabase.from('competitors').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        audits: audits.count || 0,
        content: content.count || 0,
        keywords: keywords.count || 0,
        competitors: competitors.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentActivity(data || []);
    } catch (error) {
      console.error('Failed to load activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const quickActions = [
    { title: 'Content Genereren', description: 'SEO-geoptimaliseerde teksten', icon: FileText, href: '/content', color: 'bg-primary' },
    { title: 'SEO Audit', description: 'Analyseer een pagina', icon: Search, href: '/audit', color: 'bg-info' },
    { title: 'Keyword Research', description: 'Vind nieuwe zoekwoorden', icon: TrendingUp, href: '/keywords', color: 'bg-accent' },
    { title: 'Concurrent Analyse', description: 'Vergelijk met concurrenten', icon: Users, href: '/competitors', color: 'bg-success' },
  ];

  const statCards = [
    { label: 'SEO Audits', value: stats.audits, icon: Search },
    { label: 'Content Items', value: stats.content, icon: FileText },
    { label: 'Zoekwoorden', value: stats.keywords, icon: TrendingUp },
    { label: 'Concurrenten', value: stats.competitors, icon: Users },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welkom terug! Hier is een overzicht van je SEO activiteiten voor Tegeldepot.nl
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {loadingStats ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Snelle Acties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Card 
                key={action.title} 
                className="group hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/20"
                onClick={() => navigate(action.href)}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${action.color} text-white shrink-0`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recente Activiteit</h2>
          <Card>
            <CardContent className="p-6">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nog geen activiteit. Begin met het genereren van content of het uitvoeren van een SEO audit!</p>
                  <Button className="mt-4" onClick={() => navigate('/content')}>
                    Start met Content
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 pb-3 border-b last:border-0">
                      <div className="p-2 rounded-lg bg-muted">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action_description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
