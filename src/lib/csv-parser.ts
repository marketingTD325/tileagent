/**
 * CSV Parser utilities for Bulk Content Pipeline
 * Handles parsing and validation of CSV files for different content types
 */

export type BulkJobType = 'category' | 'filter' | 'cms';

export interface CategoryCSVRow {
  name: string;
  keywords: string;
  context?: string;
  category_id?: string;
}

export interface FilterCSVRow {
  url_path: string;
  category_id: string;
  parent_category_name?: string;
  keywords: string;
  tweakwise_template?: string;
}

export interface CMSCSVRow {
  identifier: string;
  content_heading: string;
  keywords: string;
  context?: string;
}

export type CSVRow = CategoryCSVRow | FilterCSVRow | CMSCSVRow;

export interface ParseResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse CSV text into rows
 */
export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  const rows: string[][] = [];
  
  for (const line of lines) {
    // Handle quoted fields with commas
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current.trim());
    rows.push(row);
  }
  
  return rows;
}

/**
 * Get required columns for each job type
 */
export function getRequiredColumns(jobType: BulkJobType): string[] {
  switch (jobType) {
    case 'category':
      return ['name', 'keywords'];
    case 'filter':
      return ['url_path', 'category_id', 'keywords'];
    case 'cms':
      return ['identifier', 'content_heading', 'keywords'];
  }
}

/**
 * Get all expected columns for each job type
 */
export function getAllColumns(jobType: BulkJobType): string[] {
  switch (jobType) {
    case 'category':
      return ['name', 'keywords', 'context', 'category_id'];
    case 'filter':
      return ['url_path', 'category_id', 'parent_category_name', 'keywords', 'tweakwise_template'];
    case 'cms':
      return ['identifier', 'content_heading', 'keywords', 'context'];
  }
}

/**
 * Parse and validate CSV for category content
 */
export function parseCategoryCSV(csvText: string): ParseResult<CategoryCSVRow> {
  const rows = parseCSV(csvText);
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: CategoryCSVRow[] = [];
  
  if (rows.length < 2) {
    errors.push('CSV moet een header rij en minimaal één data rij bevatten');
    return { success: false, data: [], errors, warnings };
  }
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const required = getRequiredColumns('category');
  
  // Check required columns
  for (const col of required) {
    if (!headers.includes(col)) {
      errors.push(`Verplichte kolom ontbreekt: ${col}`);
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: [], errors, warnings };
  }
  
  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, idx) => {
      rowData[header] = row[idx] || '';
    });
    
    if (!rowData.name) {
      warnings.push(`Rij ${i + 1}: 'name' is leeg, rij overgeslagen`);
      continue;
    }
    
    if (!rowData.keywords) {
      warnings.push(`Rij ${i + 1}: 'keywords' is leeg voor "${rowData.name}"`);
    }
    
    data.push({
      name: rowData.name,
      keywords: rowData.keywords || '',
      context: rowData.context,
      category_id: rowData.category_id
    });
  }
  
  return { success: true, data, errors, warnings };
}

/**
 * Parse and validate CSV for filter pages
 */
export function parseFilterCSV(csvText: string): ParseResult<FilterCSVRow> {
  const rows = parseCSV(csvText);
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: FilterCSVRow[] = [];
  
  if (rows.length < 2) {
    errors.push('CSV moet een header rij en minimaal één data rij bevatten');
    return { success: false, data: [], errors, warnings };
  }
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const required = getRequiredColumns('filter');
  
  for (const col of required) {
    if (!headers.includes(col)) {
      errors.push(`Verplichte kolom ontbreekt: ${col}`);
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: [], errors, warnings };
  }
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, idx) => {
      rowData[header] = row[idx] || '';
    });
    
    if (!rowData.url_path) {
      warnings.push(`Rij ${i + 1}: 'url_path' is leeg, rij overgeslagen`);
      continue;
    }
    
    if (!rowData.category_id) {
      warnings.push(`Rij ${i + 1}: 'category_id' is leeg voor "${rowData.url_path}"`);
    }
    
    data.push({
      url_path: rowData.url_path,
      category_id: rowData.category_id || '',
      parent_category_name: rowData.parent_category_name,
      keywords: rowData.keywords || '',
      tweakwise_template: rowData.tweakwise_template
    });
  }
  
  return { success: true, data, errors, warnings };
}

/**
 * Parse and validate CSV for CMS pages
 */
export function parseCMSCSV(csvText: string): ParseResult<CMSCSVRow> {
  const rows = parseCSV(csvText);
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: CMSCSVRow[] = [];
  
  if (rows.length < 2) {
    errors.push('CSV moet een header rij en minimaal één data rij bevatten');
    return { success: false, data: [], errors, warnings };
  }
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const required = getRequiredColumns('cms');
  
  for (const col of required) {
    if (!headers.includes(col)) {
      errors.push(`Verplichte kolom ontbreekt: ${col}`);
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: [], errors, warnings };
  }
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, idx) => {
      rowData[header] = row[idx] || '';
    });
    
    if (!rowData.identifier) {
      warnings.push(`Rij ${i + 1}: 'identifier' is leeg, rij overgeslagen`);
      continue;
    }
    
    if (!rowData.content_heading) {
      warnings.push(`Rij ${i + 1}: 'content_heading' is leeg voor "${rowData.identifier}"`);
    }
    
    data.push({
      identifier: rowData.identifier,
      content_heading: rowData.content_heading || '',
      keywords: rowData.keywords || '',
      context: rowData.context
    });
  }
  
  return { success: true, data, errors, warnings };
}

/**
 * Generate CSV template for download
 */
export function generateCSVTemplate(jobType: BulkJobType): string {
  const columns = getAllColumns(jobType);
  const header = columns.join(',');
  
  let exampleRow = '';
  switch (jobType) {
    case 'category':
      exampleRow = 'Wandtegels Badkamer,"wandtegels, badkamer, modern",Moderne wandtegels voor je badkamer,123';
      break;
    case 'filter':
      exampleRow = 'kranen/regendouche/kleur/chroom,262,regendouche,"chroom kraan, regendouche",TEMPLATE_KRANEN';
      break;
    case 'cms':
      exampleRow = 'badkamer-inspiratie,Badkamer Inspiratie 2026,"badkamer, inspiratie, trends",';
      break;
  }
  
  return `${header}\n${exampleRow}`;
}

/**
 * Convert data to CSV string for export
 */
export function toCSV(headers: string[], rows: Record<string, string>[]): string {
  const escapeField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  
  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => escapeField(row[h] || '')).join(',')
  );
  
  return [headerLine, ...dataLines].join('\n');
}
