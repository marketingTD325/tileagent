import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Download, Trash2, RotateCcw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CSVUploader } from '@/components/bulk/CSVUploader';
import { BulkPreviewTable } from '@/components/bulk/BulkPreviewTable';
import { BulkProgressTracker } from '@/components/bulk/BulkProgressTracker';
import { ExportDialog, ExportOptions } from '@/components/bulk/ExportDialog';
import { BulkJobType, CSVRow, CategoryCSVRow, FilterCSVRow, CMSCSVRow, toCSV } from '@/lib/csv-parser';
import { parseFilterUrl, getTweakwiseTemplate } from '@/lib/tweakwise-parser';

interface BulkJobItem {
  id: string;
  data: CSVRow;
  selected: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  generatedContentMain?: string;
  generatedContentSide?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export default function BulkContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [jobType, setJobType] = useState<BulkJobType>('category');
  const [items, setItems] = useState<BulkJobItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Stats
  const totalItems = items.length;
  const processedItems = items.filter(i => i.status === 'completed' || i.status === 'failed').length;
  const failedItems = items.filter(i => i.status === 'failed').length;
  const completedItems = items.filter(i => i.status === 'completed');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Handle CSV data parsed
  const handleDataParsed = useCallback((data: CSVRow[]) => {
    const newItems: BulkJobItem[] = data.map((row, index) => ({
      id: `item-${index}-${Date.now()}`,
      data: row,
      selected: true,
      status: 'pending' as const,
    }));
    setItems(newItems);
    setJobId(null);
  }, []);

