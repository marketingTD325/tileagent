import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkJobType } from '@/lib/csv-parser';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobType: BulkJobType;
  itemCount: number;
  onExport: (format: 'csv' | 'json', options: ExportOptions) => void;
}

export interface ExportOptions {
  includeMetaFields: boolean;
  includeContentFields: boolean;
  magentaCompatible: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  jobType,
  itemCount,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [options, setOptions] = useState<ExportOptions>({
    includeMetaFields: true,
    includeContentFields: true,
    magentaCompatible: true,
  });

  const getJobTypeLabel = () => {
    switch (jobType) {
      case 'category': return "categoriepagina's";
      case 'filter': return "filterpagina's";
      case 'cms': return "CMS pagina's";
    }
  };

  const handleExport = () => {
    onExport(format, options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exporteren
          </DialogTitle>
          <DialogDescription>
            Exporteer {itemCount} {getJobTypeLabel()} voor import in je webshop
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Formaat</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as 'csv' | 'json')}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="csv"
                  id="csv"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="csv"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileSpreadsheet className="mb-2 h-6 w-6" />
                  CSV
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="json"
                  id="json"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="json"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileJson className="mb-2 h-6 w-6" />
                  JSON
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <Label>Opties</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="meta"
                  checked={options.includeMetaFields}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeMetaFields: !!checked })
                  }
                />
                <label htmlFor="meta" className="text-sm cursor-pointer">
                  Meta velden (title, description)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="content"
                  checked={options.includeContentFields}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeContentFields: !!checked })
                  }
                />
                <label htmlFor="content" className="text-sm cursor-pointer">
                  Content velden (description_bottom, etc.)
                </label>
              </div>
              {format === 'csv' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="magento"
                    checked={options.magentaCompatible}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, magentaCompatible: !!checked })
                    }
                  />
                  <label htmlFor="magento" className="text-sm cursor-pointer">
                    Magento-compatibele structuur
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Info about fields */}
          {jobType === 'category' && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p className="font-medium mb-1">Categorie export bevat:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><code>description_bottom_extra</code> - tekst onderaan (klantgericht)</li>
                <li><code>description_bottom</code> - tekst zijkant (SEO-gericht)</li>
              </ul>
            </div>
          )}

          {jobType === 'filter' && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p className="font-medium mb-1">Filter export bevat:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><code>store_ids</code>: 1,3 (standaard)</li>
                <li><code>type</code>: filter API 2026</li>
                <li><code>search_attributes</code>: automatisch geparsed</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporteren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
