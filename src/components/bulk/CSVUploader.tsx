import { useState, useCallback } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BulkJobType, 
  parseCategoryCSV, 
  parseFilterCSV, 
  parseCMSCSV,
  generateCSVTemplate,
  CSVRow 
} from '@/lib/csv-parser';

interface CSVUploaderProps {
  jobType: BulkJobType;
  onDataParsed: (data: CSVRow[]) => void;
}

export function CSVUploader({ jobType, onDataParsed }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrors(['Alleen CSV bestanden zijn toegestaan']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      
      let result;
      switch (jobType) {
        case 'category':
          result = parseCategoryCSV(text);
          break;
        case 'filter':
          result = parseFilterCSV(text);
          break;
        case 'cms':
          result = parseCMSCSV(text);
          break;
      }

      setErrors(result.errors);
      setWarnings(result.warnings);
      
      if (result.success && result.data.length > 0) {
        setFileName(file.name);
        setRowCount(result.data.length);
        onDataParsed(result.data);
      }
    };
    
    reader.readAsText(file);
  }, [jobType, onDataParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const downloadTemplate = useCallback(() => {
    const template = generateCSVTemplate(jobType);
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${jobType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobType]);

  const getJobTypeLabel = () => {
    switch (jobType) {
      case 'category': return "Categoriepagina's";
      case 'filter': return 'Filterpagina\'s (Attribuut Landingspagina\'s)';
      case 'cms': return 'CMS Pagina\'s';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Upload
        </CardTitle>
        <CardDescription>
          Upload een CSV bestand met {getJobTypeLabel()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Download Template Button */}
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${fileName ? 'bg-muted/30' : ''}
          `}
        >
          {fileName ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="font-medium">{fileName}</p>
              <p className="text-sm text-muted-foreground">{rowCount} items geladen</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                Sleep een CSV bestand hierheen of
              </p>
              <label>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Button variant="secondary" size="sm" asChild>
                  <span>Selecteer bestand</span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4 text-destructive-foreground" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside text-sm">
                {warnings.slice(0, 5).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
                {warnings.length > 5 && (
                  <li className="text-muted-foreground">
                    ... en {warnings.length - 5} andere waarschuwingen
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