  // Toggle item selection
  const handleToggleItem = useCallback((id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  // Toggle all items
  const handleToggleAll = useCallback((selected: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected })));
  }, []);

  // Remove item
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Get item name for display
  const getItemName = (item: BulkJobItem): string => {
    const data = item.data;
    if ('name' in data) return data.name;
    if ('url_path' in data) return data.url_path;
    if ('content_heading' in data) return data.content_heading;
    return item.id;
  };

  // Start bulk generation
  const handleStartGeneration = async () => {
    if (!user) return;

    const selectedItems = items.filter(i => i.selected && i.status === 'pending');
    if (selectedItems.length === 0) {
      toast({
        title: 'Geen items geselecteerd',
        description: 'Selecteer minimaal één item om te genereren.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create bulk job in database
      const { data: job, error: jobError } = await supabase
        .from('bulk_jobs')
        .insert({
          user_id: user.id,
          job_type: jobType,
          total_items: selectedItems.length,
          status: 'processing',
        })
        .select()
        .single();

      if (jobError) throw jobError;
      setJobId(job.id);

      // Process items sequentially
      for (const item of selectedItems) {
        setCurrentItemName(getItemName(item));
        
        // Update item status to processing
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'processing' } : i
        ));

        try {
          // Call content generation based on job type
          const result = await generateContentForItem(item, jobType);

          // Update item with result
          setItems(prev => prev.map(i => 
            i.id === item.id 
              ? { 
                  ...i, 
                  status: 'completed',
                  generatedContentMain: result.contentMain,
                  generatedContentSide: result.contentSide,
                  metaTitle: result.metaTitle,
                  metaDescription: result.metaDescription,
                } 
              : i
          ));

          // Save to database
          await supabase.from('bulk_job_items').insert([{
            job_id: job.id,
            user_id: user.id,
            input_data: JSON.parse(JSON.stringify(item.data)),
            generated_content_main: result.contentMain,
            generated_content_side: result.contentSide,
            meta_title: result.metaTitle,
            meta_description: result.metaDescription,
            status: 'completed',
          }]);

          // Update job progress
          await supabase
            .from('bulk_jobs')
            .update({ processed_items: processedItems + 1 })
            .eq('id', job.id);

        } catch (error) {
          console.error('Error generating content for item:', item.id, error);
          
          setItems(prev => prev.map(i => 
            i.id === item.id 
              ? { ...i, status: 'failed', error: (error as Error).message } 
              : i
          ));

          await supabase.from('bulk_job_items').insert([{
            job_id: job.id,
            user_id: user.id,
            input_data: JSON.parse(JSON.stringify(item.data)),
            status: 'failed',
            error_message: (error as Error).message,
          }]);
        }

        // Small delay between items to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Mark job as completed
      await supabase
        .from('bulk_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      toast({
        title: 'Bulk generatie voltooid',
        description: `${completedItems.length} items succesvol gegenereerd.`,
      });

    } catch (error) {
      console.error('Bulk generation error:', error);
      toast({
        title: 'Fout bij genereren',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setCurrentItemName('');
    }
  };

  // Generate content for a single item
  const generateContentForItem = async (
    item: BulkJobItem, 
    type: BulkJobType
  ): Promise<{
    contentMain: string;
    contentSide: string;
    metaTitle: string;
    metaDescription: string;
  }> => {
    const data = item.data;
    
    // Determine content type and parameters based on job type
    let contentType: string;
    let productName: string;
    let keywords: string[] = [];
    let context: string | undefined;

    if (type === 'category') {
      const catData = data as CategoryCSVRow;
      contentType = 'category_description';
      productName = catData.name;
      keywords = catData.keywords.split(',').map(k => k.trim());
      context = catData.context;
    } else if (type === 'filter') {
      const filterData = data as FilterCSVRow;
      contentType = 'category_description';
      productName = filterData.parent_category_name || filterData.url_path.split('/').pop() || '';
      keywords = filterData.keywords.split(',').map(k => k.trim());
    } else {
      const cmsData = data as CMSCSVRow;
      contentType = 'blog_post';
      productName = cmsData.content_heading;
      keywords = cmsData.keywords.split(',').map(k => k.trim());
      context = cmsData.context;
    }

    // Generate main content (description_bottom_extra - klantgericht)
    const { data: mainResult, error: mainError } = await supabase.functions.invoke('generate-content', {
      body: {
        contentType,
        productName,
        keywords,
        context: context ? `${context}\n\nDit is de HOOFDTEKST voor onderaan de pagina. Schrijf klantgerichte, behulpzame content van 700-1000 woorden.` : 'Dit is de HOOFDTEKST voor onderaan de pagina. Schrijf klantgerichte, behulpzame content van 700-1000 woorden.',
        tone: 'helpful',
      },
    });

    if (mainError) throw mainError;

    // Generate side content (description_bottom - SEO-gericht)
    const { data: sideResult, error: sideError } = await supabase.functions.invoke('generate-content', {
      body: {
        contentType,
        productName,
        keywords,
        context: 'Dit is de ZIJKANT tekst voor SEO. Schrijf een kortere, keyword-dense tekst van 200-400 woorden, meer gericht op Google dan op de klant.',
        tone: 'seo',
      },
    });

    if (sideError) throw sideError;

    // Generate meta tags
    const { data: metaResult, error: metaError } = await supabase.functions.invoke('generate-content', {
      body: {
        contentType: 'meta_tags',
        productName,
        keywords,
      },
    });

    if (metaError) throw metaError;

    return {
      contentMain: mainResult.content || '',
      contentSide: sideResult.content || '',
      metaTitle: metaResult.metaTitle || '',
      metaDescription: metaResult.metaDescription || '',
    };
  };

  // Handle export
  const handleExport = (format: 'csv' | 'json', options: ExportOptions) => {
    const itemsToExport = completedItems;
    
    if (itemsToExport.length === 0) {
      toast({
        title: 'Geen items om te exporteren',
        description: 'Genereer eerst content voordat je exporteert.',
        variant: 'destructive',
      });
      return;
    }

    let exportData: Record<string, string>[];

    if (jobType === 'category') {
      exportData = itemsToExport.map(item => {
        const catData = item.data as CategoryCSVRow;
        return {
          name: catData.name,
          category_id: catData.category_id || '',
          description_bottom_extra: item.generatedContentMain || '',
          description_bottom: item.generatedContentSide || '',
          meta_title: item.metaTitle || '',
          meta_description: item.metaDescription || '',
        };
      });
    } else if (jobType === 'filter') {
      exportData = itemsToExport.map(item => {
        const filterData = item.data as FilterCSVRow;
        const parsed = parseFilterUrl(filterData.url_path);
        
        return {
          store_ids: '1,3',
          active: '1',
          url_path: filterData.url_path,
          category_id: filterData.category_id,
          type: 'filter API 2026',
          search_attributes: parsed.searchAttributesString,
          hide_selected_filter_group: '1',
          tweakwise_template: filterData.tweakwise_template || getTweakwiseTemplate(parsed.categoryPath) || '',
          name: filterData.parent_category_name || '',
          meta_title: item.metaTitle || '',
          meta_description: item.metaDescription || '',
          description: item.generatedContentMain || '',
        };
      });
    } else {
      exportData = itemsToExport.map(item => {
        const cmsData = item.data as CMSCSVRow;
        return {
          identifier: cmsData.identifier,
          store_ids: '1,3',
          is_active: '1',
          content_heading: cmsData.content_heading,
          title: item.metaTitle || cmsData.content_heading,
          meta_title: item.metaTitle || '',
          meta_description: item.metaDescription || '',
          content: item.generatedContentMain || '',
        };
      });
    }

    // Generate file
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      const headers = Object.keys(exportData[0]);
      content = toCSV(headers, exportData);
      filename = `export_${jobType}_${Date.now()}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify(exportData, null, 2);
      filename = `export_${jobType}_${Date.now()}.json`;
      mimeType = 'application/json;charset=utf-8;';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export voltooid',
      description: `${itemsToExport.length} items geëxporteerd als ${format.toUpperCase()}.`,
    });
  };

  // Reset all
  const handleReset = () => {
    setItems([]);
    setJobId(null);
    setCurrentItemName('');
  };

  if (authLoading) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Bulk Content Pipeline</h1>
          <p className="text-muted-foreground">
            Upload een CSV bestand om meerdere pagina's tegelijk te genereren en exporteer voor Magento import.
          </p>
        </div>

        {/* Job Type Selection */}
        <Tabs value={jobType} onValueChange={(v) => { setJobType(v as BulkJobType); handleReset(); }}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="category">Categorieën</TabsTrigger>
            <TabsTrigger value="filter">Filterpagina's</TabsTrigger>
            <TabsTrigger value="cms">CMS Pagina's</TabsTrigger>
          </TabsList>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left Column: Upload & Preview */}
            <div className="lg:col-span-2 space-y-6">
              <TabsContent value="category" className="mt-0">
                <CSVUploader jobType="category" onDataParsed={handleDataParsed} />
              </TabsContent>
              <TabsContent value="filter" className="mt-0">
                <CSVUploader jobType="filter" onDataParsed={handleDataParsed} />
              </TabsContent>
              <TabsContent value="cms" className="mt-0">
                <CSVUploader jobType="cms" onDataParsed={handleDataParsed} />
              </TabsContent>

              {/* Preview Table */}
              {items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>
                      Controleer en selecteer de items die je wilt genereren
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BulkPreviewTable
                      jobType={jobType}
                      items={items}
                      onToggleItem={handleToggleItem}
                      onToggleAll={handleToggleAll}
                      onRemoveItem={handleRemoveItem}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Progress & Actions */}
            <div className="space-y-6">
              <BulkProgressTracker
                total={items.filter(i => i.selected).length}
                processed={processedItems}
                failed={failedItems}
                isRunning={isGenerating}
                currentItem={currentItemName}
              />

              {/* Action Buttons */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleStartGeneration}
                    disabled={isGenerating || items.filter(i => i.selected && i.status === 'pending').length === 0}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Bezig met genereren...' : 'Start Generatie'}
                  </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowExportDialog(true)}
                    disabled={completedItems.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exporteren ({completedItems.length})
                  </Button>

                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={isGenerating}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </CardContent>
              </Card>

              {/* Info Card for Filter Pages */}
              {jobType === 'filter' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tweakwise Integratie</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      De <code>search_attributes</code> worden automatisch geparsed uit de URL.
                    </p>
                    <p>
                      Voorbeeld: <code>kleur/chroom</code> → <code>kleur:Chroom</code>
                    </p>
                    <p>
                      Standaard instellingen:
                    </p>
                    <ul className="list-disc list-inside">
                      <li>store_ids: 1,3</li>
                      <li>type: filter API 2026</li>
                      <li>active: 1</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </Tabs>

        {/* Export Dialog */}
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          jobType={jobType}
          itemCount={completedItems.length}
          onExport={handleExport}
        />
      </div>
    </AppLayout>
  );
}
