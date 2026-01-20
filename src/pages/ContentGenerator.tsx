import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateContent, fetchSitemap, SitemapUrl } from '@/lib/api';
import { Loader2, FileText, Copy, Star, StarOff, Sparkles, Plus, Trash2, Link, Globe, Search, Check } from 'lucide-react';

type ContentType = 'product_description' | 'blog_post' | 'meta_tags' | 'category_description' | 'category_with_links';

interface InternalLink {
  anchor: string;
  url: string;
}

interface GeneratedItem {
  id: string;
  content_type: ContentType;
  title: string;
  content: string;
  target_keywords: string[] | null;
  is_favorite: boolean;
  created_at: string;
}

export default function ContentGenerator() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [contentType, setContentType] = useState<ContentType>('product_description');
  const [productName, setProductName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [context, setContext] = useState('');
  const [internalLinks, setInternalLinks] = useState<InternalLink[]>([{ anchor: '', url: '' }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [history, setHistory] = useState<GeneratedItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Sitemap state
  const [sitemapDomain, setSitemapDomain] = useState('tegeldepot.nl');
  const [sitemapSearch, setSitemapSearch] = useState('');
  const [sitemapUrls, setSitemapUrls] = useState<SitemapUrl[]>([]);
  const [isFetchingSitemap, setIsFetchingSitemap] = useState(false);
  const [showSitemapPicker, setShowSitemapPicker] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setHistory((data || []) as GeneratedItem[]);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!productName.trim()) {
      toast({ title: 'Fout', description: 'Vul een product/onderwerp in', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');

    try {
      const keywordArray = keywords.split(',').map(k => k.trim()).filter(Boolean);
      const validLinks = internalLinks.filter(link => link.anchor.trim() && link.url.trim());
      
      const result = await generateContent({
        contentType,
        productName,
        keywords: keywordArray.length > 0 ? keywordArray : undefined,
        context: context || undefined,
        internalLinks: contentType === 'category_with_links' && validLinks.length > 0 ? validLinks : undefined,
      });

      if (result.success && result.content) {
        setGeneratedContent(result.content);
        
        // Save to database
        const { error } = await supabase.from('generated_content').insert({
          user_id: user!.id,
          content_type: contentType,
          title: productName,
          content: result.content,
          target_keywords: keywordArray.length > 0 ? keywordArray : null,
        });

        if (error) console.error('Failed to save content:', error);
        
        // Log activity
        await supabase.from('activity_log').insert({
          user_id: user!.id,
          action_type: 'content_generated',
          action_description: `${getContentTypeLabel(contentType)} gegenereerd: ${productName}`,
          resource_type: 'generated_content',
        });

        loadHistory();
        toast({ title: 'Content gegenereerd!', description: 'Je tekst is klaar en opgeslagen.' });
      } else {
        throw new Error(result.error || 'Generatie mislukt');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({ 
        title: 'Generatie mislukt', 
        description: error.message || 'Er ging iets mis. Probeer het opnieuw.',
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Gekopieerd!', description: 'Tekst is naar je klembord gekopieerd.' });
  };

  const toggleFavorite = async (item: GeneratedItem) => {
    try {
      await supabase
        .from('generated_content')
        .update({ is_favorite: !item.is_favorite })
        .eq('id', item.id);
      loadHistory();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const getContentTypeLabel = (type: ContentType) => {
    const labels: Record<ContentType, string> = {
      product_description: 'Productbeschrijving',
      blog_post: 'Blogartikel',
      meta_tags: 'Meta Tags',
      category_description: 'Categoriebeschrijving',
      category_with_links: 'Categorie + Interne Links',
    };
    return labels[type];
  };

  const addInternalLink = () => {
    setInternalLinks([...internalLinks, { anchor: '', url: '' }]);
  };

  const removeInternalLink = (index: number) => {
    setInternalLinks(internalLinks.filter((_, i) => i !== index));
  };

  const updateInternalLink = (index: number, field: 'anchor' | 'url', value: string) => {
    const updated = [...internalLinks];
    updated[index][field] = value;
    setInternalLinks(updated);
  };

  const handleFetchSitemap = async () => {
    if (!sitemapDomain.trim()) {
      toast({ title: 'Fout', description: 'Vul een domein in', variant: 'destructive' });
      return;
    }

    setIsFetchingSitemap(true);
    try {
      const result = await fetchSitemap(sitemapDomain, sitemapSearch || undefined, 200);
      
      if (result.success && result.urls) {
        setSitemapUrls(result.urls);
        setShowSitemapPicker(true);
        toast({ 
          title: 'Sitemap opgehaald!', 
          description: `${result.total} URLs gevonden` 
        });
      } else {
        throw new Error(result.error || 'Kon sitemap niet ophalen');
      }
    } catch (error: any) {
      console.error('Sitemap fetch error:', error);
      toast({ 
        title: 'Fout bij ophalen sitemap', 
        description: error.message || 'Probeer het opnieuw',
        variant: 'destructive' 
      });
    } finally {
      setIsFetchingSitemap(false);
    }
  };

  const addSitemapUrlAsLink = (sitemapUrl: SitemapUrl) => {
    // Check if this URL is already added
    const exists = internalLinks.some(link => link.url === sitemapUrl.path);
    if (exists) {
      toast({ title: 'Al toegevoegd', description: 'Deze URL staat al in je links', variant: 'destructive' });
      return;
    }

    // Find first empty slot or add new
    const emptyIndex = internalLinks.findIndex(link => !link.anchor.trim() && !link.url.trim());
    if (emptyIndex >= 0) {
      const updated = [...internalLinks];
      updated[emptyIndex] = { anchor: sitemapUrl.suggestedAnchor, url: sitemapUrl.path };
      setInternalLinks(updated);
    } else {
      setInternalLinks([...internalLinks, { anchor: sitemapUrl.suggestedAnchor, url: sitemapUrl.path }]);
    }
    
    toast({ title: 'Link toegevoegd!', description: sitemapUrl.path });
  };

  const isUrlSelected = (url: string) => {
    return internalLinks.some(link => link.url === url);
  };

  const filteredSitemapUrls = sitemapUrls.filter(item => {
    if (!sitemapSearch.trim()) return true;
    const search = sitemapSearch.toLowerCase();
    return item.path.toLowerCase().includes(search) || 
           item.suggestedAnchor.toLowerCase().includes(search);
  });

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Content Generator</h1>
          <p className="text-muted-foreground mt-1">
            Genereer SEO-geoptimaliseerde content in de Tegeldepot tone of voice
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Nieuwe Content
                </CardTitle>
                <CardDescription>
                  Kies het type content en vul de details in
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Type Content</Label>
                  <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product_description">Productbeschrijving (150-300 woorden)</SelectItem>
                      <SelectItem value="category_description">Categoriebeschrijving (700-1000 woorden)</SelectItem>
                      <SelectItem value="category_with_links">Categorie + Interne Links (met echte URLs)</SelectItem>
                      <SelectItem value="blog_post">Blogartikel (600-900 woorden)</SelectItem>
                      <SelectItem value="meta_tags">Meta Tags (Title + Description)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Product / Onderwerp *</Label>
                  <Input
                    placeholder="bijv. Betonlook tegels 60x60, Badkamer trends 2024"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Zoekwoorden (optioneel)</Label>
                  <Input
                    placeholder="bijv. betonlook tegels, moderne vloertegels, grijze tegels"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Gescheiden door komma's</p>
                </div>

                <div className="space-y-2">
                  <Label>Extra Context (optioneel)</Label>
                  <Textarea
                    placeholder="bijv. Focus op badkamer toepassing, geschikt voor vloerverwarming"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Internal Links Section - Only show for category_with_links */}
                {contentType === 'category_with_links' && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Link className="h-4 w-4" />
                        Interne Links
                      </Label>
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => setShowSitemapPicker(!showSitemapPicker)}
                        >
                          <Globe className="h-4 w-4 mr-1" />
                          {showSitemapPicker ? 'Verberg Sitemap' : 'Uit Sitemap'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={addInternalLink}>
                          <Plus className="h-4 w-4 mr-1" />
                          Handmatig
                        </Button>
                      </div>
                    </div>
                    
                    {/* Sitemap Picker */}
                    {showSitemapPicker && (
                      <div className="space-y-3 p-3 border rounded-lg bg-background">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Domein (bijv. tegeldepot.nl)"
                            value={sitemapDomain}
                            onChange={(e) => setSitemapDomain(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            type="button" 
                            onClick={handleFetchSitemap}
                            disabled={isFetchingSitemap}
                          >
                            {isFetchingSitemap ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Globe className="h-4 w-4 mr-1" />
                                Ophalen
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {sitemapUrls.length > 0 && (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Zoek in URLs..."
                                value={sitemapSearch}
                                onChange={(e) => setSitemapSearch(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {filteredSitemapUrls.slice(0, 50).map((item, index) => (
                                <div 
                                  key={index}
                                  className={`flex items-center justify-between p-2 rounded text-sm hover:bg-muted/50 cursor-pointer transition-colors ${
                                    isUrlSelected(item.path) ? 'bg-primary/10 border border-primary/30' : ''
                                  }`}
                                  onClick={() => addSitemapUrlAsLink(item)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{item.suggestedAnchor}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.path}</p>
                                  </div>
                                  {isUrlSelected(item.path) ? (
                                    <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                                  ) : (
                                    <Plus className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                                  )}
                                </div>
                              ))}
                              {filteredSitemapUrls.length > 50 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  + {filteredSitemapUrls.length - 50} meer URLs (gebruik zoekfilter)
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {internalLinks.filter(l => l.anchor && l.url).length} links geselecteerd (5-6 aanbevolen voor 700-1000 woorden)
                    </p>
                    
                    {/* Selected links list */}
                    <div className="space-y-2">
                      {internalLinks.map((link, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Ankertekst (bijv. vloertegels)"
                            value={link.anchor}
                            onChange={(e) => updateInternalLink(index, 'anchor', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="URL (bijv. /vloertegels/)"
                            value={link.url}
                            onChange={(e) => updateInternalLink(index, 'url', e.target.value)}
                            className="flex-1"
                          />
                          {internalLinks.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeInternalLink(index)}
                              className="shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !productName.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Genereren...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Genereer Content
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generated Content */}
            {generatedContent && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Gegenereerde Content</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedContent)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Kopieer
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/50 p-4 rounded-lg whitespace-pre-wrap">
                    {generatedContent}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* History Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Geschiedenis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nog geen content gegenereerd
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {history.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setGeneratedContent(item.content)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {getContentTypeLabel(item.content_type)}
                            </Badge>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="shrink-0 h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item);
                            }}
                          >
                            {item.is_favorite ? (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(item.created_at).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
