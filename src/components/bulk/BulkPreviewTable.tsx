import { useState } from 'react';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkJobType, CategoryCSVRow, FilterCSVRow, CMSCSVRow, CSVRow } from '@/lib/csv-parser';

interface BulkJobItem {
  id: string;
  data: CSVRow;
  selected: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface BulkPreviewTableProps {
  jobType: BulkJobType;
  items: BulkJobItem[];
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onRemoveItem: (id: string) => void;
}

export function BulkPreviewTable({
  jobType,
  items,
  onToggleItem,
  onToggleAll,
  onRemoveItem,
}: BulkPreviewTableProps) {
  const allSelected = items.every(item => item.selected);
  const someSelected = items.some(item => item.selected);
  const selectedCount = items.filter(item => item.selected).length;

  const getStatusBadge = (status: BulkJobItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Wachtend</Badge>;
      case 'processing':
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Bezig
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-primary gap-1">
            <Check className="h-3 w-3" />
            Klaar
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Fout
          </Badge>
        );
    }
  };

  const renderCategoryRow = (item: BulkJobItem) => {
    const data = item.data as CategoryCSVRow;
    return (
      <>
        <TableCell className="font-medium">{data.name}</TableCell>
        <TableCell className="max-w-[200px] truncate">{data.keywords}</TableCell>
        <TableCell className="max-w-[150px] truncate text-muted-foreground">
          {data.context || '-'}
        </TableCell>
      </>
    );
  };

  const renderFilterRow = (item: BulkJobItem) => {
    const data = item.data as FilterCSVRow;
    return (
      <>
        <TableCell className="font-medium font-mono text-sm">{data.url_path}</TableCell>
        <TableCell>{data.category_id}</TableCell>
        <TableCell className="max-w-[200px] truncate">{data.keywords}</TableCell>
      </>
    );
  };

  const renderCMSRow = (item: BulkJobItem) => {
    const data = item.data as CMSCSVRow;
    return (
      <>
        <TableCell className="font-medium font-mono text-sm">{data.identifier}</TableCell>
        <TableCell>{data.content_heading}</TableCell>
        <TableCell className="max-w-[200px] truncate">{data.keywords}</TableCell>
      </>
    );
  };

  const getHeaders = () => {
    switch (jobType) {
      case 'category':
        return ['Naam', 'Keywords', 'Context'];
      case 'filter':
        return ['URL Path', 'Category ID', 'Keywords'];
      case 'cms':
        return ['Identifier', 'H1 Titel', 'Keywords'];
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount} van {items.length} items geselecteerd
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleAll(!allSelected)}
        >
          {allSelected ? 'Deselecteer alles' : 'Selecteer alles'}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                  aria-label="Selecteer alles"
                />
              </TableHead>
              {getHeaders().map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow 
                key={item.id}
                className={item.status === 'failed' ? 'bg-destructive/10' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => onToggleItem(item.id)}
                    disabled={item.status === 'processing' || item.status === 'completed'}
                    aria-label={`Selecteer ${item.id}`}
                  />
                </TableCell>
                {jobType === 'category' && renderCategoryRow(item)}
                {jobType === 'filter' && renderFilterRow(item)}
                {jobType === 'cms' && renderCMSRow(item)}
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  {item.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {items.some(item => item.status === 'failed' && item.error) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Fouten:</p>
          {items
            .filter(item => item.status === 'failed' && item.error)
            .map(item => (
              <p key={item.id} className="text-sm text-muted-foreground">
                • {(item.data as CategoryCSVRow).name || (item.data as FilterCSVRow).url_path || (item.data as CMSCSVRow).identifier}: {item.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
