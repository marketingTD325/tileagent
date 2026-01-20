import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, Search, TrendingUp, Users, Clock } from 'lucide-react';

export default function History() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [auditsRes, contentRes, activityRes] = await Promise.all([
        supabase.from('seo_audits').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('generated_content').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      
      setAudits(auditsRes.data || []);
      setContent(contentRes.data || []);
      setActivity(activityRes.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getActivityIcon = (type: string) => {
    if (type === 'seo_audit') return <Search className="h-4 w-4" />;
    if (type === 'content_generated') return <FileText className="h-4 w-4" />;
    if (type === 'keyword_research') return <TrendingUp className="h-4 w-4" />;
    if (type === 'competitor_analysis') return <Users className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Geschiedenis</h1>
          <p className="text-muted-foreground mt-1">
            Bekijk alle SEO audits, gegenereerde content en team activiteit
          </p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="activity" className="space-y-6">
            <TabsList>
              <TabsTrigger value="activity">Activiteit ({activity.length})</TabsTrigger>
              <TabsTrigger value="audits">SEO Audits ({audits.length})</TabsTrigger>
              <TabsTrigger value="content">Content ({content.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Team Activiteit</CardTitle>
                </CardHeader>
                <CardContent>
                  {activity.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nog geen activiteit</p>
                  ) : (
                    <div className="space-y-4">
                      {activity.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                          <div className="p-2 rounded-lg bg-muted">
                            {getActivityIcon(item.action_type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.action_description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(item.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audits">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Audits</CardTitle>
                </CardHeader>
                <CardContent>
                  {audits.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nog geen audits</p>
                  ) : (
                    <div className="space-y-3">
                      {audits.map((audit) => (
                        <div key={audit.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className={`text-2xl font-bold ${getScoreColor(audit.score)}`}>
                              {audit.score}
                            </div>
                            <div>
                              <p className="font-medium truncate max-w-md">{audit.url}</p>
                              <p className="text-sm text-muted-foreground">{formatDate(audit.created_at)}</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {(audit.issues as any[])?.length || 0} issues
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle>Gegenereerde Content</CardTitle>
                </CardHeader>
                <CardContent>
                  {content.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nog geen content</p>
                  ) : (
                    <div className="space-y-3">
                      {content.map((item) => (
                        <div key={item.id} className="p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{item.title}</p>
                            <Badge>{item.content_type.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatDate(item.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
